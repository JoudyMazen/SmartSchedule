import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '2525'),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export const sendEmail = async (options: EmailOptions) => {
  try {
    // Log email configuration for debugging (without sensitive data)
    console.log('📧 Attempting to send email...');
    console.log('SMTP Config:', {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      from: process.env.EMAIL_FROM,
      to: options.to,
      hasAuth: !!(process.env.SMTP_USER && process.env.SMTP_PASS)
    });

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''),
    });

    console.log('✅ Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('❌ Email send error:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response
    });
    return { success: false, error };
  }
};

export const sendPasswordResetEmail = async (
  email: string,
  firstName: string,
  resetToken: string
) => {
  const resetUrl = `${process.env.FRONTEND_URL}/auth/reset-password?token=${resetToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .container {
          background: linear-gradient(135deg, #1e3a5f 0%, #87CEEB 100%);
          padding: 40px;
          border-radius: 10px;
        }
        .content {
          background: white;
          padding: 30px;
          border-radius: 8px;
        }
        .header {
          text-align: center;
          color: #1e3a5f;
          margin-bottom: 30px;
        }
        .button {
          display: inline-block;
          padding: 15px 30px;
          background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%);
          color: white !important;
          text-decoration: none;
          border-radius: 8px;
          font-weight: bold;
          margin: 20px 0;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          font-size: 12px;
          color: #666;
          text-align: center;
        }
        .warning {
          background: #fff3cd;
          border-left: 4px solid #ffc107;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .link-box {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 4px;
          word-break: break-all;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="content">
          <div class="header">
            <h1>🔐 Password Reset Request</h1>
          </div>
          
          <p>Hello ${firstName},</p>
          
          <p>We received a request to reset your password for your Smart Schedule account. If you didn't make this request, please ignore this email.</p>
          
          <p>To reset your password, click the button below:</p>
          
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset Password</a>
          </div>
          
          <p>Or copy and paste this link into your browser:</p>
          <div class="link-box">
            <a href="${resetUrl}">${resetUrl}</a>
          </div>
          
          <div class="warning">
            <strong>⚠️ Security Notice:</strong>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>This link will expire in <strong>1 hour</strong></li>
              <li>You can only use this link once</li>
              <li>If you didn't request this, your account is still secure</li>
            </ul>
          </div>
          
          <div class="footer">
            <p><strong>Smart Schedule System</strong></p>
            <p>This is an automated email. Please do not reply to this message.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Password Reset Request
    
    Hello ${firstName},
    
    We received a request to reset your password for your Smart Schedule account.
    
    To reset your password, visit: ${resetUrl}
    
    This link will expire in 1 hour and can only be used once.
    
    If you didn't request this password reset, please ignore this email.
    
    Best regards,
    Smart Schedule Team
  `;

  return sendEmail({
    to: email,
    subject: 'Reset Your Password - Smart Schedule',
    html,
    text,
  });
};

export const sendPasswordResetConfirmation = async (
  email: string,
  firstName: string
) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .container {
          background: linear-gradient(135deg, #1e3a5f 0%, #87CEEB 100%);
          padding: 40px;
          border-radius: 10px;
        }
        .content {
          background: white;
          padding: 30px;
          border-radius: 8px;
        }
        .header {
          text-align: center;
          color: #1e3a5f;
          margin-bottom: 30px;
        }
        .success-icon {
          font-size: 48px;
          text-align: center;
          margin: 20px 0;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          font-size: 12px;
          color: #666;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="content">
          <div class="success-icon">✅</div>
          <div class="header">
            <h1>Password Reset Successful</h1>
          </div>
          
          <p>Hello ${firstName},</p>
          
          <p>Your password has been successfully reset. You can now log in with your new password.</p>
          
          <p>If you didn't make this change, please contact us immediately.</p>
          
          <div class="footer">
            <p><strong>Smart Schedule System</strong></p>
            <p>This is an automated email. Please do not reply to this message.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: 'Password Reset Confirmation - Smart Schedule',
    html,
  });
};