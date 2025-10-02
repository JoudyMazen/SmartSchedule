import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/database'; // Three levels up: data -> api -> pages -> lib

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { level } = req.query;

  try {
    let query: string;
    let params: any[] = [];

    if (level) {
      query = `
        SELECT course_code, course_name, level, is_elective, credits
        FROM course
        WHERE level = $1
        ORDER BY course_code
      `;
      params = [level];
    } else {
      query = `
        SELECT course_code, course_name, level, is_elective, credits
        FROM course
        ORDER BY level, course_code
      `;
    }

    const result = await pool.query(query, params);

    res.status(200).json({
      success: true,
      courses: result.rows
    });

  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({
      success: false,
      error: 'Database error occurred'
    });
  }
}