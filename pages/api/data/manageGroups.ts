import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    // Get all groups for a level
    const { level } = req.query;
    
    try {
      const result = await pool.query(
        `SELECT DISTINCT group_num FROM schedule WHERE level_num = $1 ORDER BY group_num`,
        [level]
      );
      
      const groups = result.rows.map(row => row.group_num);
      res.status(200).json({ success: true, groups: groups.length > 0 ? groups : [1] });
    } catch (error) {
      console.error('Error fetching groups:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch groups' });
    }
  } else if (req.method === 'POST') {
    // Create new group(s) for a level
    const { level, numberOfGroups } = req.body;
    
    if (!level || !numberOfGroups) {
      return res.status(400).json({ success: false, error: 'Missing level or numberOfGroups' });
    }
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Get existing groups
      const existingGroups = await client.query(
        `SELECT DISTINCT group_num FROM schedule WHERE level_num = $1`,
        [level]
      );
      
      const existingGroupNums = existingGroups.rows.map(row => row.group_num);
      
      // Create missing groups (only create schedule records, not populate with courses)
      for (let i = 1; i <= numberOfGroups; i++) {
        if (!existingGroupNums.includes(i)) {
          await client.query(
            `INSERT INTO schedule (level_num, group_num, status, created_at, updated_at)
             VALUES ($1, $2, 'draft', NOW(), NOW())`,
            [level, i]
          );
        }
      }
      
      await client.query('COMMIT');
      res.status(200).json({ success: true, message: `Groups created for Level ${level}` });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating groups:', error);
      res.status(500).json({ success: false, error: 'Failed to create groups' });
    } finally {
      client.release();
    }
  } else if (req.method === 'DELETE') {
    // Delete a specific group
    const { level, group } = req.query;
    
    if (!level || !group) {
      return res.status(400).json({ success: false, error: 'Missing level or group' });
    }
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Get schedule_id for this level and group
      const scheduleResult = await client.query(
        `SELECT schedule_id FROM schedule WHERE level_num = $1 AND group_num = $2`,
        [level, group]
      );
      
      if (scheduleResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: 'Group not found' });
      }
      
      const scheduleId = scheduleResult.rows[0].schedule_id;
      
      // Delete all entries in contain table for this schedule
      await client.query(
        `DELETE FROM contain WHERE schedule_id = $1`,
        [scheduleId]
      );
      
      // Delete the schedule itself
      await client.query(
        `DELETE FROM schedule WHERE schedule_id = $1`,
        [scheduleId]
      );
      
      await client.query('COMMIT');
      res.status(200).json({ 
        success: true, 
        message: `Group ${group} deleted for Level ${level}` 
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