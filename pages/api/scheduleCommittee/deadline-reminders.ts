import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

// Hard-coded deadline dates (must match the dates in scheduleCommitteeHomePage.tsx)
const DEADLINE_INITIAL_SUBMISSION_TO_TEACHING_LOAD = new Date('2025-11-18'); // Deadline for initial version submission to teaching load
const DEADLINE_PUBLISH_TO_FACULTY_STUDENTS = new Date('2025-11-18'); // Deadline for publishing to faculty and students
const DEADLINE_FINAL_VERSION_SUBMISSION = new Date('2025-11-18'); // Deadline for final version submission

interface DeadlineInfo {
  deadline: Date;
  type: 'initial_submission' | 'publish_to_faculty_students' | 'final_submission';
  title: string;
  description: string;
}

const DEADLINES: DeadlineInfo[] = [
  {
    deadline: DEADLINE_INITIAL_SUBMISSION_TO_TEACHING_LOAD,
    type: 'initial_submission',
    title: 'Initial Version Submission to Teaching Load Committee',
    description: 'Submit the initial version of the schedule to the Teaching Load Committee for review'
  },
  {
    deadline: DEADLINE_PUBLISH_TO_FACULTY_STUDENTS,
    type: 'publish_to_faculty_students',
    title: 'Publish Schedule to Faculty & Students',
    description: 'Publish the schedule to make it visible to all faculty and students'
  },
  {
    deadline: DEADLINE_FINAL_VERSION_SUBMISSION,
    type: 'final_submission',
    title: 'Final Version Submission',
    description: 'Submit the final approved version of the schedule'
  }
];

// Calculate days until deadline
function daysUntilDeadline(deadline: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadlineDate = new Date(deadline);
  deadlineDate.setHours(0, 0, 0, 0);
  const diffTime = deadlineDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Check if notification should be sent for a deadline
function shouldSendNotification(daysUntil: number): { shouldSend: boolean; reminderType: string | null } {
  if (daysUntil === 3) {
    return { shouldSend: true, reminderType: '3_days_before' };
  }
  if (daysUntil === 1) {
    return { shouldSend: true, reminderType: '1_day_before' };
  }
  if (daysUntil === 0) {
    return { shouldSend: true, reminderType: 'same_day' };
  }
  if (daysUntil < 0) {
    // Past deadline - don't send notifications
    return { shouldSend: false, reminderType: null };
  }
  return { shouldSend: false, reminderType: null };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed'
    });
  }

  try {
    // Use a client from the pool to avoid timeout issues
    const client = await pool.connect();
    
    try {
      // Ensure deadline_notifications tracking table exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS deadline_notifications (
          notification_tracking_id SERIAL PRIMARY KEY,
          deadline_type TEXT NOT NULL,
          reminder_type TEXT NOT NULL,
          deadline_date DATE NOT NULL,
          notification_date DATE NOT NULL,
          sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(deadline_type, reminder_type, deadline_date)
        )
      `);

      // Ensure notifications table exists
      await client.query(`
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let notificationsSent = 0;

    // Check each deadline
    for (const deadlineInfo of DEADLINES) {
      const daysUntil = daysUntilDeadline(deadlineInfo.deadline);
      const { shouldSend, reminderType } = shouldSendNotification(daysUntil);

      if (shouldSend && reminderType) {
        // Check if notification already sent for this deadline and reminder type
        const existingNotification = await client.query(
          `SELECT notification_tracking_id 
           FROM deadline_notifications 
           WHERE deadline_type = $1 
             AND reminder_type = $2 
             AND deadline_date = $3`,
          [deadlineInfo.type, reminderType, deadlineInfo.deadline.toISOString().split('T')[0]]
        );

        if (existingNotification.rows.length === 0) {
          // Get all scheduling committee members
          const usersResult = await client.query(
            `SELECT user_id FROM "user" WHERE role = 'scheduling_committee'`
          );

          // Create notification message based on reminder type
          let message: string;
          if (reminderType === '3_days_before') {
            message = `⏰ Reminder: ${deadlineInfo.description}. Deadline is in 3 days (${deadlineInfo.deadline.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}). Please ensure you submit on time.`;
          } else if (reminderType === '1_day_before') {
            message = `⚠️ Important: ${deadlineInfo.description}. Deadline is tomorrow (${deadlineInfo.deadline.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}). Please submit as soon as possible.`;
          } else {
            // same_day
            message = `🚨 URGENT: ${deadlineInfo.description}. Today is the deadline (${deadlineInfo.deadline.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}). Please submit immediately!`;
          }

          // Create notifications for all scheduling committee members
          const notificationPromises = usersResult.rows.map((user: any) =>
            client.query(
              `INSERT INTO notifications (user_id, type, title, message, link)
               VALUES ($1, $2, $3, $4, $5)`,
              [
                user.user_id,
                'deadline_reminder',
                deadlineInfo.title,
                message,
                '/scheduleCommittee/scheduleCommitteeHomePage'
              ]
            )
          );

          await Promise.all(notificationPromises);

          // Track that notification was sent
          await client.query(
            `INSERT INTO deadline_notifications (deadline_type, reminder_type, deadline_date, notification_date)
             VALUES ($1, $2, $3, $4)`,
            [
              deadlineInfo.type,
              reminderType,
              deadlineInfo.deadline.toISOString().split('T')[0],
              today.toISOString().split('T')[0]
            ]
          );

          notificationsSent += usersResult.rows.length;
        }
      }
    }

    // Release the client back to the pool
    client.release();

    return res.status(200).json({
      success: true,
      message: `Deadline reminders checked. ${notificationsSent} notification(s) sent.`,
      notificationsSent
    });
    } catch (clientError) {
      // Release client on error
      client.release();
      throw clientError;
    }
  } catch (error) {
    console.error('Error checking deadline reminders:', error);
    return res.status(500).json({
      success: false,
      error: 'Database error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

