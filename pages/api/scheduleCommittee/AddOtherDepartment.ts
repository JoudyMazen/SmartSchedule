import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/database';

interface ApiResponse {
  success?: boolean;
  error?: string;
  message?: string;
  schedule_id?: number;
  entry?: any;
}

interface ScheduleEntry {
  level: number;
  group: number;
  section_num: number;
  course_code: string;
  time_slot: string;
  day: string;
  activity_type: string;
  room?: string;
  instructor?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  const { method } = req;

  if (method === 'POST') {
    // Check if this is a batch request (array) or single request
    const isBatch = Array.isArray(req.body);
    const entries: ScheduleEntry[] = isBatch ? req.body : [req.body];

    // Validate all entries have required fields
    for (const entry of entries) {
      const { level, group, section_num, course_code, time_slot, day, activity_type } = entry;
      if (!level || !group || !section_num || !course_code || !time_slot || !day || !activity_type) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields in one or more entries'
        });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const firstEntry = entries[0];
      const { level, group, course_code } = firstEntry;

      // Get or create schedule FIRST
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

      // TEST CASE 2: Check if course already exists in this level and group
      const courseExistsInGroup = await client.query(
        `SELECT c.course_code, co.course_name
         FROM contain c
         JOIN course co ON c.course_code = co.course_code
         WHERE c.schedule_id = $1 AND c.course_code = $2
         LIMIT 1`,
        [schedule_id, course_code]
      );

      if (courseExistsInGroup.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: `Course ${course_code} is already scheduled for Level ${level}, Group ${group}. Please select a different course or remove the existing schedule first.`
        });
      }

      // Get course info
      const courseInfo = await client.query(
        `SELECT lecture_hours, tutorial_hours, lab_hours, course_name FROM course WHERE course_code = $1`,
        [course_code]
      );

      if (courseInfo.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: `Course ${course_code} not found`
        });
      }

      // VALIDATE ALL ENTRIES BEFORE INSERTING ANY
      const validationErrors: string[] = [];
      const sectionNumbers = new Set<string>();

      for (const entry of entries) {
        const { section_num, activity_type, time_slot, day } = entry;

        // TEST CASE 1: Check if section number already exists globally
        const sectionExistsGlobal = await client.query(
          `SELECT s.level_num, s.group_num, sec.activity_type
           FROM contain c
           JOIN schedule s ON c.schedule_id = s.schedule_id
           JOIN section sec ON c.course_code = sec.course_code AND c.section_num = sec.section_number
           WHERE c.section_num = $1 AND sec.activity_type = $2
           LIMIT 1`,
          [section_num, activity_type]
        );

        if (sectionExistsGlobal.rows.length > 0) {
          const existing = sectionExistsGlobal.rows[0];
          validationErrors.push(
            `Section number ${section_num} for ${activity_type} already exists in Level ${existing.level_num}, Group ${existing.group_num}. Please enter a new section number.`
          );
          break;
        }

        // Track section numbers in this batch
        sectionNumbers.add(`${section_num}-${activity_type}`);

        // TEST CASE 3: Check for time slot conflicts
        const conflictCheck = await client.query(
          `SELECT c.course_code, co.course_name, s.activity_type 
           FROM contain c
           JOIN section s ON c.course_code = s.course_code AND c.section_num = s.section_number
           JOIN course co ON c.course_code = co.course_code
           WHERE c.schedule_id = $1 AND c.time_slot = $2 AND c.day = $3`,
          [schedule_id, time_slot, day]
        );

        if (conflictCheck.rows.length > 0) {
          const conflict = conflictCheck.rows[0];
          validationErrors.push(
            `Time slot conflict! ${conflict.course_code} - ${conflict.course_name} (${conflict.activity_type}) is already scheduled on ${day} at ${time_slot}. Please select a different time slot.`
          );
          break;
        }
      }

      // If ANY validation failed, rollback and return error
      if (validationErrors.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: validationErrors[0]
        });
      }

      // Validate hours for each activity type
      const activityGroups = entries.reduce((acc, entry) => {
        if (!acc[entry.activity_type]) acc[entry.activity_type] = [];
        acc[entry.activity_type].push(entry);
        return acc;
      }, {} as Record<string, ScheduleEntry[]>);

      for (const [activity_type, activityEntries] of Object.entries(activityGroups)) {
        const maxHours = activity_type === 'Lecture' ? courseInfo.rows[0].lecture_hours :
                         activity_type === 'Tutorial' ? courseInfo.rows[0].tutorial_hours :
                         courseInfo.rows[0].lab_hours;

        let totalHours = 0;
        for (const entry of activityEntries) {
          const [start, end] = entry.time_slot.split('-');
          const startHour = parseInt(start.split(':')[0]);
          const endHour = parseInt(end.split(':')[0]);
          totalHours += (endHour - startHour >= 1 ? 2 : 1);
        }

        if (totalHours > maxHours) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            error: `Cannot add ${activity_type} sessions. Maximum ${maxHours} hour(s) allowed. Attempting to add: ${totalHours} hour(s).`
          });
        }
      }

      // ALL VALIDATIONS PASSED - NOW INSERT ALL ENTRIES
      for (const entry of entries) {
        const { section_num, time_slot, day, activity_type, room, instructor } = entry;

        // Insert section
        await client.query(
          `INSERT INTO section (course_code, section_number, activity_type, hours_per_session, capacity)
           VALUES ($1, $2, $3, 1, 25)
           ON CONFLICT (course_code, section_number, activity_type)
           DO UPDATE SET hours_per_session = EXCLUDED.hours_per_session,
                         capacity = EXCLUDED.capacity`,
          [course_code, section_num, activity_type]
        );
        
        // Insert entry into contain table
        await client.query(
          `INSERT INTO contain(schedule_id, section_num, course_code, time_slot, day, room, instructor)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [schedule_id, section_num, course_code, time_slot, day, room || null, instructor || null]
        );
      }

      // Update schedule timestamp
      await client.query(
        `UPDATE schedule SET updated_at = NOW() WHERE schedule_id = $1`,
        [schedule_id]
      );

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        message: `Successfully added ${entries.length} session(s) for course ${course_code}`,
        schedule_id
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('Database error:', err);

      if (err.code === '23505') {
        return res.status(409).json({
          success: false,
          error: 'This time slot is already occupied. Please select a different time slot.'
        });
      }
      if (err.code === '23503') {
        return res.status(400).json({
          success: false,
          error: 'Invalid course code. Please verify the course exists.'
        });
      }
      res.status(500).json({
        success: false,
        error: 'Database error occurred. Please try again.'
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
        error: 'Missing required parameters'
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `DELETE FROM contain
         WHERE schedule_id = $1 AND course_code = $2
         RETURNING section_num`,
        [schedule_id, course_code]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: 'No schedule entries found for this course.'
        });
      }

      const deletedSections = Array.from(new Set(result.rows.map(row => row.section_num)));

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

      await client.query(
        `UPDATE schedule SET updated_at = NOW() WHERE schedule_id = $1`,
        [schedule_id]
      );

      await client.query('COMMIT');

      res.status(200).json({
        success: true,
        message: `Successfully deleted all sessions for course ${course_code}.`
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error deleting:', err);
      res.status(500).json({
        success: false,
        error: 'Database error occurred while deleting. Please try again.'
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