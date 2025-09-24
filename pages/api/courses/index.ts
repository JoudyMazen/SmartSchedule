import { NextApiRequest, NextApiResponse } from 'next';
import { getCourses, getSections } from '../../../lib/schedule';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const courses = await getCourses();
      const sections = await getSections();
      
      res.status(200).json({ 
        success: true, 
        courses, 
        sections 
      });
    } else {
      res.setHeader('Allow', ['GET']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
