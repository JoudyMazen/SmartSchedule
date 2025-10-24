import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from './db';

// ----------------- TYPES -----------------
export interface User {
  user_id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: string;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  token?: string;
  message?: string;
}

// ----------------- PASSWORD -----------------
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// ----------------- JWT -----------------
export function generateToken(user: User): string {
  return jwt.sign(
    { user_id: user.user_id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '24h' }
  );
}

export function verifyToken(token: string): any {
  return jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
}

// ----------------- CREATE USER -----------------
export async function createUser(
  firstName: string,
  lastName: string,
  email: string,
  phone: string,
  password: string,
  role: string
): Promise<AuthResult> {
  try {
    console.log('=== Creating user ===');
    console.log('Input data:', { 
      firstName, 
      lastName, 
      email, 
      phone: phone || 'empty', 
      role,
      passwordLength: password.length 
    });
    
    const hashedPassword = await hashPassword(password);
    console.log('Password hashed successfully');

    console.log('Executing INSERT query...');
    const result = await pool.query(
      `INSERT INTO "user" (first_name, last_name, email, phone, password, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING user_id, first_name, last_name, email, phone, role`,
      [firstName, lastName, email, phone || null, hashedPassword, role]
    );

    console.log('User created successfully:', result.rows[0]);

    const dbUser = result.rows[0];

    // map DB fields to camelCase
    const user: User = {
      user_id: dbUser.user_id,
      firstName: dbUser.first_name,
      lastName: dbUser.last_name,
      email: dbUser.email,
      phone: dbUser.phone,
      role: dbUser.role
    };

    const token = generateToken(user);
    return { success: true, user, token };
  } catch (error: any) {
    console.error('=== CREATE USER ERROR ===');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Error detail:', error.detail);
    console.error('Error hint:', error.hint);
    console.error('Error table:', error.table);
    console.error('Error constraint:', error.constraint);
    console.error('Full error:', JSON.stringify(error, null, 2));
    
    if (error.code === '23505') {
      return { success: false, message: 'Email already exists' };
    }
    if (error.code === '23502') {
      return { success: false, message: `Missing required field: ${error.column}` };
    }
    if (error.code === '42703') {
      return { success: false, message: `Database column error: ${error.message}` };
    }
    if (error.code === '42P01') {
      return { success: false, message: 'User table does not exist. Please run database migrations.' };
    }
    
    // Return the actual error message for debugging
    return { success: false, message: `Database error: ${error.message} (Code: ${error.code})` };
  }
}

// ----------------- AUTHENTICATE USER -----------------
export async function authenticateUser(email: string, password: string): Promise<AuthResult> {
  try {
    const result = await pool.query(
      `SELECT user_id, first_name, last_name, email, phone, password, role
       FROM "user" WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return { success: false, message: 'Invalid credentials' };
    }

    const dbUser = result.rows[0];
    const isValidPassword = await verifyPassword(password, dbUser.password);

    if (!isValidPassword) {
      return { success: false, message: 'Invalid credentials' };
    }

    // map DB fields to camelCase
    const user: User = {
      user_id: dbUser.user_id,
      firstName: dbUser.first_name,
      lastName: dbUser.last_name,
      email: dbUser.email,
      phone: dbUser.phone,
      role: dbUser.role
    };

    const token = generateToken(user);
    return { success: true, user, token };
  } catch (error) {
    console.error('Authentication error:', error);
    return { success: false, message: 'Authentication failed' };
  }
}

// ----------------- GET USER BY ID -----------------
export async function getUserById(userId: number): Promise<User | null> {
  try {
    const result = await pool.query(
      `SELECT user_id, first_name, last_name, email, phone, role
       FROM "user" WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) return null;

    const dbUser = result.rows[0];

    return {
      user_id: dbUser.user_id,
      firstName: dbUser.first_name,
      lastName: dbUser.last_name,
      email: dbUser.email,
      phone: dbUser.phone,
      role: dbUser.role
    };
  } catch (error) {
    console.error('Get user by ID error:', error);
    return null;
  }
}

// ----------------- GET USER BY EMAIL -----------------
export async function getUserByEmail(email: string): Promise<any | null> {
  try {
    const result = await pool.query(
      `SELECT user_id, first_name, last_name, email, phone, role
       FROM "user" WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) return null;

    return result.rows[0];
  } catch (error) {
    console.error('Get user by email error:', error);
    return null;
  }
}

// ----------------- UPDATE PASSWORD -----------------
export async function updatePassword(userId: number, newPassword: string): Promise<{ success: boolean; message: string }> {
  try {
    const hashedPassword = await hashPassword(newPassword);
    
    await pool.query(
      'UPDATE "user" SET password = $1 WHERE user_id = $2',
      [hashedPassword, userId]
    );

    return { success: true, message: 'Password updated successfully' };
  } catch (error) {
    console.error('Update password error:', error);
    return { success: false, message: 'Failed to update password' };
  }
}