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

    
    let baseQuery = `
      SELECT 
        c.course_code,
        c.course_name,
        c.level,
        c.is_elective,
        c.credits
      FROM course c
      WHERE c.is_elective = true
    `;

    const params: any[] = [];
    let result;

    if (level) {
      const levelNum = parseInt(level as string);
      if (!isNaN(levelNum)) {
        let levelQuery = baseQuery + ` AND (c.level = $1 OR c.level IS NULL)`;
        console.log(
          `[Student Electives API] Executing level-filtered query with params:`,
          [levelNum]
        );
        result = await pool.query(
          levelQuery + ` ORDER BY c.level NULLS LAST, c.course_code`,
          [levelNum]
        );
        console.log(
          `[Student Electives API] Found ${result.rows.length} elective courses for level ${levelNum}`
        );

        
        if (result.rows.length === 0) {
          console.log(
            `[Student Electives API] No electives for level ${levelNum}, showing all electives`
          );
          result = await pool.query(
            baseQuery + ` ORDER BY c.level NULLS LAST, c.course_code`,
            []
          );
        }
      } else {
        result = await pool.query(
          baseQuery + ` ORDER BY c.level NULLS LAST, c.course_code`,
          []
        );
      }
    } else {
      console.log(
        `[Student Electives API] No level specified, showing all electives`
      );
      result = await pool.query(
        baseQuery + ` ORDER BY c.level NULLS LAST, c.course_code`,
        []
      );
    }

    console.log(
      `[Student Electives API] Final result: ${result.rows.length} elective courses`
    );

    
    const courses = result.rows.map((row: any) => ({
      course_code: row.course_code,
      course_name: row.course_name,
      level: row.level,
      is_elective: row.is_elective,
      credits: row.credits ?? 0,
      lecture: 0,
      tutorial: 0,
      lab: 0,
      lecture_hours: 0,
      tutorial_hours: 0,
      lab_hours: 0,
    }));

    console.log(`[Student Electives API] Returning ${courses.length} courses`);

    res.status(200).json({
      success: true,
      courses,
    });
  } catch (err: any) {
    console.error('[Student Electives API] Database error:', err);
    res.status(500).json({
      success: false,
      error: 'Database error occurred',
      details: err.message,
    });
  }
}