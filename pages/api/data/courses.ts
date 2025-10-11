import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { level, excludeSWE, is_elective } = req.query;

  try {
    let query = `
      SELECT course_code, course_name, level, is_elective, credits,
             lecture_hours, tutorial_hours, lab_hours
      FROM course
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    // ✅ Filter by elective status if requested
    if (is_elective === 'true') {
      conditions.push(`is_elective = true`);
    } else if (level) {
      // ✅ When filtering by level, exclude electives
      conditions.push(`level = $${params.length + 1}`);
      params.push(level);
      conditions.push(`(is_elective = false OR is_elective IS NULL)`);
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