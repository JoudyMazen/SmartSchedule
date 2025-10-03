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
  const { method } = req;

  if (method === 'POST') {
    const { level, group, section_num, course_code, time_slot, day, room, instructor, activity_type } = req.body;

    if (!level || !group || !section_num || !course_code || !time_slot || !day || !activity_type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: level, group, section_num, course_code, time_slot, day, activity_type'
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insert section into section table
      await client.query(
        `INSERT INTO section (course_code, section_number, activity_type, hours_per_session, capacity)
         VALUES ($1, $2, $3, 1, 25)
         ON CONFLICT (course_code, section_number) 
         DO UPDATE SET activity_type = EXCLUDED.activity_type`,
        [course_code, section_num, activity_type]
      );

      // Get or create schedule
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

      // Check for conflicts
      const conflictCheck = await client.query(
        `SELECT c.course_code FROM contain c
         JOIN schedule s ON c.schedule_id = s.schedule_id
         WHERE s.level_num = $1 AND s.group_num = $2
         AND c.time_slot = $3 AND c.day = $4`,
        [level, group, time_slot, day]
      );

      if (conflictCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          error: `Time slot conflict! ${conflictCheck.rows[0].course_code} is already scheduled at ${time_slot} on ${day}`
        });
      }

      // Insert entry into contain table
      const insertContain = await client.query(
        `INSERT INTO contain(schedule_id, section_num, course_code, time_slot, day, room, instructor)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [schedule_id, section_num, course_code, time_slot, day, room || null, instructor || null]
      );

      // Update schedule timestamp
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
          error: 'This time slot is already occupied or section already exists with different activity type'
        });
      }
      if (err.code === '23503') {
        return res.status(400).json({
          success: false,
          error: 'Invalid course_code or section_num'
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

  else if (method === 'DELETE') {
    const { schedule_id, course_code } = req.query;

    if (!schedule_id || !course_code) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: schedule_id, course_code'
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete all entries for this course from contain table
      const result = await client.query(
        `DELETE FROM contain
         WHERE schedule_id = $1 AND course_code = $2
         RETURNING section_num, course_code`,
        [schedule_id, course_code]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: 'No schedule entries found for this course'
        });
      }

      // Get unique section numbers that were deleted
      const deletedSections = Array.from(new Set(result.rows.map(row => row.section_num)));

      // Delete sections from section table if no other schedules use them
      for (const sectionNum of deletedSections) {
        const stillUsed = await client.query(
          `SELECT 1 FROM contain WHERE course_code = $1 AND section_num = $2 LIMIT 1`,
          [course_code, sectionNum]
        );
        
        if (stillUsed.rows.length === 0) {
          await client.query(
            `DELETE FROM section WHERE course_code = $1 AND section_number = $2`,
            [course_code, sectionNum]
          );
        }
      }

      // Update schedule timestamp
      await client.query(
        `UPDATE schedule SET updated_at = NOW() WHERE schedule_id = $1`,
        [schedule_id]
      );

      await client.query('COMMIT');

      res.status(200).json({
        success: true,
        message: `Deleted ${result.rows.length} session(s) for ${course_code}`
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error deleting entries:', err);
      res.status(500).json({
        success: false,
        error: 'Database error occurred'
      });
    } finally {
      client.release();
    }
  }

  else {
    res.setHeader('Allow', ['POST', 'DELETE']);
    return res.status(405).json({
      success: false,
      error: `Method ${method} Not Allowed`
    });
  }
}