import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/database';

interface Prerequisite {
  prerequisite_code: string;
  course_name: string;
  is_scheduled: boolean;
}

interface ApiResponse {
  success: boolean;
  prerequisites?: Prerequisite[];
  has_prerequisites?: boolean;
  all_satisfied?: boolean;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  const { course_code, schedule_id } = req.query;

  if (!course_code) {
    return res.status(400).json({
      success: false,
      error: 'Course code is required'
    });
  }

  const client = await pool.connect();
  
  try {
    const prereqQuery = await client.query(
      `SELECT cp.prerequisite_course_code as prerequisite_code, c.course_name
       FROM course_prerequisite cp
       JOIN course c ON cp.prerequisite_course_code = c.course_code
       WHERE cp.course_code = $1`,
      [course_code]
    );

    if (prereqQuery.rows.length === 0) {
      return res.status(200).json({
        success: true,
        has_prerequisites: false,
        all_satisfied: true,
        prerequisites: []
      });
    }

    const prerequisites: Prerequisite[] = [];
    let allSatisfied = true;

    for (const prereq of prereqQuery.rows) {
      let isScheduled = false;

      if (schedule_id) {
        const scheduledCheck = await client.query(
          `SELECT 1 FROM contain 
           WHERE schedule_id = $1 AND course_code = $2
           LIMIT 1`,
          [schedule_id, prereq.prerequisite_code]
        );
        isScheduled = scheduledCheck.rows.length > 0;
      }

      if (!isScheduled) {
        allSatisfied = false;
      }

      prerequisites.push({
        prerequisite_code: prereq.prerequisite_code,
        course_name: prereq.course_name,
        is_scheduled: isScheduled
      });
    }

    res.status(200).json({
      success: true,
      has_prerequisites: true,
      all_satisfied: allSatisfied,
      prerequisites
    });
  } catch (error) {
    console.error('Error checking prerequisites:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check prerequisites'
    });
  } finally {
    client.release();
  }
}