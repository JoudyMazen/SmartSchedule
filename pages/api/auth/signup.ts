import { NextApiRequest, NextApiResponse } from 'next';
import { createUser } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} Not Allowed`
    });
  }

  try {
    const { firstName, lastName, email, phone, password, role } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, email, password, and role are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    // Validate role
    const allowedRoles = ['student', 'faculty', 'scheduling_committee', 'teaching_load_committee'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified'
      });
    }

    // Create user in database
    const result = await createUser(
      firstName.trim(),
      lastName.trim(),
      email.toLowerCase().trim(),
      phone || '',
      password,
      role
    );

    if (result.success) {
      return res.status(201).json({
        success: true,
        user: result.user,
        token: result.token,
        message: 'Account created successfully'
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message || 'Failed to create account'
      });
    }
  } catch (error: any) {
    console.error('Signup API error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
}
