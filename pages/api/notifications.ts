import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Ensure notifications table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      notification_id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link TEXT,
      read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  if (req.method === 'GET') {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'user_id is required',
      });
    }

    try {
      // Get user role to filter notifications appropriately
      const userResult = await pool.query(
        `SELECT role FROM "user" WHERE user_id = $1`,
        [user_id]
      );

      const userRole = userResult.rows.length > 0 ? userResult.rows[0].role : null;

      // For scheduling_committee, filter out "Schedule Published" notifications
      // They should only see comment/feedback notifications
      let query = `SELECT * FROM notifications WHERE user_id = $1`;
      const params: any[] = [user_id];

      if (userRole === 'scheduling_committee') {
        // Exclude publish notifications for scheduling committee
        query += ` AND NOT (type = 'publish' AND title LIKE 'Schedule Published%')`;
      }

      query += ` ORDER BY created_at DESC LIMIT 50`;

      const result = await pool.query(query, params);

      // Also filter unread count
      let unreadQuery = `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read = FALSE`;
      if (userRole === 'scheduling_committee') {
        unreadQuery += ` AND NOT (type = 'publish' AND title LIKE 'Schedule Published%')`;
      }

      const unreadCount = await pool.query(unreadQuery, params);

      return res.status(200).json({
        success: true,
        notifications: result.rows.map((row: any) => ({
          id: row.notification_id.toString(),
          type: row.type,
          title: row.title,
          message: row.message,
          timestamp: row.created_at,
          read: row.read,
          link: row.link,
        })),
        unreadCount: parseInt(unreadCount.rows[0].count),
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return res.status(500).json({
        success: false,
        error: 'Database error',
      });
    }
  }

  if (req.method === 'POST') {
    const { user_id, type, title, message, link, target_role } = req.body;

    if (!type || !title || !message) {
      return res.status(400).json({
        success: false,
        error: 'type, title, and message are required',
      });
    }

    try {
      let result;

      if (target_role) {
        // Create notification for all users with specific role
        const usersResult = await pool.query(
          `SELECT user_id FROM "user" WHERE role = $1`,
          [target_role]
        );

        const insertPromises = usersResult.rows.map((user: any) =>
          pool.query(
            `INSERT INTO notifications (user_id, type, title, message, link)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [user.user_id, type, title, message, link || null]
          )
        );

        await Promise.all(insertPromises);
        result = { rowCount: usersResult.rows.length };
      } else if (user_id) {
        // Create notification for specific user
        const insertResult = await pool.query(
          `INSERT INTO notifications (user_id, type, title, message, link)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [user_id, type, title, message, link || null]
        );
        result = insertResult;
      } else {
        return res.status(400).json({
          success: false,
          error: 'user_id or target_role is required',
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Notification created successfully',
        count: result.rowCount,
      });
    } catch (error) {
      console.error('Error creating notification:', error);
      return res.status(500).json({
        success: false,
        error: 'Database error',
      });
    }
  }

  if (req.method === 'PUT') {
    const { notification_id, user_id, mark_all } = req.body;

    try {
      if (mark_all && user_id) {
        await pool.query(
          `UPDATE notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE`,
          [user_id]
        );
      } else if (notification_id) {
        await pool.query(
          `UPDATE notifications SET read = TRUE WHERE notification_id = $1`,
          [notification_id]
        );
      } else {
        return res.status(400).json({
          success: false,
          error: 'notification_id or (user_id and mark_all) is required',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Notification updated successfully',
      });
    } catch (error) {
      console.error('Error updating notification:', error);
      return res.status(500).json({
        success: false,
        error: 'Database error',
      });
    }
  }

  if (req.method === 'DELETE') {
    const { notification_id } = req.body;

    if (!notification_id) {
      return res.status(400).json({
        success: false,
        error: 'notification_id is required',
      });
    }

    try {
      await pool.query(
        `DELETE FROM notifications WHERE notification_id = $1`,
        [notification_id]
      );

      return res.status(200).json({
        success: true,
        message: 'Notification deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      return res.status(500).json({
        success: false,
        error: 'Database error',
      });
    }
  }

  return res.status(405).json({
    success: false,
    error: 'Method Not Allowed',
  });
}


