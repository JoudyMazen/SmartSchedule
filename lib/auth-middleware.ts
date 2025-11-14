import { NextApiRequest, NextApiResponse } from 'next';
import { verifyToken } from './auth';

/**
 * Middleware to authenticate API requests using JWT token
 * Extracts user_id from token and attaches to request
 */
export function authenticateRequest(req: NextApiRequest, res: NextApiResponse): { user_id: number; role: string } | null {
  try {
    // Get token from Authorization header or cookie
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    } else if (req.headers.cookie) {
      // Parse cookie string manually if needed
      const cookies = req.headers.cookie.split(';').reduce((acc: any, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {});
      token = cookies.token;
    }

    if (!token) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return null;
    }

    const decoded = verifyToken(token);
    return {
      user_id: decoded.user_id,
      role: decoded.role
    };
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
    return null;
  }
}

/**
 * Optional middleware - doesn't return error if no token, just returns null
 */
export function optionalAuth(req: NextApiRequest): { user_id: number; role: string } | null {
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return null;
    }

    const decoded = verifyToken(token);
    return {
      user_id: decoded.user_id,
      role: decoded.role
    };
  } catch (error) {
    return null;
  }
}

