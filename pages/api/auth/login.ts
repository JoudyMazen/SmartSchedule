import { NextApiRequest, NextApiResponse } from 'next';
import { authenticateUser } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const result = await authenticateUser(email, password);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(401).json(result);
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
