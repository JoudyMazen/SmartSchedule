import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }
  const { level, group, instructor } = req.query;

  //const { level, group, instructor, all } = req.query;

  // Fetch ALL schedules (for faculty/global view)
  //if (all === 'true') {
    //try {
      //const result = await pool.query(`
       // SELECT c.schedule_id, c.section_num, c.course_code, co.course_name,
         //      s.activity_type, c.time_slot, c.day, c.room, c.instructor,
         //      sch.level_num, sch.group_num, sch.status, sch.created_at, sch.updated_at
       // FROM contain c
        // JOIN schedule sch ON c.schedule_id = sch.schedule_id
        // JOIN course co ON c.course_code = co.course_code
        // LEFT JOIN section s ON c.course_code = s.course_code AND c.section_num = s.section_number
        // ORDER BY
        //   sch.level_num, sch.group_num,
        //   CASE c.day
        //     WHEN 'Sunday' THEN 1
        //     WHEN 'Monday' THEN 2
        //     WHEN 'Tuesday' THEN 3
        //     WHEN 'Wednesday' THEN 4
        //     WHEN 'Thursday' THEN 5
        //   END, c.time_slot`);

  //     return res.status(200).json({ success: true, entries: result.rows });
  //   } catch (err) {
  //     console.error('Database error:', err);
  //     return res.status(500).json({ success: false, error: 'Database error' });
  //   }
  // }

  // Check if we're fetching by instructor
  if (instructor) {
    try {
      const result = await pool.query(`
        SELECT c.schedule_id, c.section_num, c.course_code, co.course_name,
               s.activity_type, c.time_slot, c.day, c.room, c.instructor,
               sch.level_num, sch.group_num, sch.status, sch.created_at, sch.updated_at
        FROM contain c
        JOIN schedule sch ON c.schedule_id = sch.schedule_id
        JOIN course co ON c.course_code = co.course_code
        LEFT JOIN section s ON c.course_code = s.course_code AND c.section_num = s.section_number
        WHERE c.instructor = $1
        ORDER BY
          CASE c.day
            WHEN 'Sunday' THEN 1
            WHEN 'Monday' THEN 2
            WHEN 'Tuesday' THEN 3
            WHEN 'Wednesday' THEN 4
            WHEN 'Thursday' THEN 5
          END, c.time_slot
      `, [instructor]);

      res.status(200).json({ success: true, entries: result.rows });
      return;
    } catch (err) {
      console.error('Database error:', err);
      res.status(500).json({ success: false, error: 'Database error' });
      return;
    }
  }

  // Original logic for level and group
  if (!level || !group) {
    return res.status(400).json({ success: false, error: 'level and group required' });
  }

  try {
    const result = await pool.query(`
      SELECT c.schedule_id, c.section_num, c.course_code, co.course_name,
             s.activity_type, c.time_slot, c.day, c.room, c.instructor
      FROM contain c
      JOIN schedule sch ON c.schedule_id = sch.schedule_id
      JOIN course co ON c.course_code = co.course_code
      LEFT JOIN section s ON c.course_code = s.course_code AND c.section_num = s.section_number
      WHERE sch.level_num = $1 AND sch.group_num = $2
      ORDER BY 
        CASE c.day
          WHEN 'Sunday' THEN 1
          WHEN 'Monday' THEN 2
          WHEN 'Tuesday' THEN 3
          WHEN 'Wednesday' THEN 4
          WHEN 'Thursday' THEN 5
        END, c.time_slot
    `, [level, group]);

    res.status(200).json({ success: true, entries: result.rows });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
}