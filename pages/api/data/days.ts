import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

const DEFAULT_DAYS = [
  { day: 'Sunday' },
  { day: 'Monday' },
  { day: 'Tuesday' },
  { day: 'Wednesday' },
  { day: 'Thursday' }
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  // Always return defaults - don't query the database
  return res.status(200).json({ success: true, days: DEFAULT_DAYS });
}