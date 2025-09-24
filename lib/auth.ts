import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from './database';

export interface User {
  user_id: number;
  name: string;
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

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

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

export async function createUser(
  name: string,
  email: string,
  phone: string,
  password: string,
  role: string
): Promise<AuthResult> {
  try {
    const hashedPassword = await hashPassword(password);
    
    const result = await pool.query(
      'INSERT INTO "user" (name, email, phone, password, role) VALUES ($1, $2, $3, $4, $5) RETURNING user_id, name, email, phone, role',
      [name, email, phone, hashedPassword, role]
    );

    const user = result.rows[0];
    const token = generateToken(user);

    return { success: true, user, token };
  } catch (error: any) {
    if (error.code === '23505') {
      return { success: false, message: 'Email already exists' };
    }
    return { success: false, message: 'Failed to create user' };
  }
}

export async function authenticateUser(email: string, password: string): Promise<AuthResult> {
  try {
    const result = await pool.query(
      'SELECT user_id, name, email, phone, password, role FROM "user" WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return { success: false, message: 'Invalid credentials' };
    }

    const user = result.rows[0];
    const isValidPassword = await verifyPassword(password, user.password);

    if (!isValidPassword) {
      return { success: false, message: 'Invalid credentials' };
    }

    delete user.password;
    const token = generateToken(user);

    return { success: true, user, token };
  } catch (error) {
    return { success: false, message: 'Authentication failed' };
  }
}

export async function getUserById(userId: number): Promise<User | null> {
  try {
    const result = await pool.query(
      'SELECT user_id, name, email, phone, role FROM "user" WHERE user_id = $1',
      [userId]
    );

    return result.rows[0] || null;
  } catch (error) {
    return null;
  }
}
