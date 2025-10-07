import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/database';

const DEFAULT_TIME_SLOTS = [
  // 1-hour slots (50 minutes)
  { time_slot: '08:00-08:50' },
  { time_slot: '09:00-09:50' },
  { time_slot: '10:00-10:50' },
  { time_slot: '11:00-11:50' },
  { time_slot: '12:00-12:50' },
  { time_slot: '13:00-13:50' },
  { time_slot: '14:00-14:50' },
  // 2-hour slots (1 hour 50 minutes)
  { time_slot: '08:00-09:50' },
  { time_slot: '09:00-10:50' },
  { time_slot: '10:00-11:50' },
  { time_slot: '13:00-14:50' },
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
      return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }
  
    // Always return defaults - don't query the database
    return res.status(200).json({ success: true, timeSlots: DEFAULT_TIME_SLOTS });
  }