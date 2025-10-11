import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    // Get feedback for a specific user and schedule
    const { user_id, schedule_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ success: false, error: 'user_id is required' });
    }

    try {
      let query = `
        SELECT gf.*, u.first_name, u.last_name
        FROM give_feedback gf
        JOIN "user" u ON gf.user_id = u.user_id
        WHERE gf.user_id = $1
      `;
      const params = [user_id];

      if (schedule_id) {
        query += ` AND gf.schedule_id = $2`;
        params.push(schedule_id);
      }

      query += ` ORDER BY gf.created_at DESC`;

      const result = await pool.query(query, params);
      res.status(200).json({ success: true, feedbacks: result.rows });
    } catch (err) {
      console.error('Database error:', err);
      res.status(500).json({ success: false, error: 'Database error' });
    }
  } else if (req.method === 'POST') {
    // Submit new feedback - same structure as Teaching Load
    const { schedule_id, user_id, comment, feedback_type, level, rating } = req.body;

    if (!user_id || !comment || !feedback_type) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: user_id, comment, feedback_type' 
      });
    }

    try {
      // Use the same table as Teaching Load for consistency
      const result = await pool.query(`
        INSERT INTO teaching_load_feedback (schedule_id, user_id, comment, feedback_type, level, rating)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING feedback_id, schedule_id, user_id, comment, feedback_type, level, rating, created_at
      `, [schedule_id || null, user_id, comment, feedback_type, level || null, rating || null]);

      res.status(201).json({ 
        success: true, 
        message: 'Feedback submitted successfully',
        feedback: result.rows[0]
      });
    } catch (err) {
      console.error('Database error:', err);
      res.status(500).json({ success: false, error: 'Database error' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }
}
