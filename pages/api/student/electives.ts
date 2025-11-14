import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { level } = req.query;

    console.log(`[Student Electives API] Request received for level: ${level}`);

    // Use the SAME query logic as elective-survey-results.ts
    // Query elective courses from the course table where is_elective = true
    // The survey results shows all electives (groups by level but doesn't filter)
    // For students, show electives at the selected level OR electives with NULL level (available for all)
    let query = `
      SELECT 
        c.course_code,
        c.course_name,
        c.level,
        c.is_elective,
        c.credits,
        c.lecture,
        c.tutorial,
        c.lab
      FROM course c
      WHERE c.is_elective = true
    `;

    const params: any[] = [];
    
    // Filter by level if provided
    // Show electives at the selected level OR electives with NULL level (available for all levels)
    let result;
    if (level) {
      const levelNum = parseInt(level as string);
      if (!isNaN(levelNum)) {
        let levelQuery = query + ` AND (c.level = $1 OR c.level IS NULL)`;
        console.log(`[Student Electives API] Executing level-filtered query with params:`, [levelNum]);
        result = await pool.query(levelQuery + ` ORDER BY c.level NULLS LAST, c.course_code`, [levelNum]);
        console.log(`[Student Electives API] Found ${result.rows.length} elective courses for level ${levelNum}`);
        
        // If no results for the specific level, show all electives (they might be available across levels)
        if (result.rows.length === 0) {
          console.log(`[Student Electives API] No electives for level ${levelNum}, showing all electives`);
          result = await pool.query(query + ` ORDER BY c.level NULLS LAST, c.course_code`, []);
        }
      } else {
        result = await pool.query(query + ` ORDER BY c.level NULLS LAST, c.course_code`, []);
      }
    } else {
      // No level specified, show all electives
      console.log(`[Student Electives API] No level specified, showing all electives`);
      result = await pool.query(query + ` ORDER BY c.level NULLS LAST, c.course_code`, []);
    }
    
    console.log(`[Student Electives API] Final result: ${result.rows.length} elective courses`);

    // Map the results to match the expected format
    const courses = result.rows.map((row: any) => ({
      course_code: row.course_code,
      course_name: row.course_name,
      level: row.level,
      is_elective: row.is_elective,
      credits: row.credits,
      lecture: row.lecture,
      tutorial: row.tutorial,
      lab: row.lab,
      // For backward compatibility with the frontend, provide these as 0 if not available
      lecture_hours: 0,
      tutorial_hours: 0,
      lab_hours: 0
    }));

    console.log(`[Student Electives API] Returning ${courses.length} courses`);
    res.status(200).json({
      success: true,
      courses: courses
    });
  } catch (err: any) {
    console.error('[Student Electives API] Database error:', err);
    res.status(500).json({
      success: false,
      error: 'Database error occurred',
      details: err.message
    });
  }
}

