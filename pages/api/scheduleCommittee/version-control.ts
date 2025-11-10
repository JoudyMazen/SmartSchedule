// pages/api/scheduleCommittee/version-control.ts
import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';
import * as jsondiffpatch from 'jsondiffpatch';

interface VersionRecord {
  version_id: number;
  schedule_id: number;
  version_number: number;
  changes: any;
  change_summary: string;
  created_by: number;
  created_at: string;
  action_type: string;
}

interface ScheduleSnapshot {
  schedule_id: number;
  level_num: number;
  group_num: number;
  status: string;
  sessions: Array<{
    section_num: number;
    course_code: string;
    course_name: string;
    activity_type: string;
    time_slot: string;
    day: string;
    room?: string;
    instructor?: string;
  }>;
}

// Initialize jsondiffpatch
const differ = jsondiffpatch.create({
  objectHash: (obj: any) => obj.section_num + obj.course_code + obj.day + obj.time_slot,
  arrays: {
    detectMove: true,
    includeValueOnMove: false
  },
});

// GET - Fetch version history for a schedule
async function handleGetVersions(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { schedule_id, level, group } = req.query;

    let query: string;
    let params: any[];

    if (schedule_id) {
      // Fetch by schedule_id
      query = `
        SELECT 
          v.version_id,
          v.schedule_id,
          v.version_number,
          v.changes,
          v.change_summary,
          v.created_by,
          v.created_at,
          v.action_type,
          u.first_name,
          u.last_name,
          u.role,
          s.level_num,
          s.group_num
        FROM schedule_version v
        LEFT JOIN users u ON v.created_by = u.user_id
        LEFT JOIN schedule s ON v.schedule_id = s.schedule_id
        WHERE v.schedule_id = $1
        ORDER BY v.version_number DESC
      `;
      params = [schedule_id];
    } else if (level && group) {
  query = `
    SELECT 
      v.version_id,
      v.schedule_id,
      v.version_number,
      v.changes,
      v.change_summary,
      v.created_by,
      v.created_at,
      v.action_type,
      s.level_num,
      s.group_num
    FROM schedule_version v
    JOIN schedule s ON v.schedule_id = s.schedule_id
    WHERE s.level_num = $1 AND s.group_num = $2
    ORDER BY v.version_number DESC
  `;
  params = [level, group];


    } else {
      return res.status(400).json({
        success: false,
        error: 'Either schedule_id or (level and group) is required'
      });
    }
console.log('🔎 Getting version history for', { schedule_id, level, group });

    const result = await pool.query(query, params);

// 🔧 Convert any 'changes' text to JSON object safely
const versions = result.rows.map((v: any) => ({
  ...v,
  changes: typeof v.changes === 'string' ? JSON.parse(v.changes) : v.changes
}));

res.status(200).json({
  success: true,
  versions,
  total: versions.length
});

  } catch (error) {
    console.error('Error fetching version history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch version history'
    });
  }
}

