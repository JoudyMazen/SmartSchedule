import { NextApiRequest, NextApiResponse } from 'next';
import { createUser, generateToken } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} Not Allowed`
    });
  }

  const { firstName, lastName, email, phone, password, role } = req.body;

  // 1️⃣ Required fields
  if (!firstName || !lastName || !email || !password || !role) {
    return res.status(400).json({
      success: false,
      message: 'First name, last name, email, password, and role are required'
    });
  }

  // 2️⃣ Email format validation (only @student.ksu.edu.sa or @ksu.edu.sa)
  const emailRegex = /^[^\s@]+@(student\.)?ksu\.edu\.sa$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Email must be @student.ksu.edu.sa or @ksu.edu.sa'
    });
  }

  // 3️⃣ Password strength validation
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*]).{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters with uppercase, lowercase, and special character'
    });
  }

  // 4️⃣ Role validation
  const allowedRoles = ['student', 'faculty', 'scheduling_committee', 'teaching_load_committee'];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid role specified'
    });
  }

  // 5️⃣ Create user
  try {
    const result = await createUser(firstName, lastName, email, phone || '', password, role);

    if (result.success && result.user) {
      // Generate token for the new user
      const token = generateToken(result.user);
      
      // Set token in HTTP-only cookie for middleware authentication
      res.setHeader('Set-Cookie', `token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`); // 7 days
      
      return res.status(201).json({
        ...result,
        token
      });
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}
