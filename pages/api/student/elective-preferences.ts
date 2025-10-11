import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { studentId, level, electiveIds } = req.body;

    if (!studentId || !level || !electiveIds || !Array.isArray(electiveIds)) {
      return res.status(400).json({ 
        success: false, 
        error: 'studentId, level, and electiveIds array are required' 
      });
    }

    try {
      // First, delete existing preferences for this student
      await pool.query(`
        DELETE FROM elective_preferences 
        WHERE student_id = $1
      `, [studentId]);

      // Insert new preferences
      if (electiveIds.length > 0) {
        const values = electiveIds.map((electiveId: string, index: number) => 
          `($1, $2, $${index + 3})`
        ).join(', ');
        
        const params = [studentId, level, ...electiveIds];
        
        await pool.query(`
          INSERT INTO elective_preferences (student_id, level, course_code)
          VALUES ${values}
        `, params);
      }

      res.status(201).json({ 
        success: true, 
        message: 'Elective preferences submitted successfully',
        preferences: {
          studentId,
          level,
          electiveIds
        }
      });
    } catch (err) {
      console.error('Database error:', err);
      res.status(500).json({ success: false, error: 'Database error' });
    }
  } else if (req.method === 'GET') {
    // Get preferences for a specific student
    const { studentId } = req.query;

    if (!studentId) {
      return res.status(400).json({ success: false, error: 'studentId is required' });
    }

    try {
      const result = await pool.query(`
        SELECT ep.*, c.course_name
        FROM elective_preferences ep
        JOIN course c ON ep.course_code = c.course_code
        WHERE ep.student_id = $1
        ORDER BY ep.created_at DESC
      `, [studentId]);

      res.status(200).json({ success: true, preferences: result.rows });
    } catch (err) {
      console.error('Database error:', err);
      res.status(500).json({ success: false, error: 'Database error' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }
}