// POST - Create a new version snapshot
async function handleCreateVersion(req: NextApiRequest, res: NextApiResponse) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { schedule_id, created_by, action_type, custom_summary } = req.body;

    if (!schedule_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'schedule_id is required'
      });
    }

    // Get current schedule snapshot
    const currentSnapshot = await getScheduleSnapshot(client, schedule_id);

    if (!currentSnapshot) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Schedule not found'
      });
    }

    // Get the last version for comparison
    const lastVersionResult = await client.query(
      `SELECT version_number, changes 
       FROM schedule_version 
       WHERE schedule_id = $1 
       ORDER BY version_number DESC 
       LIMIT 1`,
      [schedule_id]
    );

    let versionNumber = 1;
    let previousSnapshot: ScheduleSnapshot | null = null;
    let delta: any = null;

    if (lastVersionResult.rows.length > 0) {
      versionNumber = lastVersionResult.rows[0].version_number + 1;
      
      // Reconstruct previous snapshot from stored changes
      previousSnapshot = await reconstructSnapshot(client, schedule_id, versionNumber - 1);
      
      // Calculate diff between previous and current
      if (previousSnapshot) {
        delta = differ.diff(previousSnapshot, currentSnapshot);
      }
    } else {
      // First version - store entire snapshot as "added"
      delta = differ.diff({}, currentSnapshot);
    }

    // Generate change summary
    const changeSummary = custom_summary || generateChangeSummary(delta, currentSnapshot);

    // Store the version
    const insertResult = await client.query(
      `INSERT INTO schedule_version 
       (schedule_id, version_number, changes, change_summary, created_by, action_type, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING version_id, version_number, created_at`,
      [
        schedule_id,
        versionNumber,
        JSON.stringify(delta),
        changeSummary,
        created_by || null,
        action_type || 'manual_edit'
      ]
    );

    // Update schedule's updated_at timestamp
    await client.query(
      `UPDATE schedule SET updated_at = NOW() WHERE schedule_id = $1`,
      [schedule_id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Version created successfully',
      version: {
        version_id: insertResult.rows[0].version_id,
        version_number: insertResult.rows[0].version_number,
        created_at: insertResult.rows[0].created_at,
        change_summary: changeSummary
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating version:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create version'
    });
  } finally {
    client.release();
  }
}

// PUT - Restore a specific version
async function handleRestoreVersion(req: NextApiRequest, res: NextApiResponse) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { version_id, restored_by } = req.body;

    if (!version_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'version_id is required'
      });
    }

    // Get the version to restore
    const versionResult = await client.query(
      `SELECT schedule_id, version_number 
       FROM schedule_version 
       WHERE version_id = $1`,
      [version_id]
    );

    if (versionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Version not found'
      });
    }

    const { schedule_id, version_number } = versionResult.rows[0];

    // Reconstruct the snapshot for this version
    const restoredSnapshot = await reconstructSnapshot(client, schedule_id, version_number);

    if (!restoredSnapshot) {
      await client.query('ROLLBACK');
      return res.status(500).json({
        success: false,
        error: 'Failed to reconstruct version snapshot'
      });
    }

    // Delete current schedule entries (only SWE courses)
    // ✅ Delete all current sessions for this schedule (full restore)
await client.query(
  `DELETE FROM contain 
   WHERE schedule_id = $1`,
  [schedule_id]
);


    // Restore the sessions from the snapshot
    for (const session of restoredSnapshot.sessions) {
      // Ensure section exists
      await client.query(
        `INSERT INTO section (course_code, section_number, activity_type, hours_per_session, capacity)
         VALUES ($1, $2, $3, 1, 25)
         ON CONFLICT (course_code, section_number, activity_type) DO NOTHING`,
        [session.course_code, session.section_num, session.activity_type]
      );

      // Insert session
      await client.query(
        `INSERT INTO contain (schedule_id, section_num, course_code, time_slot, day, room, instructor)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          schedule_id,
          session.section_num,
          session.course_code,
          session.time_slot,
          session.day,
          session.room || null,
          session.instructor || null
        ]
      );
    }

    // Create a new version record for the restoration
    const lastVersionResult = await client.query(
      `SELECT MAX(version_number) as max_version FROM schedule_version WHERE schedule_id = $1`,
      [schedule_id]
    );

    const newVersionNumber = (lastVersionResult.rows[0].max_version || 0) + 1;

    await client.query(
      `INSERT INTO schedule_version 
       (schedule_id, version_number, changes, change_summary, created_by, action_type, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        schedule_id,
        newVersionNumber,
        JSON.stringify({ restored_from_version: version_number }),
        `Restored from Version ${version_number}`,
        restored_by || null,
        'restore'
      ]
    );

    // Update schedule status and timestamp
    await client.query(
      `UPDATE schedule 
       SET status = 'draft', updated_at = NOW() 
       WHERE schedule_id = $1`,
      [schedule_id]
    );

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: `Successfully restored to Version ${version_number}`,
      new_version_number: newVersionNumber
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error restoring version:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to restore version'
    });
  } finally {
    client.release();
  }
}

