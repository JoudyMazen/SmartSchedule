import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/database';

interface ApiResponse {
  success?: boolean;
  error?: string;
  message?: string;
  schedule_id?: number;
  entry?: any;
  failedField?: string; // NEW: indicates which field has the error
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  const { method } = req;

  if (method === 'POST') {
    // Handle batch insert (array of entries)
    if (Array.isArray(req.body)) {
      return handleBatchInsert(req.body, res);
    }

    // Handle single entry insert
    const { level, group, section_num, course_code, time_slot, day, room, instructor, activity_type } = req.body;

    if (!level || !group || !section_num || !course_code || !time_slot || !day || !activity_type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

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

      // TEST CASE 3: Check if section number already exists for ANY activity type of this course
      const sectionExistsForCourse = await client.query(
        `SELECT sec.activity_type
         FROM section sec
         WHERE sec.course_code = $1 AND sec.section_number = $2`,
        [course_code, section_num]
      );

      if (sectionExistsForCourse.rows.length > 0) {
        const existing = sectionExistsForCourse.rows[0];
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: `Section number ${section_num} is already used for ${existing.activity_type} of course ${course_code}. Each section number must be unique across all activity types.`,
          failedField: `${activity_type.toLowerCase()}Section`
        });
      }

      // TEST CASE 1: Check if section number already exists globally
      const sectionExistsGlobal = await client.query(
        `SELECT s.level_num, s.group_num, sec.activity_type, sec.course_code
         FROM contain c
         JOIN schedule s ON c.schedule_id = s.schedule_id
         JOIN section sec ON c.course_code = sec.course_code AND c.section_num = sec.section_number
         WHERE c.section_num = $1 AND sec.activity_type = $2
         LIMIT 1`,
        [section_num, activity_type]
      );

