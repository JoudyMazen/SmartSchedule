import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { level, excludeSWE } = req.query;

  try {
    let query = `
      SELECT course_code, course_name, level, is_elective, credits,
             lecture_hours, tutorial_hours, lab_hours
      FROM course
    `;
    const params: any[] = [];

    // ✅ Add conditions dynamically
    const conditions: string[] = [];

    if (level) {
      conditions.push(`level = $${params.length + 1}`);
      params.push(level);
    }

    // ✅ Exclude SWE courses if requested
    if (excludeSWE === 'true') {
      conditions.push(`course_code NOT LIKE 'SWE%'`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }

    query += ` ORDER BY level, course_code`;

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
