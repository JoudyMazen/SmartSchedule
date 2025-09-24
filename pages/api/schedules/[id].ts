import { NextApiRequest, NextApiResponse } from 'next';
import { getScheduleWithSlots, updateScheduleStatus } from '../../../lib/schedule';
import { verifyToken } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const decoded = verifyToken(token);

    if (req.method === 'GET') {
      const { id } = req.query;
      const slots = await getScheduleWithSlots(parseInt(id as string));
      res.status(200).json({ success: true, slots });
    } else if (req.method === 'PUT') {
      if (!decoded || decoded.role !== 'scheduling_committee') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      const { id } = req.query;
      const { status } = req.body;
      
      await updateScheduleStatus(parseInt(id as string), status);
      res.status(200).json({ success: true, message: 'Schedule updated' });
    } else {
      res.setHeader('Allow', ['GET', 'PUT']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
