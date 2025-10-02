import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/database';

interface ScheduleEntry {
  schedule_id: number;
  section_num: number;
  course_code: string;
  course_name: string;
  time_slot: string;
  day: string;
}

interface ApiResponse {
  success?: boolean;
  error?: string;
  message?: string;
  schedules?: ScheduleEntry[];
  entry?: ScheduleEntry;
}

// GET - Fetch schedule for specific level and group
async function handleGetSchedule(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { level, group } = req.query;
    
    if (!level || !group) {
      return res.status(400).json({ 
        success: false, 
        error: 'Level and group parameters are required' 
      });
    }
    
    const query = `
      SELECT
        c.schedule_id,
        c.section_num,
        c.course_code,
        c.time_slot,
        c.day,
        c.room,
        c.instructor,
        COALESCE(course.course_name, c.course_code) as course_name
      FROM contain c
      LEFT JOIN course ON c.course_code = course.course_code
      JOIN schedule s ON c.schedule_id = s.schedule_id
      WHERE s.level_num = $1 AND s.group_num = $2
      ORDER BY
        CASE c.day
          WHEN 'Sunday' THEN 1
          WHEN 'Monday' THEN 2
          WHEN 'Tuesday' THEN 3
          WHEN 'Wednesday' THEN 4
          WHEN 'Thursday' THEN 5
        END,
        c.time_slot
    `;
    
    const result = await pool.query(query, [level, group]);
    res.status(200).json({ success: true, schedules: result.rows });
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database error occurred'
    });
  }
}

// POST - Add schedule entry
async function handlePost(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  try {
    const { schedule_id, section_num, course_code, time_slot, day, room, instructor } = req.body;
    
    if (!schedule_id || !section_num || !course_code || !time_slot || !day) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    const query = `
      INSERT INTO contain (schedule_id, section_num, course_code, time_slot, day, room, instructor)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const result = await pool.query(query, [schedule_id, section_num, course_code, time_slot, day, room, instructor]);
    
    res.status(201).json({ 
      success: true, 
      entry: result.rows[0],
      message: 'Schedule entry added successfully'
    });
  } catch (error: any) {
    console.error('Error adding schedule entry:', error);
    
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'This time slot is already occupied'
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Database error occurred'
    });
  }
}

// DELETE - Delete schedule entry
async function handleDelete(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  try {
    const { schedule_id, section_num, time_slot, day } = req.query;
    
    if (!schedule_id || !section_num || !time_slot || !day) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    const query = `
      DELETE FROM contain
      WHERE schedule_id = $1 AND section_num = $2 AND time_slot = $3 AND day = $4
      RETURNING *
    `;
    
    const result = await pool.query(query, [schedule_id, section_num, time_slot, day]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Schedule entry not found'
      });
    }
    
    res.status(200).json({ 
      success: true,
      message: 'Schedule entry deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting schedule entry:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database error occurred'
    });
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  switch (method) {
    case 'GET':
      return handleGetSchedule(req, res);
    case 'POST':
      return handlePost(req, res);
    case 'DELETE':
      return handleDelete(req, res);
    default:
      res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
      res.status(405).json({
        success: false,
        error: `Method ${method} Not Allowed`
      });
  }
}