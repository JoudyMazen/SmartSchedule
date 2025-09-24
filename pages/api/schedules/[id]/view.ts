import { NextApiRequest, NextApiResponse } from 'next';
import { verifyToken } from '../../../../lib/auth';
import { getScheduleWithSlots } from '../../../../lib/schedule';

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
      
      // Transform slots into a grid format
      const timeSlots = ['8-9', '9-10', '10-11', '11-12', '12-1', '1-2', '2-3', '3-4'];
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
      
      const scheduleGrid = days.map(day => ({
        day,
        slots: timeSlots.map(timeSlot => {
          const slot = slots.find(s => s.day === day && s.time_slot === timeSlot);
          return slot ? {
            course_code: slot.course_code,
            course_name: slot.course_name,
            section_num: slot.section_num,
            time_slot: slot.time_slot
          } : null;
        })
      }));

      res.status(200).json({ 
        success: true, 
        schedule: scheduleGrid,
        rawSlots: slots
      });
    } else {
      res.setHeader('Allow', ['GET']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
