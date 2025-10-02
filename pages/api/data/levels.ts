import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
  }

  try {
    const result = await pool.query(`
      SELECT level_num, array_agg(group_num ORDER BY group_num) as groups
      FROM schedule
      GROUP BY level_num
      ORDER BY level_num
    `);

    res.status(200).json({ success: true, levels: result.rows });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
}