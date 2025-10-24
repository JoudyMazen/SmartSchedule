// pages/api/test-db.ts or app/api/test-db/route.ts
// Use this based on your Next.js version (Pages Router vs App Router)

import { NextApiRequest, NextApiResponse } from 'next';
import pool from '@/lib/db';

// For Pages Router (pages/api/test-db.ts)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('🔍 Testing database connection...');
    console.log('Environment variables check:', {
      DB_HOST: process.env.DB_HOST ? '✅ Set' : '❌ Missing',
      DB_NAME: process.env.DB_NAME ? '✅ Set' : '❌ Missing',
      DB_USER: process.env.DB_USER ? '✅ Set' : '❌ Missing',
      DB_PASSWORD: process.env.DB_PASSWORD ? '✅ Set' : '❌ Missing',
      DB_PORT: process.env.DB_PORT ? '✅ Set' : '❌ Missing',
    });

    // Test 1: Simple query
    const timeResult = await pool.query('SELECT NOW() as current_time');
    console.log('✅ Test 1 passed: Basic query');

    // Test 2: Check if user table exists
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'user'
    `);
    console.log('✅ Test 2 passed: Table check');

    // Test 3: Count users
    const userCount = await pool.query('SELECT COUNT(*) as count FROM "user"');
    console.log('✅ Test 3 passed: User count query');

    return res.status(200).json({
      success: true,
      message: 'Database connection successful',
      data: {
        timestamp: timeResult.rows[0].current_time,
        userTableExists: tableCheck.rows.length > 0,
        userCount: userCount.rows[0].count,
      },
    });
  } catch (error: any) {
    console.error('❌ Database connection failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message,
      details: {
        code: error.code,
        detail: error.detail,
      },
    });
  }
}

// For App Router (app/api/test-db/route.ts)
/*
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    console.log('🔍 Testing database connection...');
    
    const timeResult = await pool.query('SELECT NOW() as current_time');
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'user'
    `);
    const userCount = await pool.query('SELECT COUNT(*) as count FROM "user"');

    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      data: {
        timestamp: timeResult.rows[0].current_time,
        userTableExists: tableCheck.rows.length > 0,
        userCount: userCount.rows[0].count,
      },
    });
  } catch (error: any) {
    console.error('❌ Database connection failed:', error);
    return NextResponse.json({
      success: false,
      message: 'Database connection failed',
      error: error.message,
    }, { status: 500 });
  }
}
*/