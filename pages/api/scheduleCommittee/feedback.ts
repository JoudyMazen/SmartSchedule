import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} Not Allowed`
    });
  }

  try {
    // Fetch all feedback with user information
    const result = await pool.query(`
      SELECT 
        f.feedback_id,
        f.schedule_id,
        f.user_id,
        f.comment,
        f.feedback_type,
        f.rating,
        f.level,
        f.created_at,
        u.first_name,
        u.last_name,
        u.role,
        sch.level_num,
        sch.group_num,
        sch.status
      FROM teaching_load_feedback f
      JOIN "user" u ON f.user_id = u.user_id
      LEFT JOIN schedule sch ON f.schedule_id = sch.schedule_id
      ORDER BY f.created_at DESC
    `);

    return res.status(200).json({
      success: true,
      feedbacks: result.rows
    });

  } catch (error) {
    console.error('Error fetching feedback:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}