// Helper function to get current schedule snapshot
async function getScheduleSnapshot(client: any, schedule_id: number): Promise<ScheduleSnapshot | null> {
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

// Helper function to reconstruct a snapshot from version history
// Helper function to reconstruct a snapshot from version history
async function reconstructSnapshot(
  client: any,
  schedule_id: number,
  target_version: number
): Promise<ScheduleSnapshot | null> {
  // Get all versions up to target version
  const versionsResult = await client.query(
    `SELECT version_number, changes 
     FROM schedule_version 
     WHERE schedule_id = $1 AND version_number <= $2
     ORDER BY version_number ASC`,
    [schedule_id, target_version]
  );

  if (versionsResult.rows.length === 0) {
    return null;
  }

  // Get schedule metadata
  const scheduleResult = await client.query(
    `SELECT schedule_id, level_num, group_num FROM schedule WHERE schedule_id = $1`,
    [schedule_id]
  );

  if (scheduleResult.rows.length === 0) {
    return null;
  }

  // Start with empty snapshot
  let snapshot: any = {
    schedule_id: scheduleResult.rows[0].schedule_id,
    level_num: scheduleResult.rows[0].level_num,
    group_num: scheduleResult.rows[0].group_num,
    status: 'draft',
    sessions: []
  };

  // ✅ FIX: If any version already stores the full snapshot (has sessions array), use it directly
  for (const versionRow of versionsResult.rows) {
    const delta = typeof versionRow.changes === 'string'
      ? JSON.parse(versionRow.changes)
      : versionRow.changes;

    if (delta?.sessions) {
      // This is a full snapshot (from publish API)
      snapshot = delta;
    } else if (delta) {
      // Otherwise apply the delta patch
      snapshot = jsondiffpatch.patch(snapshot, delta);
    }
  }

  return snapshot;
}

// Helper function to generate human-readable change summary
function generateChangeSummary(delta: any, currentSnapshot: ScheduleSnapshot): string {
  if (!delta) {
    return 'No changes detected';
  }

  const changes: string[] = [];

  // Check for added sessions
  if (delta.sessions) {
    const addedCount = Object.keys(delta.sessions).filter(key => {
      const change = delta.sessions[key];
      return Array.isArray(change) && change.length === 1;
    }).length;

    if (addedCount > 0) {
      changes.push(`${addedCount} session(s) added`);
    }

    // Check for removed sessions
    const removedCount = Object.keys(delta.sessions).filter(key => {
      const change = delta.sessions[key];
      return Array.isArray(change) && change.length === 3 && change[2] === 0;
    }).length;

    if (removedCount > 0) {
      changes.push(`${removedCount} session(s) removed`);
    }

    // Check for modified sessions
    const modifiedCount = Object.keys(delta.sessions).filter(key => {
      const change = delta.sessions[key];
      return !Array.isArray(change) || (Array.isArray(change) && change.length === 2);
    }).length;

    if (modifiedCount > 0) {
      changes.push(`${modifiedCount} session(s) modified`);
    }
  }

  // Check for status change
  if (delta.status) {
    changes.push(`Status changed to ${currentSnapshot.status}`);
  }

  return changes.length > 0 ? changes.join(', ') : 'Schedule updated';
}

// Main handler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  switch (method) {
    case 'GET':
      return handleGetVersions(req, res);
    case 'POST':
      return handleCreateVersion(req, res);
    case 'PUT':
      return handleRestoreVersion(req, res);
    default:
      res.setHeader('Allow', ['GET', 'POST', 'PUT']);
      res.status(405).json({
        success: false,
        error: `Method ${method} Not Allowed`
      });
  }
}