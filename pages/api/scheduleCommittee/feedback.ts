import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { level, role, feedback_type, rating, schedule_id } = req.query;

      // Build query with filters
      let query = `
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
        WHERE 1=1
      `;
      
      const params: any[] = [];
      let paramIndex = 1;

      // Filter by level
      if (level) {
        query += ` AND f.level = $${paramIndex}`;
        params.push(parseInt(level as string));
        paramIndex++;
      }

      // Filter by role
      if (role) {
        query += ` AND u.role = $${paramIndex}`;
        params.push(role as string);
        paramIndex++;
      }

      // Filter by feedback type
      if (feedback_type) {
        query += ` AND f.feedback_type = $${paramIndex}`;
        params.push(feedback_type as string);
        paramIndex++;
      }

      // Filter by rating
      if (rating) {
        query += ` AND f.rating = $${paramIndex}`;
        params.push(parseInt(rating as string));
        paramIndex++;
      }

      // Filter by schedule_id
      if (schedule_id) {
        query += ` AND f.schedule_id = $${paramIndex}`;
        params.push(parseInt(schedule_id as string));
        paramIndex++;
      }

      query += ` ORDER BY f.created_at DESC`;

      const result = await pool.query(query, params);

      return res.status(200).json({
        success: true,
        feedbacks: result.rows,
        filters: {
          level: level || null,
          role: role || null,
          feedback_type: feedback_type || null,
          rating: rating || null,
          schedule_id: schedule_id || null
        }
      });

    } catch (error) {
      console.error('Error fetching feedback:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { feedback_ids } = req.body;

      if (!feedback_ids || !Array.isArray(feedback_ids) || feedback_ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'feedback_ids array is required'
        });
      }

      // Delete multiple feedbacks
      const placeholders = feedback_ids.map((_, index) => `$${index + 1}`).join(', ');
      const result = await pool.query(
        `DELETE FROM teaching_load_feedback 
         WHERE feedback_id IN (${placeholders})`,
        feedback_ids
      );

      return res.status(200).json({
        success: true,
        message: `Successfully deleted ${result.rowCount} feedback(s)`,
        deletedCount: result.rowCount
      });
    } catch (error) {
      console.error('Error deleting feedback:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  res.setHeader('Allow', ['GET', 'DELETE']);
  return res.status(405).json({
    success: false,
    message: `Method ${req.method} Not Allowed`
  });
}
