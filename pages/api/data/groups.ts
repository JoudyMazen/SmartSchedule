// pages/api/data/groups.ts
import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed`
    });
  }

  try {
    const { level } = req.query;
    
    if (!level) {
      return res.status(400).json({
        success: false,
        error: 'Level parameter is required'
      });
    }

    const query = `
      SELECT DISTINCT group_num 
      FROM schedule 
      WHERE level_num = $1 
      ORDER BY group_num
    `;
    
    const result = await pool.query(query, [level]);
    const groups = result.rows.map(row => row.group_num);
    
    res.status(200).json({
      success: true,
      groups: groups.length > 0 ? groups : [1],  // Default to [1] if no groups exist
      level: parseInt(level as string)
    });
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({
      success: false,
      error: 'Database error occurred'
    });
  }
}