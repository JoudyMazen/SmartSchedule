import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    // Fetch feedbacks for a specific level
    const { level } = req.query;

    try {
      const result = await pool.query(`
        SELECT 
          f.feedback_id, 
          f.schedule_id, 
          f.user_id, 
          f.comment, 
          f.feedback_type, 
          f.created_at,
          u.first_name || ' ' || u.last_name as user_name
        FROM teaching_load_feedback f
        JOIN "user" u ON f.user_id = u.user_id
        WHERE f.level = $1
        ORDER BY f.created_at DESC
        LIMIT 50
      `, [level]);

      return res.status(200).json({ success: true, feedbacks: result.rows });
    } catch (error) {
      console.error('Error fetching feedbacks:', error);
      return res.status(500).json({ success: false, error: 'Database error' });
    }
  }

  if (req.method === 'POST') {
    // Submit new feedback
    const { schedule_id, user_id, comment, feedback_type, level } = req.body;

    if (!user_id || !comment || !feedback_type) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: user_id, comment, feedback_type' 
      });
    }

    try {
      // First, ensure the teaching_load_feedback table exists
      await pool.query(`
        CREATE TABLE IF NOT EXISTS teaching_load_feedback (
          feedback_id SERIAL PRIMARY KEY,
          schedule_id INT,
          user_id INT REFERENCES "user"(user_id) ON DELETE CASCADE,
          comment TEXT NOT NULL,
          feedback_type TEXT NOT NULL,
          level INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const result = await pool.query(`
        INSERT INTO teaching_load_feedback (schedule_id, user_id, comment, feedback_type, level)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING feedback_id, schedule_id, user_id, comment, feedback_type, level, created_at
      `, [schedule_id || null, user_id, comment, feedback_type, level || null]);

      return res.status(201).json({ 
        success: true, 
        message: 'Feedback submitted successfully',
        feedback: result.rows[0]
      });
    } catch (error) {
      console.error('Error submitting feedback:', error);
      return res.status(500).json({ success: false, error: 'Database error' });
    }
  }

  if (req.method === 'DELETE') {
    // Delete feedback (admin only)
    const { feedback_id } = req.query;

    if (!feedback_id) {
      return res.status(400).json({ success: false, error: 'feedback_id is required' });
    }

    try {
      await pool.query('DELETE FROM teaching_load_feedback WHERE feedback_id = $1', [feedback_id]);
      return res.status(200).json({ success: true, message: 'Feedback deleted successfully' });
    } catch (error) {
      console.error('Error deleting feedback:', error);
      return res.status(500).json({ success: false, error: 'Database error' });
    }
  }

  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
}

