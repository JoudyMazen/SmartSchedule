import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    // Fetch all schedule versions for a specific level
    const { level } = req.query;

    if (!level) {
      return res.status(400).json({ success: false, error: 'level is required' });
    }

    try {
      const result = await pool.query(`
        SELECT 
          schedule_id,
          level_num,
          group_num,
          status,
          created_at,
          updated_at
        FROM schedule
        WHERE level_num = $1
        ORDER BY updated_at DESC, created_at DESC
      `, [level]);

      return res.status(200).json({ 
        success: true, 
        versions: result.rows 
      });
    } catch (error) {
      console.error('Error fetching schedule versions:', error);
      return res.status(500).json({ success: false, error: 'Database error' });
    }
  }

  if (req.method === 'POST') {
    // Create a new schedule version
    const { level, group, status } = req.body;

    if (!level || !group) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: level, group' 
      });
    }

    try {
      const result = await pool.query(`
        INSERT INTO schedule (level_num, group_num, status)
        VALUES ($1, $2, $3)
        RETURNING schedule_id, level_num, group_num, status, created_at, updated_at
      `, [level, group, status || 'draft']);

      return res.status(201).json({ 
        success: true, 
        message: 'Schedule version created successfully',
        schedule: result.rows[0]
      });
    } catch (error) {
      console.error('Error creating schedule version:', error);
      return res.status(500).json({ success: false, error: 'Database error' });
    }
  }

  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
}

