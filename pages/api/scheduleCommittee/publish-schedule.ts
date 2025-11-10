// pages/api/scheduleCommittee/publish-schedule.ts
// ✅ ENHANCED VERSION - Adds dual publishing + version control to your working file

import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

// Helper function to get current schedule snapshot
async function getScheduleSnapshot(client: any, schedule_id: number) {
  const scheduleResult = await client.query(
    `SELECT schedule_id, level_num, group_num, status FROM schedule WHERE schedule_id = $1`,
    [schedule_id]
  );

  if (scheduleResult.rows.length === 0) {
    return null;
  }

  const schedule = scheduleResult.rows[0];

  const sessionsResult = await client.query(
    `SELECT 
       c.section_num,
       c.course_code,
       COALESCE(co.course_name, c.course_code) as course_name,
       sec.activity_type,
       c.time_slot,
       c.day,
       c.room,
       c.instructor
     FROM contain c
     LEFT JOIN course co ON c.course_code = co.course_code
     LEFT JOIN section sec ON c.course_code = sec.course_code AND c.section_num = sec.section_number
     WHERE c.schedule_id = $1
     ORDER BY c.day, c.time_slot`,
    [schedule_id]
  );

  return {
    schedule_id: schedule.schedule_id,
    level_num: schedule.level_num,
    group_num: schedule.group_num,
    status: schedule.status,
    sessions: sessionsResult.rows
  };
}

// Helper function to create version snapshot
async function createVersionSnapshot(
  client: any, 
  schedule_id: number, 
  level: number, 
  group: number,
  action_type: string,
  created_by?: number
) {
  try {
    // Get current schedule snapshot
    const currentSnapshot = await getScheduleSnapshot(client, schedule_id);
    if (!currentSnapshot) {
      return { success: false, error: 'Schedule not found' };
    }

    // Get the last version number
    const lastVersionResult = await client.query(
      `SELECT version_number 
       FROM schedule_version 
       WHERE schedule_id = $1 
       ORDER BY version_number DESC 
       LIMIT 1`,
      [schedule_id]
    );

    let versionNumber = 1;
    if (lastVersionResult.rows.length > 0) {
      versionNumber = lastVersionResult.rows[0].version_number + 1;
    }

    // Generate change summary based on action type
    let changeSummary: string;
    if (action_type === 'publish_to_teaching_load') {
      changeSummary = `Published to Teaching Load Committee for review (Version ${versionNumber})`;
    } else if (action_type === 'publish_to_faculty_students') {
      changeSummary = `Published to Faculty and Students (Version ${versionNumber})`;
    } else {
      changeSummary = `Published schedule for Level ${level}, Group ${group} (Version ${versionNumber})`;
    }

    // Store the version (full snapshot)
    await client.query(
      `INSERT INTO schedule_version 
       (schedule_id, version_number, changes, change_summary, created_by, action_type, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        schedule_id,
        versionNumber,
        JSON.stringify(currentSnapshot), // Store full snapshot
        changeSummary,
        created_by || null,
        action_type
      ]
    );

    return { success: true, version_number: versionNumber };
  } catch (error) {
    console.error('Error creating version snapshot:', error);
    return { success: false, error: 'Failed to create version snapshot' };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} Not Allowed`
    });
  }

  const { level, group, publish_to, created_by } = req.body;

  if (!level) {
    return res.status(400).json({
      success: false,
      message: 'Level is required'
    });
  }

  // ✅ Determine target audience and action type
  // publish_to can be: 'faculty_students', 'teaching_load', or undefined (defaults to 'faculty_students')
  const targetAudience = publish_to || 'faculty_students';
  const action_type = targetAudience === 'teaching_load' 
    ? 'publish_to_teaching_load' 
    : 'publish_to_faculty_students';

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ✅ STEP 1: Get schedules to publish
    let scheduleQuery: string;
    let scheduleParams: any[];

  // Around line 68-77
if (group) {
  // Single group
  scheduleQuery = `
    SELECT schedule_id, group_num, status
    FROM schedule
    WHERE level_num = $1 AND group_num = $2
    AND LOWER(status) IN ('draft', 'active', 'published', 'under_review', 'archived')
  `;
  scheduleParams = [level, group];
} else {
  // All groups for the level
  scheduleQuery = `
    SELECT schedule_id, group_num, status
    FROM schedule
    WHERE level_num = $1
    AND LOWER(status) IN ('draft', 'active', 'published', 'under_review', 'archived')
  `;
  scheduleParams = [level];
}
    const schedulesToPublish = await client.query(scheduleQuery, scheduleParams);

    if (schedulesToPublish.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: `No schedules found for Level ${level}${group ? `, Group ${group}` : ''}`
      });
    }

    // ✅ STEP 2: Create version snapshots for each schedule
    const versionResults = [];
    for (const schedule of schedulesToPublish.rows) {
      const versionResult = await createVersionSnapshot(
        client,
        schedule.schedule_id,
        level,
        schedule.group_num,
        action_type,
        created_by
      );
      
      if (versionResult.success) {
        versionResults.push({
          schedule_id: schedule.schedule_id,
          group_num: schedule.group_num,
          version_number: versionResult.version_number
        });
      }
    }

    // ✅ STEP 3: Update schedule status based on target audience
const newStatus = targetAudience === 'teaching_load' ? 'under_review' : 'published';

    
    let updateQuery: string;
    let updateParams: any[];

    if (group) {
      updateQuery = `
        UPDATE schedule
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE level_num = $2 AND group_num = $3
        AND LOWER(status) IN ('draft', 'active', 'published', 'under_review')
      `;
      updateParams = [newStatus, level, group];
    } else {
      updateQuery = `
        UPDATE schedule
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE level_num = $2
        AND LOWER(status) IN ('draft', 'active', 'published', 'under_review')
      `;
      updateParams = [newStatus, level];
    }

    const updateResult = await client.query(updateQuery, updateParams);

    await client.query('COMMIT');

    // ✅ STEP 4: Return success with version info
    const audienceName = targetAudience === 'teaching_load' 
      ? 'Teaching Load Committee' 
      : 'Faculty and Students';

    return res.status(200).json({
      success: true,
      message: `Successfully published ${updateResult.rowCount} schedule(s) for Level ${level} to ${audienceName}`,
      publishedCount: updateResult.rowCount,
      versions_created: versionResults.length,
      version_details: versionResults,
      published_to: targetAudience,
      new_status: newStatus
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error publishing schedule:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
}