import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} Not Allowed`
    });
  }

  const { level } = req.body;

  if (!level) {
    return res.status(400).json({
      success: false,
      message: 'Level is required'
    });
  }

  try {
    // Update all schedules for the given level from 'draft' to 'published'
    const result = await pool.query(
      `UPDATE schedule 
       SET status = 'published', updated_at = CURRENT_TIMESTAMP 
       WHERE level_num = $1 AND status = 'draft'`,
      [level]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'No draft schedules found for this level'
      });
    }

    return res.status(200).json({
      success: true,
      message: `Successfully published ${result.rowCount} schedule(s) for Level ${level}`,
      publishedCount: result.rowCount
    });

  } catch (error) {
    console.error('Error publishing schedule:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}
