import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { level, group } = req.query;

  // GET: Fetch groups for a level
  if (req.method === 'GET') {
    if (!level) {
      return res.status(400).json({ success: false, error: 'level is required' });
    }

    try {
      // ✅ Fetch distinct groups for the given level
      const result = await pool.query(`
        SELECT DISTINCT group_num
        FROM schedule
        WHERE level_num = $1
        ORDER BY group_num ASC
      `, [level]);

      // ✅ Return groups in the format expected by the frontend
      return res.status(200).json({ 
        success: true, 
        groups: result.rows  // This will be [{group_num: 1}, {group_num: 2}, ...]
      });
    } catch (error) {
      console.error('Error fetching groups:', error);
      return res.status(500).json({ success: false, error: 'Database error' });
    }
  }

  // POST: Create new groups for a level
  if (req.method === 'POST') {
    const { level, numberOfGroups } = req.body;

    if (!level || !numberOfGroups) {
      return res.status(400).json({ 
        success: false, 
        error: 'level and numberOfGroups are required' 
      });
    }

    try {
      const createdGroups = [];

      // Create schedule entries for each group
      for (let i = 1; i <= numberOfGroups; i++) {
        const result = await pool.query(`
          INSERT INTO schedule (level_num, group_num, status)
          VALUES ($1, $2, 'draft')
          ON CONFLICT (level_num, group_num) DO NOTHING
          RETURNING schedule_id, level_num, group_num, status
        `, [level, i]);

        if (result.rows.length > 0) {
          createdGroups.push(result.rows[0]);
        }
      }

      return res.status(201).json({ 
        success: true, 
        message: `Successfully created ${createdGroups.length} group(s)`,
        groups: createdGroups
      });
    } catch (error) {
      console.error('Error creating groups:', error);
      return res.status(500).json({ success: false, error: 'Database error' });
    }
  }

  // DELETE: Delete a specific group
  if (req.method === 'DELETE') {
    if (!level || !group) {
      return res.status(400).json({ 
        success: false, 
        error: 'level and group are required' 
      });
    }

    try {
      // First, delete all entries in the contain table for this schedule
      await pool.query(`
        DELETE FROM contain 
        WHERE schedule_id IN (
          SELECT schedule_id 
          FROM schedule 
          WHERE level_num = $1 AND group_num = $2
        )
      `, [level, group]);

      // Then delete the schedule itself
      const result = await pool.query(`
        DELETE FROM schedule
        WHERE level_num = $1 AND group_num = $2
        RETURNING schedule_id
      `, [level, group]);

      if (result.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Group not found' 
        });
      }

      return res.status(200).json({ 
        success: true, 
        message: `Successfully deleted group ${group} for level ${level}`
      });
    } catch (error) {
      console.error('Error deleting group:', error);
      return res.status(500).json({ success: false, error: 'Database error' });
    }
  }

  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
}