import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const { level } = req.query;
    const levelNum = parseInt(level as string);

    try {
      const result = await pool.query(
        `SELECT DISTINCT group_num FROM schedule WHERE level_num = $1 ORDER BY group_num`,
        [levelNum]
      );

      if (result.rows.length === 0) {
        // Auto-create Group 1 if no group exists for this level
        await pool.query(
          `INSERT INTO schedule (level_num, group_num, status, created_at, updated_at)
           VALUES ($1, 1, 'draft', NOW(), NOW())`,
          [levelNum]
        );
        return res.status(200).json({ success: true, groups: [{ group_num: 1 }] });
      }

      const groups = result.rows.map(row => ({ group_num: row.group_num }));
      res.status(200).json({ success: true, groups });
    } catch (error) {
      console.error('Error fetching groups:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch groups' });
    }

  } else if (req.method === 'POST') {
    const { level, numberOfGroups } = req.body;
    const levelNum = parseInt(level);

    if (!levelNum || !numberOfGroups) {
      return res.status(400).json({ success: false, error: 'Missing level or numberOfGroups' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existingGroups = await client.query(
        `SELECT DISTINCT group_num FROM schedule WHERE level_num = $1`,
        [levelNum]
      );
      const existingGroupNums = existingGroups.rows.map(row => row.group_num);

      for (let i = 1; i <= numberOfGroups; i++) {
        if (!existingGroupNums.includes(i)) {
          await client.query(
            `INSERT INTO schedule (level_num, group_num, status, created_at, updated_at)
             VALUES ($1, $2, 'draft', NOW(), NOW())`,
            [levelNum, i]
          );
        }
      }

      await client.query('COMMIT');
      res.status(200).json({ success: true, message: `Groups created for Level ${levelNum}` });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating groups:', error);
      res.status(500).json({ success: false, error: 'Failed to create groups' });
    } finally {
      client.release();
    }

  } else if (req.method === 'DELETE') {
    const { level, group } = req.query;
    const levelNum = parseInt(level as string);
    const groupNum = parseInt(group as string);

    if (!levelNum || !groupNum) {
      return res.status(400).json({ success: false, error: 'Missing level or group' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const scheduleResult = await client.query(
        `SELECT schedule_id FROM schedule WHERE level_num = $1 AND group_num = $2`,
        [levelNum, groupNum]
      );

      if (scheduleResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: 'Group not found' });
      }

      const scheduleId = scheduleResult.rows[0].schedule_id;

      await client.query(`DELETE FROM contain WHERE schedule_id = $1`, [scheduleId]);
      await client.query(`DELETE FROM schedule WHERE schedule_id = $1`, [scheduleId]);

      await client.query('COMMIT');
      res.status(200).json({
        success: true,
        message: `Group ${groupNum} deleted for Level ${levelNum}`,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error deleting group:', error);
      res.status(500).json({ success: false, error: 'Failed to delete group' });
    } finally {
      client.release();
    }

  } else {
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
  }
}
