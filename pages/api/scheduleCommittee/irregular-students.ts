import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const level = req.query.level ? Number(req.query.level) : undefined;
    try {
      const params: any[] = [];
      let where = 'st.is_irregular = TRUE';
      if (level) {
        where += ' AND st.level = $1';
        params.push(level);
      }
      const result = await pool.query(
        `SELECT st.student_id, u.first_name, u.last_name, u.email, u.phone, u.user_id,
                st.level, st.is_irregular, isd.remaining_courses, st.created_at
         FROM student st
         JOIN "user" u ON u.user_id = st.user_id
         LEFT JOIN Irregular_Student_Data isd ON isd.student_id = st.student_id
         WHERE ${where}
         ORDER BY st.created_at DESC`,
        params
      );

      const rows = result.rows.map((r: any) => ({
        student_id: r.student_id,
        name: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email,
        university_id: r.user_id?.toString() || '',
        level: r.level,
        remaining_courses: (() => {
          if (!r.remaining_courses) return [] as string[];
          try {
            const parsed = JSON.parse(r.remaining_courses);
            if (Array.isArray(parsed)) return parsed.filter((x: any) => typeof x === 'string');
          } catch (_) {}
          return String(r.remaining_courses)
            .split(/[,\s]+/)
            .map((x: string) => x.trim())
            .filter(Boolean);
        })(),
        created_at: r.created_at
      }));

      return res.status(200).json({ success: true, students: rows });
    } catch (err: any) {
      console.error('GET irregular-students error', err);
      return res.status(500).json({ success: false, error: err.message || 'Server error' });
    }
  }

  if (req.method === 'POST') {
    const { name, university_id, level, remaining_courses } = req.body || {};
    if (!name || !university_id || !level || !Array.isArray(remaining_courses)) {
      return res.status(400).json({ success: false, error: 'name, university_id, level, remaining_courses[] required' });
    }
    const [first_name, ...rest] = String(name).trim().split(/\s+/);
    const last_name = rest.join(' ');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Upsert user by a synthetic email based on university_id if not present
      const email = `${university_id}@students.example`;
      let userId: number;
      const userRes = await client.query('SELECT user_id FROM "user" WHERE email = $1', [email]);
      if (userRes.rows.length) {
        userId = userRes.rows[0].user_id;
        await client.query('UPDATE "user" SET first_name=$1, last_name=$2 WHERE user_id=$3', [first_name, last_name, userId]);
      } else {
        const ins = await client.query(
          'INSERT INTO "user"(first_name, last_name, email, password, role) VALUES($1,$2,$3,$4,$5) RETURNING user_id',
          [first_name, last_name, email, 'TEMP', 'student']
        );
        userId = ins.rows[0].user_id;
      }

      // Upsert student with is_irregular
      let studentId: number;
      const stuRes = await client.query('SELECT student_id FROM student WHERE user_id=$1', [userId]);
      if (stuRes.rows.length) {
        studentId = stuRes.rows[0].student_id;
        await client.query('UPDATE student SET level=$1, is_irregular=TRUE WHERE student_id=$2', [level, studentId]);
      } else {
        const insStu = await client.query(
          'INSERT INTO student(user_id, is_irregular, level) VALUES($1, TRUE, $2) RETURNING student_id',
          [userId, level]
        );
        studentId = insStu.rows[0].student_id;
      }

      // Upsert irregular data
      const rcJson = JSON.stringify(remaining_courses);
      await client.query(
        `INSERT INTO Irregular_Student_Data(user_id, student_id, remaining_courses, needed_courses)
         VALUES($1,$2,$3,NULL)
         ON CONFLICT (user_id, student_id) DO UPDATE SET remaining_courses = EXCLUDED.remaining_courses`,
        [userId, studentId, rcJson]
      );

      await client.query('COMMIT');
      return res.status(200).json({ success: true, student_id: studentId });
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('POST irregular-students error', err);
      return res.status(500).json({ success: false, error: err.message || 'Server error' });
    } finally {
      client.release();
    }
  }

  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
}