      if (sectionExistsGlobal.rows.length > 0) {
        const existing = sectionExistsGlobal.rows[0];
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: `Section number ${section_num} for ${activity_type} already exists in Level ${existing.level_num}, Group ${existing.group_num}. Please enter a new section number.`,
          failedField: `${activity_type.toLowerCase()}Section`
        });
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
          error: `Course ${course_code} is already scheduled for Level ${level}, Group ${group}. Please select a different course or remove the existing schedule first.`,
          failedField: 'general'
        });
      }

      // Get course max hours
      const courseInfo = await client.query(
        `SELECT lecture_hours, tutorial_hours, lab_hours, course_name FROM course WHERE course_code = $1`,
        [course_code]
      );

      if (courseInfo.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: `Course ${course_code} not found`,
          failedField: 'general'
        });
      }

      const maxHours = activity_type === 'Lecture' ? courseInfo.rows[0].lecture_hours :
                       activity_type === 'Tutorial' ? courseInfo.rows[0].tutorial_hours :
                       courseInfo.rows[0].lab_hours;

      // Calculate total existing hours for this activity type
      const existingSessions = await client.query(
        `SELECT c.time_slot
         FROM contain c
         JOIN section s ON c.course_code = s.course_code AND c.section_num = s.section_number
         WHERE c.schedule_id = $1 AND c.course_code = $2 AND s.activity_type = $3`,
        [schedule_id, course_code, activity_type]
      );

      let totalExistingHours = 0;
      for (const row of existingSessions.rows) {
        const [start, end] = row.time_slot.split('-');
        const startHour = parseInt(start.split(':')[0]);
        const endHour = parseInt(end.split(':')[0]);
        totalExistingHours += (endHour - startHour >= 1 ? 2 : 1);
      }

      const [newStart, newEnd] = time_slot.split('-');
      const newStartHour = parseInt(newStart.split(':')[0]);
      const newEndHour = parseInt(newEnd.split(':')[0]);
      const newSessionHours = (newEndHour - newStartHour >= 1 ? 2 : 1);

      if (totalExistingHours + newSessionHours > maxHours) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: `Cannot add ${activity_type} session. Maximum ${maxHours} hour(s) allowed. Currently scheduled: ${totalExistingHours} hour(s). Attempting to add: ${newSessionHours} hour(s).`,
          failedField: `${activity_type.toLowerCase()}Sessions`
        });
      }

      // TEST CASE 2 (NEW): Check for time slot conflicts including adjacent slots
      const conflictCheck = await client.query(
        `SELECT c.course_code, co.course_name, s.activity_type, c.time_slot
         FROM contain c
         JOIN section s ON c.course_code = s.course_code AND c.section_num = s.section_number
         JOIN course co ON c.course_code = co.course_code
         WHERE c.schedule_id = $1 AND c.day = $2`,
        [schedule_id, day]
      );

      for (const existing of conflictCheck.rows) {
        const [existStart, existEnd] = existing.time_slot.split('-');
        const existStartHour = parseInt(existStart.split(':')[0]);
        const existStartMin = parseInt(existStart.split(':')[1]);
        const existEndHour = parseInt(existEnd.split(':')[0]);
        const existEndMin = parseInt(existEnd.split(':')[1]);

        const newStartMin = parseInt(newStart.split(':')[1]);
        const newEndMin = parseInt(newEnd.split(':')[1]);

        const existStartTime = existStartHour * 60 + existStartMin;
        const existEndTime = existEndHour * 60 + existEndMin;
        const newStartTime = newStartHour * 60 + newStartMin;
        const newEndTime = newEndHour * 60 + newEndMin;

        // Check for overlap: new session starts before existing ends AND new session ends after existing starts
        if (newStartTime < existEndTime && newEndTime > existStartTime) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            success: false,
            error: `Time slot conflict! ${existing.course_code} - ${existing.course_name} (${existing.activity_type}) is already scheduled on ${day} at ${existing.time_slot}. Please select a different time slot.`,
            failedField: 'general'
          });
        }
      }

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
          error: 'This time slot is already occupied. Please select a different time slot.',
          failedField: 'general'
        });
      }
      if (err.code === '23503') {
        return res.status(400).json({
          success: false,
          error: 'Invalid course code. Please verify the course exists.',
          failedField: 'general'
        });
      }
      res.status(500).json({
        success: false,
        error: 'Database error occurred. Please try again.',
        failedField: 'general'
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

// NEW: Handle batch insert with atomic transaction
async function handleBatchInsert(entries: any[], res: NextApiResponse<ApiResponse>) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const level = entries[0].level;
    const group = entries[0].group;
    const course_code = entries[0].course_code;

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

    // Check if course already exists
    const courseExistsInGroup = await client.query(
      `SELECT c.course_code FROM contain c WHERE c.schedule_id = $1 AND c.course_code = $2 LIMIT 1`,
      [schedule_id, course_code]
    );

    if (courseExistsInGroup.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: `Course ${course_code} is already scheduled for Level ${level}, Group ${group}. Please select a different course or remove the existing schedule first.`,
        failedField: 'general'
      });
    }

    // Validate section numbers are unique ACROSS DIFFERENT activity types only
    const activitySections = new Map<string, number>();
    
    for (const entry of entries) {
      const activityType = entry.activity_type;
      const sectionNum = entry.section_num;
      
      // If we haven't seen this activity type yet, record its section number
      if (!activitySections.has(activityType)) {
        activitySections.set(activityType, sectionNum);
      }
      // If we have seen this activity type, verify it uses the same section number
      else if (activitySections.get(activityType) !== sectionNum) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: `All sessions of the same activity type must use the same section number. Found different section numbers for ${activityType}.`,
          failedField: 'general'
        });
      }
    }
    
    // Now check if different activity types are using the same section number
    const sectionNumbersUsed = Array.from(activitySections.values());
    const uniqueSectionSet = new Set(sectionNumbersUsed);
    
    if (sectionNumbersUsed.length !== uniqueSectionSet.size) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Each activity type must have a unique section number. Please use different section numbers for Lecture, Tutorial, and Lab.',
        failedField: 'general'
      });
    }

    // Validate each entry
    for (const entry of entries) {
      // Check section number uniqueness globally
      const sectionExists = await client.query(
        `SELECT s.level_num, s.group_num, sec.activity_type, sec.course_code
         FROM contain c
         JOIN schedule s ON c.schedule_id = s.schedule_id
         JOIN section sec ON c.course_code = sec.course_code AND c.section_num = sec.section_number
         WHERE c.section_num = $1
         LIMIT 1`,
        [entry.section_num]
      );

      if (sectionExists.rows.length > 0) {
        const existing = sectionExists.rows[0];
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: `Section number ${entry.section_num} already exists in Level ${existing.level_num}, Group ${existing.group_num} for ${existing.activity_type}. Please enter a new section number.`,
          failedField: `${entry.activity_type.toLowerCase()}Section`
        });
      }

      // Check for time conflicts with ALL existing sessions on the same day
      const conflictCheck = await client.query(
        `SELECT c.course_code, co.course_name, s.activity_type, c.time_slot
         FROM contain c
         JOIN section s ON c.course_code = s.course_code AND c.section_num = s.section_number
         JOIN course co ON c.course_code = co.course_code
         WHERE c.schedule_id = $1 AND c.day = $2`,
        [schedule_id, entry.day]
      );

      const [newStart, newEnd] = entry.time_slot.split('-');
      const newStartHour = parseInt(newStart.split(':')[0]);
      const newStartMin = parseInt(newStart.split(':')[1]);
      const newEndHour = parseInt(newEnd.split(':')[0]);
      const newEndMin = parseInt(newEnd.split(':')[1]);
      const newStartTime = newStartHour * 60 + newStartMin;
      const newEndTime = newEndHour * 60 + newEndMin;

      for (const existing of conflictCheck.rows) {
        const [existStart, existEnd] = existing.time_slot.split('-');
        const existStartHour = parseInt(existStart.split(':')[0]);
        const existStartMin = parseInt(existStart.split(':')[1]);
        const existEndHour = parseInt(existEnd.split(':')[0]);
        const existEndMin = parseInt(existEnd.split(':')[1]);
        const existStartTime = existStartHour * 60 + existStartMin;
        const existEndTime = existEndHour * 60 + existEndMin;

        if (newStartTime < existEndTime && newEndTime > existStartTime) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            success: false,
            error: `Time slot conflict! ${existing.course_code} - ${existing.course_name} (${existing.activity_type}) is already scheduled on ${entry.day} at ${existing.time_slot}. Your ${entry.activity_type} at ${entry.time_slot} overlaps.`,
            failedField: 'general'
          });
        }
      }
 
      // Check for conflicts within the batch itself
      for (const otherEntry of entries) {
        if (entry === otherEntry) continue;
        if (entry.day !== otherEntry.day) continue;

        const [otherStart, otherEnd] = otherEntry.time_slot.split('-');
        const otherStartHour = parseInt(otherStart.split(':')[0]);
        const otherStartMin = parseInt(otherStart.split(':')[1]);
        const otherEndHour = parseInt(otherEnd.split(':')[0]);
        const otherEndMin = parseInt(otherEnd.split(':')[1]);
        const otherStartTime = otherStartHour * 60 + otherStartMin;
        const otherEndTime = otherEndHour * 60 + otherEndMin;

        if (newStartTime < otherEndTime && newEndTime > otherStartTime) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            success: false,
            error: `Time slot conflict within your selections! ${entry.activity_type} at ${entry.time_slot} overlaps with ${otherEntry.activity_type} at ${otherEntry.time_slot} on ${entry.day}.`,
            failedField: 'general'
          });
        }
      }
    }

    // If all validations pass, insert all entries
    for (const entry of entries) {
      await client.query(
        `INSERT INTO section (course_code, section_number, activity_type, hours_per_session, capacity)
         VALUES ($1, $2, $3, 1, 25)
         ON CONFLICT (course_code, section_number, activity_type)
         DO UPDATE SET hours_per_session = EXCLUDED.hours_per_session`,
        [entry.course_code, entry.section_num, entry.activity_type]
      );

      await client.query(
        `INSERT INTO contain(schedule_id, section_num, course_code, time_slot, day, room, instructor)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [schedule_id, entry.section_num, entry.course_code, entry.time_slot, entry.day, entry.room || null, entry.instructor || null]
      );
    }

    await client.query(
      `UPDATE schedule SET updated_at = NOW() WHERE schedule_id = $1`,
      [schedule_id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'All schedule entries added successfully',
      schedule_id
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Batch insert error:', err);
    res.status(500).json({
      success: false,
      error: 'Database error occurred. Please try again.',
      failedField: 'general'
    });
  } finally {
    client.release();
  }
}