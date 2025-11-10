import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { studentId, level, electiveIds } = req.body;

    if (!studentId || !level || !electiveIds || !Array.isArray(electiveIds)) {
      return res.status(400).json({ 
        success: false, 
        error: 'studentId, level, and electiveIds array are required' 
      });
    }

    // Remove duplicates from electiveIds array
    const uniqueElectiveIds = [...new Set(electiveIds)].filter(id => id && id.trim() !== '');

    if (uniqueElectiveIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'At least one valid elective course must be selected' 
      });
    }

    // Ensure table exists (outside transaction to avoid issues)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS elective_preferences (
          preference_id SERIAL PRIMARY KEY,
          student_id INT NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
          level INT NOT NULL,
          course_code TEXT NOT NULL REFERENCES course(course_code) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Try to create unique constraint - ignore if it already exists
      try {
        await pool.query(`
          ALTER TABLE elective_preferences 
          ADD CONSTRAINT elective_preferences_student_id_course_code_key 
          UNIQUE (student_id, course_code)
        `);
      } catch (constraintErr: any) {
        // Constraint already exists (42710) or other constraint error - that's fine
        if (constraintErr.code !== '42710' && constraintErr.code !== '42P16') {
          // 42710 = duplicate_object, 42P16 = invalid_table_definition
          console.warn('Constraint creation warning (may already exist):', constraintErr.message);
        }
      }
    } catch (tableErr: any) {
      // Table might already exist - that's fine
      if (tableErr.code !== '42P07') {
        console.error('Error creating table:', tableErr);
      }
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Delete existing preferences for this student for the courses being submitted
      // Since the unique constraint is on (student_id, course_code) without level,
      // we need to delete existing preferences for these courses to avoid conflicts
      if (uniqueElectiveIds.length > 0) {
        const coursePlaceholders = uniqueElectiveIds.map((_, idx) => `$${idx + 2}`).join(', ');
        await client.query(`
          DELETE FROM elective_preferences 
          WHERE student_id = $1 AND course_code IN (${coursePlaceholders})
        `, [studentId, ...uniqueElectiveIds]);
      }

      // Insert new preferences
      // Since we deleted above, we shouldn't have conflicts, but use ON CONFLICT as safety net
      if (uniqueElectiveIds.length > 0) {
        const values = uniqueElectiveIds.map((_, index) => 
          `($1, $2, $${index + 3})`
        ).join(', ');
        
        const params = [studentId, level, ...uniqueElectiveIds];
        
        await client.query(`
          INSERT INTO elective_preferences (student_id, level, course_code)
          VALUES ${values}
          ON CONFLICT (student_id, course_code) 
          DO UPDATE SET 
            level = EXCLUDED.level,
            created_at = CURRENT_TIMESTAMP
        `, params);
      }

      await client.query('COMMIT');

      res.status(201).json({ 
        success: true, 
        message: 'Elective preferences submitted successfully',
        preferences: {
          studentId,
          level,
          electiveIds: uniqueElectiveIds
        }
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('Database error:', err);
      
      // Provide more specific error messages
      if (err.code === '23505') {
        return res.status(409).json({ 
          success: false, 
          error: 'Duplicate preference detected. Please try again.',
          details: err.message 
        });
      }
      
      if (err.code === '23503') {
        return res.status(400).json({ 
          success: false, 
          error: 'One or more selected courses are invalid or do not exist.',
          details: err.message 
        });
      }

      return res.status(500).json({ 
        success: false, 
        error: 'Database error occurred while saving preferences',
        details: err.message 
      });
    } finally {
      client.release();
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
