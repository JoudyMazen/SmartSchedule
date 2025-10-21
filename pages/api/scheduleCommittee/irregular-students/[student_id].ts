import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const studentId = Number(req.query.student_id);
  if (!studentId) return res.status(400).json({ success: false, error: 'student_id required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Remove irregular data and optionally mark as regular
    await client.query('DELETE FROM Irregular_Student_Data WHERE student_id = $1', [studentId]);
    await client.query('UPDATE student SET is_irregular = FALSE WHERE student_id = $1', [studentId]);

    await client.query('COMMIT');
    return res.status(200).json({ success: true });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('DELETE irregular-student error', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  } finally {
    client.release();
  }
}


