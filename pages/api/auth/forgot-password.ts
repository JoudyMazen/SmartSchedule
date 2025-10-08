import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import pool from '../../../lib/db';
import { getUserByEmail } from '../../../lib/auth';
import { sendPasswordResetEmail } from '../../../lib/email';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} Not Allowed`
    });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email is required'
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid email address'
    });
  }

  try {
    const user = await getUserByEmail(email.toLowerCase());

    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await pool.query(
        'DELETE FROM password_reset_tokens WHERE user_id = $1',
        [user.user_id]
      );

      await pool.query(
        `INSERT INTO password_reset_tokens (user_id, reset_token, expires_at)
         VALUES ($1, $2, $3)`,
        [user.user_id, hashedToken, expiresAt]
      );

      const emailResult = await sendPasswordResetEmail(
        user.email,
        user.first_name,
        resetToken
      );

      if (!emailResult.success) {
        console.error('Failed to send password reset email:', emailResult.error);
        // Still return success to user for security, but log the error
      }
    }

    return res.status(200).json({
      success: true,
      message: 'If an account with that email exists, we have sent a password reset link.'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred. Please try again later.'
    });
  }
}