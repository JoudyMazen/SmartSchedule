import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    // Get user from request (could be from cookie, header, or query param)
    // For now, we'll check role from user_id if provided, otherwise allow access
    // In production, you should use proper authentication middleware
    const { user_id } = req.query;

    // If user_id is provided, verify they have scheduling_committee role
    if (user_id) {
      const userResult = await pool.query(
        `SELECT role FROM "user" WHERE user_id = $1`,
        [user_id]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      if (userResult.rows[0].role !== 'scheduling_committee') {
        return res.status(403).json({ 
          success: false, 
          error: 'Access denied. Only scheduling committee members can view survey results.' 
        });
      }
    }

    // Aggregate elective survey results
    // Get all elective preferences grouped by course_code and level
    const result = await pool.query(`
      SELECT 
        ep.course_code as "electiveCode",
        c.course_name as "electiveName",
        ep.level,
        COUNT(DISTINCT ep.student_id) as "studentsCount"
      FROM elective_preferences ep
      JOIN course c ON ep.course_code = c.course_code
      WHERE c.is_elective = true
      GROUP BY ep.course_code, c.course_name, ep.level
      ORDER BY ep.level, "studentsCount" DESC, ep.course_code
    `);

    const surveyResults = result.rows.map((row: any) => ({
      electiveCode: row.electiveCode,
      electiveName: row.electiveName,
      level: row.level,
      studentsCount: parseInt(row.studentsCount || '0')
    }));

    res.status(200).json({
      success: true,
      results: surveyResults
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({
      success: false,
      error: 'Database error occurred'
    });
  }
}

