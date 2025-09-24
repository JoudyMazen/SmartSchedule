import { NextApiRequest, NextApiResponse } from 'next';
import { createSchedule, getSchedulesByLevel, getAllSchedules, addScheduleSlot, generateAISchedule, getCourses, getSections } from '../../../lib/schedule';
import { verifyToken } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'scheduling_committee') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (req.method === 'GET') {
      const { level } = req.query;
      
      if (level) {
        const schedules = await getSchedulesByLevel(parseInt(level as string));
        res.status(200).json({ success: true, schedules });
      } else {
        const schedules = await getAllSchedules();
        res.status(200).json({ success: true, schedules });
      }
    } else if (req.method === 'POST') {
      const { level_num, group_num, generate_ai } = req.body;

      if (generate_ai) {
        // Generate AI schedule
        const courses = await getCourses();
        const sections = await getSections();
        const aiSlots = generateAISchedule(level_num, courses, sections);
        
        const schedule = await createSchedule(level_num, group_num);
        
        // Add AI-generated slots to database
        for (const slot of aiSlots) {
          await addScheduleSlot(schedule.schedule_id, slot.section_num, slot.time_slot, slot.day, slot.course_code);
        }

        res.status(201).json({ success: true, schedule, slots: aiSlots });
      } else {
        const schedule = await createSchedule(level_num, group_num);
        res.status(201).json({ success: true, schedule });
      }
    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
