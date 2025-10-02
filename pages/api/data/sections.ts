import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
  }

  const { course_code } = req.query;

  if (!course_code) {
    return res.status(400).json({
      success: false,
      error: 'course_code parameter is required'
    });
  }

  try {
    const query = `
      SELECT section_id, section_number, course_code, activity_type, 
             hours_per_session, status, capacity, enrolled
      FROM section
      WHERE course_code = $1
      ORDER BY section_number
    `;

    const result = await pool.query(query, [course_code]);

    res.status(200).json({
      success: true,
      sections: result.rows
    });

  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({
      success: false,
      error: 'Database error occurred'
    });
  }
}