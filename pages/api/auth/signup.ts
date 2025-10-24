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
    console.log('=== SIGNUP API CALLED ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const { firstName, lastName, email, phone, password, role } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password || !role) {
      console.log('Validation failed: Missing required fields');
      console.log('Missing:', {
        firstName: !firstName,
        lastName: !lastName,
        email: !email,
        password: !password,
        role: !role
      });
      return res.status(400).json({
        success: false,
        message: 'First name, last name, email, password, and role are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('Validation failed: Invalid email format:', email);
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Validate password strength
    if (password.length < 8) {
      console.log('Validation failed: Password too short');
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    // Validate role
    const allowedRoles = ['student', 'faculty', 'scheduling_committee', 'teaching_load_committee'];
    if (!allowedRoles.includes(role)) {
      console.log('Validation failed: Invalid role:', role);
      console.log('Allowed roles:', allowedRoles);
      return res.status(400).json({
        success: false,
        message: `Invalid role specified. Must be one of: ${allowedRoles.join(', ')}`
      });
    }

    console.log('All validations passed, calling createUser...');

    // Create user in database
    const result = await createUser(
      firstName.trim(),
      lastName.trim(),
      email.toLowerCase().trim(),
      phone && phone.trim() !== '' ? phone.trim() : '',
      password,
      role
    );

    console.log('createUser result:', {
      success: result.success,
      message: result.message,
      hasUser: !!result.user,
      hasToken: !!result.token
    });

    if (result.success) {
      console.log('User created successfully!');
      return res.status(201).json({
        success: true,
        user: result.user,
        token: result.token,
        message: 'Account created successfully'
      });
    } else {
      console.log('User creation failed:', result.message);
      return res.status(400).json({
        success: false,
        message: result.message || 'Failed to create account'
      });
    }
  } catch (error: any) {
    console.error('=== SIGNUP API ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Full error:', error);
    return res.status(500).json({
      success: false,
      message: `Server error: ${error.message}`
    });
  }
}
