import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Test basic connection
    const result = await pool.query('SELECT NOW(), version()');
    
    // Test if user table exists
    const tableCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'user'
      ORDER BY ordinal_position
    `);
    
    return res.status(200).json({
      success: true,
      connection: 'OK',
      timestamp: result.rows[0].now,
      database: result.rows[0].version.substring(0, 50),
      userTableColumns: tableCheck.rows
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
      code: error.code,
      detail: error.detail
    });
  }
}