import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { level, excludeSWE, schedule_id, is_elective } = req.query;

  const client = await pool.connect();
  
  try {
    // If is_elective=true is requested, return only elective courses
    if (is_elective === 'true') {
      let electiveQuery = `
        SELECT course_code, course_name, level, is_elective, credits,
               lecture_hours, tutorial_hours, lab_hours
        FROM course
        WHERE is_elective = true
      `;
      
      const electiveParams: any[] = [];
      let paramIndex = 1;
      
      // Filter by level if provided
      if (level) {
        electiveQuery += ` AND level = $${paramIndex}`;
        electiveParams.push(parseInt(level as string));
        paramIndex++;
      }
      
      if (excludeSWE === 'true') {
        electiveQuery += ` AND course_code NOT LIKE 'SWE%'`;
      }

      // Exclude courses already scheduled
      if (schedule_id) {
        electiveQuery += ` AND course_code NOT IN (
          SELECT DISTINCT course_code 
          FROM contain 
          WHERE schedule_id = $${paramIndex}
        )`;
        electiveParams.push(schedule_id);
      }

      const electivesResult = await client.query(electiveQuery, electiveParams);
      client.release();
      
      return res.status(200).json({
        success: true,
        courses: electivesResult.rows
      });
    }

    // First, get all courses for the requested level (required courses)
    let query = `
      SELECT course_code, course_name, level, is_elective, credits,
             lecture_hours, tutorial_hours, lab_hours
      FROM course
      WHERE level = $1 AND (is_elective = false OR is_elective IS NULL)
    `;
    
    const params: any[] = [level];
    
    if (excludeSWE === 'true') {
      query += ` AND course_code NOT LIKE 'SWE%'`;
    }

    // Exclude courses already scheduled
    if (schedule_id) {
      query += ` AND course_code NOT IN (
        SELECT DISTINCT course_code 
        FROM contain 
        WHERE schedule_id = $${params.length + 1}
      )`;
      params.push(schedule_id);
    }

    const requiredCoursesResult = await client.query(query, params);
    const courses = [...requiredCoursesResult.rows];

    // Now get elective courses (level can be null or any level)
    let electiveQuery = `
      SELECT course_code, course_name, level, is_elective, credits,
             lecture_hours, tutorial_hours, lab_hours
      FROM course
      WHERE is_elective = true
    `;
    
    const electiveParams: any[] = [];
    
    if (excludeSWE === 'true') {
      electiveQuery += ` AND course_code NOT LIKE 'SWE%'`;
    }

    // Exclude courses already scheduled
    if (schedule_id) {
      electiveQuery += ` AND course_code NOT IN (
        SELECT DISTINCT course_code 
        FROM contain 
        WHERE schedule_id = $${electiveParams.length + 1}
      )`;
      electiveParams.push(schedule_id);
    }

    const electivesResult = await client.query(electiveQuery, electiveParams);

    // For each elective, check if prerequisites are satisfied
    if (schedule_id) {
      for (const elective of electivesResult.rows) {
        // Get prerequisites for this elective
        const prereqQuery = await client.query(
          `SELECT cp.prerequisite_course_code, c.level as prereq_level
           FROM course_prerequisite cp
           JOIN course c ON cp.prerequisite_course_code = c.course_code
           WHERE cp.course_code = $1`,
          [elective.course_code]
        );

        let allPrereqsSatisfied = true;
        const targetLevel = parseInt(level as string, 10);

        // Check each prerequisite
        for (const prereq of prereqQuery.rows) {
          // If prerequisite is from a lower level than target, assume it's already taken
          if (typeof prereq.prereq_level === 'number' && prereq.prereq_level < targetLevel) {
            continue; // This prerequisite is satisfied (taken in previous levels)
          }

          // For same-level or higher prerequisites, check if it's in the current schedule
          const prereqScheduled = await client.query(
            `SELECT 1 FROM contain 
             WHERE schedule_id = $1 AND course_code = $2
             LIMIT 1`,
            [schedule_id, prereq.prerequisite_course_code]
          );

          if (prereqScheduled.rows.length === 0) {
            allPrereqsSatisfied = false;
            break;
          }
        }

        // Only add elective if all prerequisites are satisfied
        if (allPrereqsSatisfied) {
          courses.push(elective);
        }
      }
    } else {
      // If no schedule_id, include all electives (no way to check prerequisites)
      courses.push(...electivesResult.rows);
    }

    // Sort: required courses first, then electives
    courses.sort((a, b) => {
      if (a.is_elective === b.is_elective) {
        return a.course_code.localeCompare(b.course_code);
      }
      return a.is_elective ? 1 : -1;
    });

    res.status(200).json({
      success: true,
      courses: courses
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({
      success: false,
      error: 'Database error occurred'
    });
  } finally {
    client.release();
  }
}