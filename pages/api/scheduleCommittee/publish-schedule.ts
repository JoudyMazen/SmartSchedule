// pages/api/scheduleCommittee/publish-schedule.ts
// ✅ ENHANCED VERSION - Publishes ALL LEVELS together with cross-level version control

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

// ✅ NEW: Create a cross-level version that includes ALL schedules
async function createCrossLevelVersion(
  client: any,
  action_type: string,
  created_by?: number
) {
  try {
    // Get ALL schedules across all levels
    const allSchedulesResult = await client.query(
      `SELECT schedule_id, level_num, group_num, status 
       FROM schedule 
       WHERE LOWER(status) IN ('draft', 'active', 'published', 'under_review', 'archived')
       ORDER BY level_num, group_num`
    );

    if (allSchedulesResult.rows.length === 0) {
      return { success: false, error: 'No schedules found' };
    }

    // Build a comprehensive snapshot of ALL schedules
    const allSchedulesSnapshot: any = {
      levels: {}
    };

    for (const schedule of allSchedulesResult.rows) {
      const snapshot = await getScheduleSnapshot(client, schedule.schedule_id);
      if (snapshot) {
        const levelKey = `level_${schedule.level_num}`;
        if (!allSchedulesSnapshot.levels[levelKey]) {
          allSchedulesSnapshot.levels[levelKey] = {
            level_num: schedule.level_num,
            groups: {}
          };
        }
        
        const groupKey = `group_${schedule.group_num}`;
        allSchedulesSnapshot.levels[levelKey].groups[groupKey] = snapshot;
      }
    }

    // Get the last global version number
    const lastVersionResult = await client.query(
      `SELECT MAX(version_number) as max_version 
       FROM schedule_version 
       WHERE schedule_id IN (
         SELECT schedule_id FROM schedule 
         WHERE LOWER(status) IN ('draft', 'active', 'published', 'under_review', 'archived')
       )`
    );

    let versionNumber = 1;
    if (lastVersionResult.rows[0].max_version) {
      versionNumber = lastVersionResult.rows[0].max_version + 1;
    }

    // Generate change summary
    const levelCount = Object.keys(allSchedulesSnapshot.levels).length;
    const totalGroups = allSchedulesResult.rows.length;
    
    let changeSummary: string;
    if (action_type === 'publish_to_teaching_load') {
      changeSummary = `Published ALL schedules to Teaching Load Committee (${levelCount} levels, ${totalGroups} groups) - Version ${versionNumber}`;
    } else if (action_type === 'publish_to_faculty_students') {
      changeSummary = `Published ALL schedules to Faculty and Students (${levelCount} levels, ${totalGroups} groups) - Version ${versionNumber}`;
    } else {
      changeSummary = `Published all schedules (${levelCount} levels, ${totalGroups} groups) - Version ${versionNumber}`;
    }

    // Create version record for EACH schedule with the SAME version number
    for (const schedule of allSchedulesResult.rows) {
      await client.query(
        `INSERT INTO schedule_version 
         (schedule_id, version_number, changes, change_summary, created_by, action_type, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          schedule.schedule_id,
          versionNumber,
          JSON.stringify(allSchedulesSnapshot), // Store FULL cross-level snapshot
          changeSummary,
          created_by || null,
          action_type
        ]
      );
    }

    return { 
      success: true, 
      version_number: versionNumber,
      levels_count: levelCount,
      groups_count: totalGroups
    };
  } catch (error) {
    console.error('Error creating cross-level version:', error);
    return { success: false, error: 'Failed to create cross-level version' };
  }
}

// Helper function to create notifications
async function createNotificationsForPublishedSchedule(
  client: any,
  targetAudience: string,
  versionNumber: number,
  levelsCount: number,
  groupsCount: number
) {
  try {
    // Ensure notifications table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        notification_id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        link TEXT,
        read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const title = `All Schedules Published - ${levelsCount} Levels, ${groupsCount} Groups`;
    const message = `All schedules have been published (Version ${versionNumber}). This includes ${levelsCount} levels with ${groupsCount} total groups. Please review and provide feedback if needed.`;

    // Define role-specific links
    const roleLinks: { [key: string]: string } = {
      'student': `/studentHomePage`,
      'faculty': `/facultyHomePage`,
      'teaching_load_committee': `/teachingLoadCommittee/teachingLoadCommitteeHomePage`,
      'scheduling_committee': `/scheduleCommittee/scheduleCommitteeHomePage`
    };

    let targetRoles: string[] = [];
    
    if (targetAudience === 'teaching_load') {
      targetRoles = ['teaching_load_committee'];
    } else if (targetAudience === 'faculty_students') {
      targetRoles = ['faculty', 'student', 'teaching_load_committee'];
    }

    // Create notifications for all users with target roles
    for (const role of targetRoles) {
      const usersResult = await client.query(
        `SELECT user_id FROM "user" WHERE role = $1`,
        [role]
      );

      const link = roleLinks[role] || `/scheduleCommittee/scheduleCommitteeHomePage`;

      for (const user of usersResult.rows) {
        // Check for duplicates
        const existingNotification = await client.query(`
          SELECT notification_id 
          FROM notifications 
          WHERE user_id = $1 
            AND type = $2 
            AND title = $3 
            AND created_at > NOW() - INTERVAL '5 minutes'
          LIMIT 1
        `, [user.user_id, 'publish', title]);

        if (existingNotification.rows.length === 0) {
          await client.query(
            `INSERT INTO notifications (user_id, type, title, message, link)
             VALUES ($1, $2, $3, $4, $5)`,
            [user.user_id, 'publish', title, message, link]
          );
        }
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error creating notifications:', error);
    return { success: false, error: 'Failed to create notifications' };
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

  // ✅ Note: level and group parameters are now OPTIONAL
  // If not provided, publish ALL levels together

  // ✅ Determine target audience and action type
  const targetAudience = publish_to || 'faculty_students';
  const action_type = targetAudience === 'teaching_load' 
    ? 'publish_to_teaching_load' 
    : 'publish_to_faculty_students';

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ✅ STEP 1: Determine which schedules to publish
    let scheduleQuery: string;
    let scheduleParams: any[];
    let isPublishingAll = false;

    if (level && group) {
      // Single level, single group
      scheduleQuery = `
        SELECT schedule_id, level_num, group_num, status
        FROM schedule
        WHERE level_num = $1 AND group_num = $2
        AND LOWER(status) IN ('draft', 'active', 'published', 'under_review', 'archived')
      `;
      scheduleParams = [level, group];
    } else if (level) {
      // Single level, all groups
      scheduleQuery = `
        SELECT schedule_id, level_num, group_num, status
        FROM schedule
        WHERE level_num = $1
        AND LOWER(status) IN ('draft', 'active', 'published', 'under_review', 'archived')
      `;
      scheduleParams = [level];
    } else {
      // ✅ ALL LEVELS, ALL GROUPS
      isPublishingAll = true;
      scheduleQuery = `
        SELECT schedule_id, level_num, group_num, status
        FROM schedule
        WHERE LOWER(status) IN ('draft', 'active', 'published', 'under_review', 'archived')
        ORDER BY level_num, group_num
      `;
      scheduleParams = [];
    }

    const schedulesToPublish = await client.query(scheduleQuery, scheduleParams);

    if (schedulesToPublish.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: level 
          ? `No schedules found for Level ${level}${group ? `, Group ${group}` : ''}`
          : 'No schedules found to publish'
      });
    }

    // ✅ STEP 2: Create cross-level version
    const versionResult = await createCrossLevelVersion(
      client,
      action_type,
      created_by
    );

    if (!versionResult.success) {
      await client.query('ROLLBACK');
      return res.status(500).json({
        success: false,
        message: 'Failed to create version snapshot',
        error: versionResult.error
      });
    }

    // ✅ STEP 3: Update schedule status
    const newStatus = targetAudience === 'teaching_load' ? 'under_review' : 'published';
    
    let updateQuery: string;
    let updateParams: any[];

    if (level && group) {
      updateQuery = `
        UPDATE schedule
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE level_num = $2 AND group_num = $3
        AND LOWER(status) IN ('draft', 'active', 'published', 'under_review')
      `;
      updateParams = [newStatus, level, group];
    } else if (level) {
      updateQuery = `
        UPDATE schedule
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE level_num = $2
        AND LOWER(status) IN ('draft', 'active', 'published', 'under_review')
      `;
      updateParams = [newStatus, level];
    } else {
      // ✅ Update ALL schedules
      updateQuery = `
        UPDATE schedule
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE LOWER(status) IN ('draft', 'active', 'published', 'under_review')
      `;
      updateParams = [newStatus];
    }

    const updateResult = await client.query(updateQuery, updateParams);

    // ✅ STEP 4: Create notifications
    if (targetAudience === 'faculty_students' || targetAudience === 'teaching_load') {
      await createNotificationsForPublishedSchedule(
        client,
        targetAudience,
        versionResult.version_number || 1,
        versionResult.levels_count || 0,
        versionResult.groups_count || 0
      );
    }

    await client.query('COMMIT');

    // ✅ STEP 5: Return success
    const audienceName = targetAudience === 'teaching_load' 
      ? 'Teaching Load Committee' 
      : 'Faculty and Students';

    return res.status(200).json({
      success: true,
      message: isPublishingAll
        ? `Successfully published ALL schedules (${versionResult.levels_count} levels, ${versionResult.groups_count} groups) to ${audienceName}`
        : `Successfully published ${updateResult.rowCount} schedule(s) for Level ${level} to ${audienceName}`,
      publishedCount: updateResult.rowCount,
      version_number: versionResult.version_number,
      levels_count: versionResult.levels_count,
      groups_count: versionResult.groups_count,
      published_to: targetAudience,
      new_status: newStatus,
      published_all: isPublishingAll
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