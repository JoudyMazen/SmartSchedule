import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/database';

interface ApiResponse {
  success?: boolean;
  error?: string;
  message?: string;
  schedule_id?: number;
  entry?: any;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { level, group, section_num, course_code, time_slot, day, room, instructor } = req.body;

  if (!level || !group || !section_num || !course_code || !time_slot || !day) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: level, group, section_num, course_code, time_slot, day'
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let scheduleRes = await client.query(
      `SELECT schedule_id FROM schedule WHERE level_num = $1 AND group_num = $2`,
      [level, group]
    );

    let schedule_id: number;

    if (scheduleRes.rows.length === 0) {
      const insertSchedule = await client.query(
        `INSERT INTO schedule(level_num, group_num, status, created_at, updated_at)
         VALUES ($1, $2, 'active', NOW(), NOW())
         RETURNING schedule_id`,
        [level, group]
      );
      schedule_id = insertSchedule.rows[0].schedule_id;
    } else {
      schedule_id = scheduleRes.rows[0].schedule_id;
    }

    const insertContain = await client.query(
      `INSERT INTO contain(schedule_id, section_num, course_code, time_slot, day, room, instructor)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [schedule_id, section_num, course_code, time_slot, day, room || null, instructor || null]
    );

    await client.query(
      `UPDATE schedule SET updated_at = NOW() WHERE schedule_id = $1`,
      [schedule_id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Schedule entry added successfully',
      schedule_id,
      entry: insertContain.rows[0]
    });

  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Database error:', err);

    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'This time slot is already occupied for this schedule'
      });
    }

    if (err.code === '23503') {
      return res.status(400).json({
        success: false,
        error: 'Invalid course_code or section_num. Make sure they exist in the database.'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Database error occurred'
    });
  } finally {
    client.release();
  }
}