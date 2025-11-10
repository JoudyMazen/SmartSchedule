import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed`
    });
  }

  try {
    const { level } = req.query;

    // Ensure elective_preferences table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS elective_preferences (
        preference_id SERIAL PRIMARY KEY,
        student_id INT NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
        level INT NOT NULL,
        course_code TEXT NOT NULL REFERENCES course(course_code) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id, course_code)
      )
    `);

    // Debug: Check if table has any data
    const countResult = await pool.query(`
      SELECT COUNT(*) as total_count 
      FROM elective_preferences
    `);
    console.log(`Analytics API: Total preferences in database: ${countResult.rows[0].total_count}`);
    
    if (level) {
      const levelCountResult = await pool.query(`
        SELECT COUNT(*) as level_count 
        FROM elective_preferences 
        WHERE level = $1
      `, [parseInt(level as string)]);
      console.log(`Analytics API: Preferences for level ${level}: ${levelCountResult.rows[0].level_count}`);
    }

    let query: string;
    let params: any[];

    if (level) {
      // Get preferences for a specific level
      // Use LEFT JOIN to include preferences even if course data is missing
      query = `
        SELECT 
          ep.level,
          ep.course_code,
          MAX(COALESCE(c.course_name, ep.course_code)) as course_name,
          COUNT(DISTINCT ep.student_id) as student_count
        FROM elective_preferences ep
        LEFT JOIN course c ON ep.course_code = c.course_code
        WHERE ep.level = $1
        GROUP BY ep.level, ep.course_code
        HAVING COUNT(DISTINCT ep.student_id) > 0
        ORDER BY student_count DESC, course_name ASC
      `;
      params = [parseInt(level as string)];
    } else {
      // Get preferences for all levels
      // Use LEFT JOIN to include preferences even if course data is missing
      query = `
        SELECT 
          ep.level,
          ep.course_code,
          MAX(COALESCE(c.course_name, ep.course_code)) as course_name,
          COUNT(DISTINCT ep.student_id) as student_count
        FROM elective_preferences ep
        LEFT JOIN course c ON ep.course_code = c.course_code
        GROUP BY ep.level, ep.course_code
        HAVING COUNT(DISTINCT ep.student_id) > 0
        ORDER BY ep.level ASC, student_count DESC, course_name ASC
      `;
      params = [];
    }

    const result = await pool.query(query, params);

    console.log(`Analytics API: Found ${result.rows.length} preference records${level ? ` for level ${level}` : ' across all levels'}`);

    // Group by level
    const levelMap = new Map<number, any[]>();
    
    result.rows.forEach((row: any) => {
      const levelNum = parseInt(row.level);
      if (!levelMap.has(levelNum)) {
        levelMap.set(levelNum, []);
      }
      levelMap.get(levelNum)!.push({
        course_code: row.course_code,
        course_name: row.course_name || row.course_code,
        student_count: parseInt(row.student_count) || 0
      });
    });

    // Convert to array format expected by DashboardCharts
    const data = Array.from(levelMap.entries()).map(([level, courses]) => ({
      level,
      courses
    }));

    console.log(`Analytics API: Returning ${data.length} level(s) with preferences`);

    return res.status(200).json({
      success: true,
      data: data,
      totalRecords: result.rows.length
    });
  } catch (error: any) {
    console.error('Error fetching student preferences:', error);
    return res.status(500).json({
      success: false,
      error: 'Database error',
      message: error.message
    });
  }
}

