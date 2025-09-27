import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from './database';

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
    const hashedPassword = await hashPassword(password);

    const result = await pool.query(
      `INSERT INTO "user" (first_name, last_name, email, phone, password, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING user_id, first_name, last_name, email, phone, role`,
      [firstName, lastName, email, phone, hashedPassword, role]
    );

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
    if (error.code === '23505') {
      return { success: false, message: 'Email already exists' };
    }
    return { success: false, message: 'Failed to create user' };
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
    return null;
  }
}
