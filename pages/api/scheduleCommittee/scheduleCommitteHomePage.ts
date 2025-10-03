// pages/api/scheduleCommittee/scheduleCommitteeHomePage.ts
import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/database';

interface ScheduleEntry {
  schedule_id: number;
  section_num: number;
  course_code: string;
  course_name: string;
  time_slot: string;
  day: string;
  room?: string;
  instructor?: string;
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

// POST - Add schedule entry (including other department courses)
async function handlePost(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { 
      level, 
      group, 
      section_num, 
      course_code, 
      time_slot, 
      day, 
      room, 
      instructor 
    } = req.body;
    
    // Validate required fields
    if (!level || !group || !section_num || !course_code || !time_slot || !day) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: level, group, section_num, course_code, time_slot, day'
      });
    }
    
    // Get or create schedule_id for this level and group
    const scheduleQuery = `
      SELECT schedule_id FROM schedule 
      WHERE level_num = $1 AND group_num = $2
    `;
    let scheduleResult = await client.query(scheduleQuery, [level, group]);
    
    let schedule_id: number;
    
    if (scheduleResult.rows.length === 0) {
      // Create new schedule if it doesn't exist
      const createScheduleQuery = `
        INSERT INTO schedule (level_num, group_num)
        VALUES ($1, $2)
        RETURNING schedule_id
      `;
      const newSchedule = await client.query(createScheduleQuery, [level, group]);
      schedule_id = newSchedule.rows[0].schedule_id;
    } else {
      schedule_id = scheduleResult.rows[0].schedule_id;
    }
    
    // Check for conflicts (same time slot, day, and group)
    const conflictQuery = `
      SELECT c.* FROM contain c
      JOIN schedule s ON c.schedule_id = s.schedule_id
      WHERE s.level_num = $1 
        AND s.group_num = $2 
        AND c.time_slot = $3 
        AND c.day = $4
    `;
    const conflictResult = await client.query(conflictQuery, [level, group, time_slot, day]);
    
    if (conflictResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        error: 'This time slot is already occupied for this group'
      });
    }
    
    // Insert the course into the schedule
    const insertQuery = `
      INSERT INTO contain (schedule_id, section_num, course_code, time_slot, day, room, instructor)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const result = await client.query(insertQuery, [
      schedule_id, 
      section_num, 
      course_code, 
      time_slot, 
      day, 
      room || null, 
      instructor || null
    ]);
    
    await client.query('COMMIT');
    
    // Fetch course name for response
    const courseNameQuery = `
      SELECT course_name FROM course WHERE course_code = $1
    `;
    const courseNameResult = await client.query(courseNameQuery, [course_code]);
    const course_name = courseNameResult.rows.length > 0 
      ? courseNameResult.rows[0].course_name 
      : course_code;
    
    res.status(201).json({ 
      success: true, 
      entry: { ...result.rows[0], course_name },
      message: 'Course added to schedule successfully'
    });
    
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error adding schedule entry:', error);
    
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Duplicate entry - this exact schedule entry already exists'
      });
    }
    
    if (error.code === '23503') {
      return res.status(400).json({
        success: false,
        error: 'Invalid course code or section number'
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Database error occurred while adding course'
    });
  } finally {
    client.release();
  }
}

// DELETE - Delete schedule entry
async function handleDelete(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  try {
    const { schedule_id, section_num, time_slot, day } = req.query;
    
    if (!schedule_id || !section_num || !time_slot || !day) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: schedule_id, section_num, time_slot, day'
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