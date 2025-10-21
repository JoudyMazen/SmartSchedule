import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import pool from '../../../lib/db';
import { updatePassword } from '../../../lib/auth';
import { sendPasswordResetConfirmation } from '../../../lib/email';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} Not Allowed`
    });
  }

  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({
      success: false,
      message: 'Token and password are required'
    });
  }

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*]).{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters with uppercase, lowercase, and special character'
    });
  }

  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const tokenResult = await pool.query(
      `SELECT rt.*, u.user_id, u.email, u.first_name
       FROM password_reset_tokens rt
       JOIN "user" u ON rt.user_id = u.user_id
       WHERE rt.reset_token = $1
         AND rt.expires_at > NOW()
         AND rt.used = FALSE`,
      [hashedToken]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    const tokenData = tokenResult.rows[0];

    const updateResult = await updatePassword(tokenData.user_id, password);

    if (!updateResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update password'
      });
    }

    await pool.query(
      'UPDATE password_reset_tokens SET used = TRUE WHERE token_id = $1',
      [tokenData.token_id]
    );

    await pool.query(
      'DELETE FROM password_reset_tokens WHERE user_id = $1',
      [tokenData.user_id]
    );

    await sendPasswordResetConfirmation(
      tokenData.email,
      tokenData.first_name
    );

    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred. Please try again later.'
    });
  }
}