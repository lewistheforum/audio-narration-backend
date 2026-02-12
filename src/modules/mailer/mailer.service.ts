import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  constructor(private readonly configService: ConfigService) {}

  mailTransport(): nodemailer.Transporter {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      port: 465,
      secure: true,
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASSWORD'),
      },
    });
    return transporter;
  }

  /**
   * Send Account Warning Email
   */
  async sendAccountWarningEmail(
    email: string,
    name: string,
    reason: string,
    strikes: number,
  ): Promise<void> {
    const transporter = this.mailTransport();
    const mailOptions = {
      from: {
        name: 'Medicare',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: '⚠️ Account Warning - Medicare',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img 
              alt="Medicare Logo" 
              style="width: 150px; height: auto;"
              src="https://res.cloudinary.com/dx1ejni0o/image/upload/v1758100904/crypto/ikz8lyq7dmaesm8atpxh.png"
            />
          </div>
          
          <div style="background: #FFFBEB; border-radius: 10px; padding: 30px; text-align: center; border: 1px solid #FCD34D;">
            <h1 style="color: #D97706; margin: 0 0 20px 0;">⚠️ Account Warning</h1>
            <p style="color: #4B5563; font-size: 16px; margin: 0 0 20px 0;">
              Hi ${name},
            </p>
            <p style="color: #4B5563; font-size: 16px; margin: 0 0 20px 0;">
              Your account has received a warning. This is strike <strong>${strikes}/3</strong>.
            </p>
            
            <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: left;">
              <p style="margin: 0; color: #6B7280; font-size: 14px; font-weight: 600;">Reason:</p>
              <p style="margin: 5px 0 0 0; color: #111827;">${reason}</p>
            </div>

            <p style="color: #DC2626; font-size: 14px; margin: 20px 0 0 0; font-weight: 600;">
              Please note that accumulating 3 strikes will result in a permanent ban.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
              © 2025 Medicare. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ Warning email sent to ${email}`);
    } catch (error) {
      console.error('❌ Failed to send warning email:', error);
    }
  }

  /**
   * Send Account Banned Email
   */
  async sendAccountBannedEmail(
    email: string,
    name: string,
    reason: string,
  ): Promise<void> {
    const transporter = this.mailTransport();
    const mailOptions = {
      from: {
        name: 'Medicare',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: '🚫 Account Banned - Medicare',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img 
              alt="Medicare Logo" 
              style="width: 150px; height: auto;"
              src="https://res.cloudinary.com/dx1ejni0o/image/upload/v1758100904/crypto/ikz8lyq7dmaesm8atpxh.png"
            />
          </div>
          
          <div style="background: #FEF2F2; border-radius: 10px; padding: 30px; text-align: center; border: 1px solid #FECACA;">
            <h1 style="color: #DC2626; margin: 0 0 20px 0;">🚫 Account Suspended</h1>
            <p style="color: #4B5563; font-size: 16px; margin: 0 0 20px 0;">
              Hi ${name},
            </p>
            <p style="color: #4B5563; font-size: 16px; margin: 0 0 20px 0;">
              Your account has been permanently banned due to multiple violations (3/3 strikes).
            </p>
            
            <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: left;">
              <p style="margin: 0; color: #6B7280; font-size: 14px; font-weight: 600;">Reason:</p>
              <p style="margin: 5px 0 0 0; color: #111827;">${reason}</p>
            </div>

            <p style="color: #6B7280; font-size: 14px; margin: 20px 0 0 0;">
              If you believe this is a mistake, please contact our support team.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
              © 2025 Medicare. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ Ban email sent to ${email}`);
    } catch (error) {
      console.error('❌ Failed to send ban email:', error);
    }
  }

  /**
   * Send Account Unbanned Email
   */
  async sendAccountUnbannedEmail(email: string, name: string): Promise<void> {
    const transporter = this.mailTransport();
    const mailOptions = {
      from: {
        name: 'Medicare',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: '✅ Account Restored - Medicare',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img 
              alt="Medicare Logo" 
              style="width: 150px; height: auto;"
              src="https://res.cloudinary.com/dx1ejni0o/image/upload/v1758100904/crypto/ikz8lyq7dmaesm8atpxh.png"
            />
          </div>
          
          <div style="background: #F0FDF4; border-radius: 10px; padding: 30px; text-align: center; border: 1px solid #BBF7D0;">
            <h1 style="color: #166534; margin: 0 0 20px 0;">✅ Account Restored</h1>
            <p style="color: #4B5563; font-size: 16px; margin: 0 0 20px 0;">
              Hi ${name},
            </p>
            <p style="color: #4B5563; font-size: 16px; margin: 0 0 20px 0;">
              Great news! Your account has been reactivated and your ban strikes have been reset.
            </p>
            
            <p style="color: #6B7280; font-size: 14px; margin: 20px 0 0 0;">
              Please ensure you follow our community guidelines to maintain your active status.
            </p>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173'}" 
                 style="background: #166534; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
                Login Now
              </a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
              © 2025 Medicare. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ Unban email sent to ${email}`);
    } catch (error) {
      console.error('❌ Failed to send unban email:', error);
    }
  }

  /**
   * Send Email Verification Code
   * Sends a 6-digit verification code to user's email
   */
  async sendVerificationCode(
    email: string,
    code: string,
    firstName?: string,
  ): Promise<void> {
    const transporter = this.mailTransport();
    const displayName = firstName || 'User';

    const mailOptions = {
      from: {
        name: 'Medicare',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: 'Verify Your Email - Medicare',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img 
              alt="Medicare Logo" 
              style="width: 150px; height: auto;"
              src="https://res.cloudinary.com/dx1ejni0o/image/upload/v1758100904/crypto/ikz8lyq7dmaesm8atpxh.png"
            />
          </div>
          
          <div style="background: #f8f9fa; border-radius: 10px; padding: 30px; text-align: center;">
            <h1 style="color: #4F46E5; margin: 0 0 20px 0;">Email Verification</h1>
            <p style="color: #6B7280; font-size: 16px; margin: 0 0 30px 0;">
              Hi ${displayName},
            </p>
            <p style="color: #6B7280; font-size: 16px; margin: 0 0 30px 0;">
              Thank you for registering with Medicare. Please use the verification code below to verify your email address:
            </p>
            
            <div style="background: white; border: 2px dashed #4F46E5; border-radius: 8px; padding: 20px; margin: 30px 0;">
              <h2 style="color: #4F46E5; font-size: 36px; letter-spacing: 8px; margin: 0;">
                ${code}
              </h2>
            </div>
            
            <p style="color: #6B7280; font-size: 14px; margin: 30px 0 0 0;">
              This code will expire in <strong>15 minutes</strong>.
            </p>
            <p style="color: #6B7280; font-size: 14px; margin: 10px 0 0 0;">
              If you didn't create an account with Medicare, please ignore this email.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
              © 2025 Medicare. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ Verification code sent to ${email}`);
    } catch (error) {
      console.error('❌ Failed to send verification email:', error);
      throw new Error('Failed to send verification email');
    }
  }

  /**
   * Send Password Reset Code
   * Sends a 6-digit reset code to user's email for password reset
   */
  async sendPasswordResetCode(
    email: string,
    code: string,
    firstName?: string,
  ): Promise<void> {
    const transporter = this.mailTransport();
    const displayName = firstName || 'User';

    const mailOptions = {
      from: {
        name: 'Medicare',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: 'Password Reset Request - Medicare',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img 
              alt="Medicare Logo" 
              style="width: 150px; height: auto;"
              src="https://res.cloudinary.com/dx1ejni0o/image/upload/v1758100904/crypto/ikz8lyq7dmaesm8atpxh.png"
            />
          </div>
          
          <div style="background: #FEF2F2; border-radius: 10px; padding: 30px; text-align: center;">
            <h1 style="color: #DC2626; margin: 0 0 20px 0;">🔐 Password Reset Request</h1>
            <p style="color: #6B7280; font-size: 16px; margin: 0 0 30px 0;">
              Hi ${displayName},
            </p>
            <p style="color: #6B7280; font-size: 16px; margin: 0 0 30px 0;">
              We received a request to reset your password. Use the code below to proceed:
            </p>
            
            <div style="background: white; border: 2px dashed #DC2626; border-radius: 8px; padding: 20px; margin: 30px 0;">
              <h2 style="color: #DC2626; font-size: 36px; letter-spacing: 8px; margin: 0;">
                ${code}
              </h2>
            </div>
            
            <p style="color: #6B7280; font-size: 14px; margin: 30px 0 0 0;">
              This code will expire in <strong>15 minutes</strong>.
            </p>
            <p style="color: #DC2626; font-size: 14px; margin: 10px 0 0 0; font-weight: 600;">
              ⚠️ If you didn't request this password reset, please ignore this email or contact support if you're concerned.
            </p>
          </div>
          
          <div style="background: #F3F4F6; border-radius: 8px; padding: 20px; margin-top: 20px;">
            <h3 style="color: #111827; margin: 0 0 10px 0; font-size: 16px;">Security Tips:</h3>
            <ul style="color: #6B7280; font-size: 14px; margin: 10px 0; padding-left: 20px;">
              <li>Never share your reset code with anyone</li>
              <li>Medicare will never ask for your password via email</li>
              <li>Use a strong, unique password for your account</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
              © 2025 Medicare. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ Password reset code sent to ${email}`);
    } catch (error) {
      console.error('❌ Failed to send password reset email:', error);
      throw new Error('Failed to send password reset email');
    }
  }

  /**
   * Send Contract Signing OTP
   * Sends a 6-digit OTP for contract signing
   */
  async sendContractSigningCode(
    email: string,
    code: string,
    contractCode: string,
    firstName?: string,
  ): Promise<void> {
    const transporter = this.mailTransport();
    const displayName = firstName || 'User';

    const mailOptions = {
      from: {
        name: 'Medicare',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: 'Contract Signing OTP - Medicare',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img 
              alt="Medicare Logo" 
              style="width: 150px; height: auto;"
              src="https://res.cloudinary.com/dx1ejni0o/image/upload/v1758100904/crypto/ikz8lyq7dmaesm8atpxh.png"
            />
          </div>
          
          <div style="background: #f0fdf4; border-radius: 10px; padding: 30px; text-align: center;">
            <h1 style="color: #166534; margin: 0 0 20px 0;">✍️ Contract Signing OTP</h1>
            <p style="color: #6B7280; font-size: 16px; margin: 0 0 30px 0;">
              Hi ${displayName},
            </p>
            <p style="color: #6B7280; font-size: 16px; margin: 0 0 30px 0;">
              You are attempting to sign contract <strong>#${contractCode}</strong>. Please use the verification code below to confirm your signature:
            </p>
            
            <div style="background: white; border: 2px dashed #166534; border-radius: 8px; padding: 20px; margin: 30px 0;">
              <h2 style="color: #166534; font-size: 36px; letter-spacing: 8px; margin: 0;">
                ${code}
              </h2>
            </div>
            
            <p style="color: #6B7280; font-size: 14px; margin: 30px 0 0 0;">
              This code will expire in <strong>15 minutes</strong>.
            </p>
            <p style="color: #166534; font-size: 14px; margin: 10px 0 0 0; font-weight: 600;">
               If you are not trying to sign this contract, please contact support immediately.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
              © 2025 Medicare. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ Contract signing OTP sent to ${email}`);
    } catch (error) {
      console.error('❌ Failed to send contract signing OTP:', error);
      throw new Error('Failed to send contract signing OTP');
    }
  }

  /**
   * Send Welcome Email
   * Sends a welcome email after successful email verification
   */
  async sendWelcomeEmail(
    email: string,
    firstName?: string,
    lastName?: string,
  ): Promise<void> {
    const transporter = this.mailTransport();
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'User';

    const mailOptions = {
      from: {
        name: 'Medicare',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: 'Welcome to Medicare!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img 
              alt="Medicare Logo" 
              style="width: 150px; height: auto;"
              src="https://res.cloudinary.com/dx1ejni0o/image/upload/v1758100904/crypto/ikz8lyq7dmaesm8atpxh.png"
            />
          </div>
          
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px; padding: 40px; text-align: center; color: white;">
            <h1 style="margin: 0 0 20px 0; font-size: 32px;">🎉 Welcome to Medicare!</h1>
            <p style="font-size: 18px; margin: 0 0 10px 0;">
              Hi ${fullName},
            </p>
            <p style="font-size: 16px; margin: 0; opacity: 0.9;">
              Your email has been successfully verified!
            </p>
          </div>
          
          <div style="background: #f8f9fa; border-radius: 10px; padding: 30px; margin-top: 20px;">
            <h2 style="color: #111827; margin: 0 0 20px 0;">What's Next?</h2>
            
            <div style="margin: 20px 0;">
              <div style="display: flex; align-items: start; margin-bottom: 15px;">
                <div style="background: #4F46E5; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; flex-shrink: 0;">1</div>
                <div>
                  <h3 style="margin: 0 0 5px 0; color: #111827;">Complete Your Profile</h3>
                  <p style="margin: 0; color: #6B7280; font-size: 14px;">Add your personal information to get started</p>
                </div>
              </div>
              
              <div style="display: flex; align-items: start; margin-bottom: 15px;">
                <div style="background: #4F46E5; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; flex-shrink: 0;">2</div>
                <div>
                  <h3 style="margin: 0 0 5px 0; color: #111827;">Explore Our Services</h3>
                  <p style="margin: 0; color: #6B7280; font-size: 14px;">Discover healthcare services tailored for you</p>
                </div>
              </div>
              
              <div style="display: flex; align-items: start;">
                <div style="background: #4F46E5; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; flex-shrink: 0;">3</div>
                <div>
                  <h3 style="margin: 0 0 5px 0; color: #111827;">Stay Connected</h3>
                  <p style="margin: 0; color: #6B7280; font-size: 14px;">We'll keep you updated with the latest health tips</p>
                </div>
              </div>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${
                this.configService.get<string>('FRONTEND_URL') ||
                'http://localhost:5173'
              }" 
                 style="background: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
                Get Started
              </a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #6B7280; font-size: 14px; margin: 0 0 10px 0;">
              Need help? Contact us at 
              <a href="mailto:support@medicare.com" style="color: #4F46E5; text-decoration: none;">support@medicare.com</a>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
              © 2025 Medicare. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ Welcome email sent to ${email}`);
    } catch (error) {
      console.error('❌ Failed to send welcome email:', error);
      throw new Error('Failed to send welcome email');
    }
  }

  /**
   * Legacy send mail method
   * @deprecated Use sendVerificationCode or sendWelcomeEmail instead
   */
  async sendMail(targetMail: string): Promise<any> {
    const transporter = this.mailTransport();
    const mailOptions = {
      from: {
        name: 'Medicare',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: [targetMail],
      subject: 'Medicare Subject',
      text: 'Medicare Text',
      html: ` 
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="margin: 16px 0;">
                <img 
                  alt="Medicare" 
                  style="width: 100%; border-radius: 12px; object-fit: cover;"
                  height="320"
                  src="https://res.cloudinary.com/dx1ejni0o/image/upload/v1758100904/crypto/ikz8lyq7dmaesm8atpxh.png"
                />
              </div>
              <div style="margin-top: 32px; text-align: center;">
                <p style="margin: 16px 0; font-weight: 600; font-size: 18px; color: #4F46E5; line-height: 28px;">
                  New Contact
                </p>
                <h1 style="margin: 0; margin-top: 8px; font-weight: 600; font-size: 36px; color: #111827; line-height: 36px;">
                  Nguyen Van A
                </h1>
                <p style="font-size: 16px; color: #6B7280; line-height: 24px;">
                  Phone Number: 0909090909
                </p>
                <p style="font-size: 16px; color: #6B7280; line-height: 24px;">
                  Service: Service Text
                </p>
                <p style="font-size: 16px; color: #6B7280; line-height: 24px;">
                  Budget: Budget Text
                </p>
                <p style="font-size: 16px; color: #6B7280; line-height: 24px;">
                  Request: Request Text
                </p>
              </div>
            </div>
            `,
      attachments: [
        {
          filename: 'logo-medicare.png',
          path: 'https://res.cloudinary.com/dx1ejni0o/image/upload/v1758100904/crypto/ikz8lyq7dmaesm8atpxh.png',
          contentType: 'image/png',
        },
      ],
    };

    try {
      return await transporter.sendMail(mailOptions);
    } catch (error) {
      console.log('❌ Failed to send mail: ', error);
      throw new Error('Failed to send mail');
    }
  }

  // Send email verification (HTML template)
  async sendVerificationEmail(email: string, code: string) {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
      console.error('SMTP_USER or SMTP_PASS not configured in .env file');
      return;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass,
      },
    });

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Email Verification for Account Registration</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 16px 30px rgba(15,23,42,0.18);">
            <tr>
              <td style="padding:24px 28px 16px 28px;">
                <p style="margin:0 0 8px 0;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#6b7280;">
                  Medicare App
                </p>
                <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;font-weight:700;color:#111827;text-align:center;">
                  Email Verification for Account Registration
                </h1>
                <p style="margin:0 0 6px 0;font-size:14px;line-height:1.6;color:#374151;">
                  Hello from Medicare,
                </p>
                <p style="margin:0;font-size:14px;line-height:1.6;color:#374151;">
                  Thank you for registering an account on <strong>Medicare</strong>.<br/>
                  Your email verification code is:
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 28px 16px 28px;">
                <span style="display:inline-block;padding:12px 24px;border-radius:999px;background-color:#111827;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.35em;">
                  ${code}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 20px 28px;">
                <p style="margin:0 0 4px 0;font-size:13px;line-height:1.6;color:#4b5563;">
                  This code is valid for <strong>10 minutes</strong>. Please do not share this code with anyone.
                </p>
                <p style="margin:0 0 12px 0;font-size:13px;line-height:1.6;color:#4b5563;">
                  If you did not register for this account, please ignore this email.
                </p>
                <p style="margin:0;font-size:11px;line-height:1.6;color:#9ca3af;">
                  This is an automated email, please do not reply.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    const mailOptions = {
      from: `"Medicare App" <${user}>`,
      to: email,
      subject: 'Email Verification for Account Registration',
      text: `Your verification code is: ${code}. Code is valid for 10 minutes.`,
      html,
    };

    await transporter.sendMail(mailOptions);
  }

  // Send password reset email (HTML template)
  private async sendResetPasswordEmail(email: string, code: string) {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
      console.error('SMTP_USER or SMTP_PASS not configured in .env file');
      return;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass,
      },
    });

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Password Reset Request</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 16px 30px rgba(15,23,42,0.18);">
            <tr>
              <td style="padding:24px 28px 16px 28px;">
                <p style="margin:0 0 8px 0;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#6b7280;">
                  Medicare App
                </p>
                <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;font-weight:700;color:#111827;text-align:center;">
                  Password Reset Request
                </h1>
                <p style="margin:0 0 6px 0;font-size:14px;line-height:1.6;color:#374151;">
                  Hello from Medicare,
                </p>
                <p style="margin:0;font-size:14px;line-height:1.6;color:#374151;">
                  We received a password reset request for the account using email:
                  <strong>${email}</strong>.<br/>
                  Your password reset code is:
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 28px 16px 28px;">
                <span style="display:inline-block;padding:12px 24px;border-radius:999px;background-color:#111827;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.35em;">
                  ${code}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 20px 28px;">
                <p style="margin:0 0 4px 0;font-size:13px;line-height:1.6;color:#4b5563;">
                  This code is valid for <strong>10 minutes</strong>. If you did not request a password reset, please ignore this email.
                </p>
                <p style="margin:0 0 12px 0;font-size:13px;line-height:1.6;color:#4b5563;">
                  For security reasons, never share this code with anyone.
                </p>
                <p style="margin:0;font-size:11px;line-height:1.6;color:#9ca3af;">
                  This is an automated email, please do not reply.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    const mailOptions = {
      from: `"Medicare App" <${user}>`,
      to: email,
      subject: 'Password Reset Request',
      text: `Your password reset code is: ${code}. Code is valid for 10 minutes.`,
      html,
    };

    await transporter.sendMail(mailOptions);
  }

  /**
   * Send Clinic Admin Welcome Email
   * Sends a welcome email after clinic admin registration, instructing to check Payment Configuration
   */
  async sendClinicAdminWelcomeEmail(
    email: string,
    clinicName?: string,
  ): Promise<void> {
    const transporter = this.mailTransport();
    const displayName = clinicName || 'Clinic';

    const mailOptions = {
      from: {
        name: 'Medicare',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: 'Welcome to Medicare - Clinic Registration Initiated',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img
              alt="Medicare Logo"
              style="width: 150px; height: auto;"
              src="https://res.cloudinary.com/dx1ejni0o/image/upload/v1758100904/crypto/ikz8lyq7dmaesm8atpxh.png"
            />
          </div>
          
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px; padding: 40px; text-align: center; color: white;">
            <h1 style="margin: 0 0 20px 0; font-size: 32px;">🏥 Welcome to Medicare!</h1>
            <p style="font-size: 18px; margin: 0 0 10px 0;">
              ${displayName}
            </p>
            <p style="font-size: 16px; margin: 0; opacity: 0.9;">
              Your clinic registration has been successfully initiated!
            </p>
          </div>
          
          <div style="background: #f8f9fa; border-radius: 10px; padding: 30px; margin-top: 20px;">
            <h2 style="color: #111827; margin: 0 0 20px 0;">What's Next?</h2>
            
            <div style="margin: 20px 0;">
              <div style="display: flex; align-items: start; margin-bottom: 15px;">
                <div style="background: #4F46E5; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; flex-shrink: 0;">1</div>
                <div>
                  <h3 style="margin: 0 0 5px 0; color: #111827;">Configure Payment Settings</h3>
                  <p style="margin: 0; color: #6B7280; font-size: 14px;">Complete your payment configuration to proceed</p>
                </div>
              </div>
              
              <div style="display: flex; align-items: start; margin-bottom: 15px;">
                <div style="background: #4F46E5; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; flex-shrink: 0;">2</div>
                <div>
                  <h3 style="margin: 0 0 5px 0; color: #111827;">Create Clinic Manager Account</h3>
                  <p style="margin: 0; color: #6B7280; font-size: 14px;">Set up your clinic manager credentials</p>
                </div>
              </div>
              
              <div style="display: flex; align-items: start;">
                <div style="background: #4F46E5; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; flex-shrink: 0;">3</div>
                <div>
                  <h3 style="margin: 0 0 5px 0; color: #111827;">Upload Legal Documents</h3>
                  <p style="margin: 0; color: #6B7280; font-size: 14px;">Submit required documentation for verification</p>
                </div>
              </div>
            </div>
            
            <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin-top: 20px;">
              <p style="margin: 0; color: #92400E; font-size: 14px;">
                <strong>⚠️ Important:</strong> Please complete your Payment Configuration before proceeding with the next steps.
              </p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #6B7280; font-size: 14px; margin: 0 0 10px 0;">
              Need help? Contact us at
              <a href="mailto:support@medicare.com" style="color: #4F46E5; text-decoration: none;">support@medicare.com</a>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
              © 2025 Medicare. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ Clinic admin welcome email sent to ${email}`);
    } catch (error) {
      console.error('❌ Failed to send clinic admin welcome email:', error);
      // Don't throw error - email should be fire-and-forget
    }
  }

  /**
   * Send Manager Credentials Email
   * Sends generated credentials to Clinic Manager
   */
  async sendManagerCredentialsEmail(
    managerEmail: string,
    username: string,
    password: string,
    clinicName?: string,
  ): Promise<void> {
    const transporter = this.mailTransport();
    const displayName = clinicName || 'Clinic';

    const mailOptions = {
      from: {
        name: 'Medicare',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: managerEmail,
      subject: 'Your Clinic Manager Account Credentials - Medicare',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img
              alt="Medicare Logo"
              style="width: 150px; height: auto;"
              src="https://res.cloudinary.com/dx1ejni0o/image/upload/v1758100904/crypto/ikz8lyq7dmaesm8atpxh.png"
            />
          </div>
          
          <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); border-radius: 10px; padding: 40px; text-align: center; color: white;">
            <h1 style="margin: 0 0 20px 0; font-size: 32px;">👋 Welcome, Clinic Manager!</h1>
            <p style="font-size: 18px; margin: 0 0 10px 0;">
              ${displayName}
            </p>
            <p style="font-size: 16px; margin: 0; opacity: 0.9;">
              Your account has been created successfully!
            </p>
          </div>
          
          <div style="background: #f8f9fa; border-radius: 10px; padding: 30px; margin-top: 20px;">
            <h2 style="color: #111827; margin: 0 0 20px 0; text-align: center;">Your Login Credentials</h2>
            
            <div style="background: white; border: 2px solid #E5E7EB; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <div style="margin-bottom: 15px;">
                <p style="margin: 0 0 5px 0; color: #6B7280; font-size: 14px; font-weight: 600;">Username:</p>
                <p style="margin: 0; color: #111827; font-size: 18px; font-weight: 600;">${username}</p>
              </div>
              
              <div style="margin-bottom: 15px;">
                <p style="margin: 0 0 5px 0; color: #6B7280; font-size: 14px; font-weight: 600;">Password:</p>
                <p style="margin: 0; color: #111827; font-size: 18px; font-weight: 600;">${password}</p>
              </div>
            </div>
            
            <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin-top: 20px;">
              <p style="margin: 0; color: #92400E; font-size: 14px;">
                <strong>⚠️ Important:</strong> Please change your password after your first login for security purposes.
              </p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="${
              this.configService.get<string>('FRONTEND_URL') ||
              'http://localhost:5173'
            }/login"
               style="background: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
              Login to Your Account
            </a>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #6B7280; font-size: 14px; margin: 0 0 10px 0;">
              Need help? Contact us at
              <a href="mailto:support@medicare.com" style="color: #4F46E5; text-decoration: none;">support@medicare.com</a>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
              © 2025 Medicare. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ Manager credentials email sent to ${managerEmail}`);
    } catch (error) {
      console.error('❌ Failed to send manager credentials email:', error);
      // Don't throw error - email should be fire-and-forget
    }
  }

  /**
   * Send Registration Approved Email
   * Notifies admin of approval and requests payment
   */
  async sendRegistrationApprovedEmail(
    adminEmail: string,
    clinicName?: string,
  ): Promise<void> {
    const transporter = this.mailTransport();
    const displayName = clinicName || 'Clinic';

    const mailOptions = {
      from: {
        name: 'Medicare',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: adminEmail,
      subject: '🎉 Registration Approved - Medicare',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img
              alt="Medicare Logo"
              style="width: 150px; height: auto;"
              src="https://res.cloudinary.com/dx1ejni0o/image/upload/v1758100904/crypto/ikz8lyq7dmaesm8atpxh.png"
            />
          </div>
          
          <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); border-radius: 10px; padding: 40px; text-align: center; color: white;">
            <h1 style="margin: 0 0 20px 0; font-size: 32px;">🎉 Registration Approved!</h1>
            <p style="font-size: 18px; margin: 0 0 10px 0;">
              ${displayName}
            </p>
            <p style="font-size: 16px; margin: 0; opacity: 0.9;">
              Your clinic registration has been approved by Medicare!
            </p>
          </div>
          
          <div style="background: #f8f9fa; border-radius: 10px; padding: 30px; margin-top: 20px;">
            <h2 style="color: #111827; margin: 0 0 20px 0;">Next Steps</h2>
            
            <div style="margin: 20px 0;">
              <div style="display: flex; align-items: start; margin-bottom: 15px;">
                <div style="background: #10B981; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; flex-shrink: 0;">✓</div>
                <div>
                  <h3 style="margin: 0 0 5px 0; color: #111827;">Registration Approved</h3>
                  <p style="margin: 0; color: #6B7280; font-size: 14px;">Your clinic registration has been reviewed and approved</p>
                </div>
              </div>
              
              <div style="display: flex; align-items: start;">
                <div style="background: #F59E0B; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; flex-shrink: 0;">!</div>
                <div>
                  <h3 style="margin: 0 0 5px 0; color: #111827;">Complete Payment</h3>
                  <p style="margin: 0; color: #6B7280; font-size: 14px;">Please complete your subscription payment to activate your clinic</p>
                </div>
              </div>
            </div>
            
            <div style="background: #ECFDF5; border: 2px solid #10B981; border-radius: 8px; padding: 20px; margin-top: 20px;">
              <h3 style="margin: 0 0 10px 0; color: #065F46; font-size: 16px;">Payment Required</h3>
              <p style="margin: 0; color: #047857; font-size: 14px;">
                Your clinic is ready to go! Please complete the payment process to activate your subscription and start using Medicare services.
              </p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="${
              this.configService.get<string>('FRONTEND_URL') ||
              'http://localhost:5173'
            }/payment"
               style="background: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
              Complete Payment
            </a>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #6B7280; font-size: 14px; margin: 0 0 10px 0;">
              Need help? Contact us at
              <a href="mailto:support@medicare.com" style="color: #4F46E5; text-decoration: none;">support@medicare.com</a>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
              © 2025 Medicare. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ Registration approved email sent to ${adminEmail}`);
    } catch (error) {
      console.error('❌ Failed to send registration approved email:', error);
      // Don't throw error - email should be fire-and-forget
    }
  }

  /**
   * Send Registration Rejected Email
   * Notifies admin of rejection with reason
   */
  async sendRegistrationRejectedEmail(
    adminEmail: string,
    reason: string,
    clinicName?: string,
  ): Promise<void> {
    const transporter = this.mailTransport();
    const displayName = clinicName || 'Clinic';

    const mailOptions = {
      from: {
        name: 'Medicare',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: adminEmail,
      subject: 'Registration Update - Medicare',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img
              alt="Medicare Logo"
              style="width: 150px; height: auto;"
              src="https://res.cloudinary.com/dx1ejni0o/image/upload/v1758100904/crypto/ikz8lyq7dmaesm8atpxh.png"
            />
          </div>
          
          <div style="background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); border-radius: 10px; padding: 40px; text-align: center; color: white;">
            <h1 style="margin: 0 0 20px 0; font-size: 32px;">📋 Registration Update</h1>
            <p style="font-size: 18px; margin: 0 0 10px 0;">
              ${displayName}
            </p>
            <p style="font-size: 16px; margin: 0; opacity: 0.9;">
              Your registration requires attention
            </p>
          </div>
          
          <div style="background: #f8f9fa; border-radius: 10px; padding: 30px; margin-top: 20px;">
            <h2 style="color: #111827; margin: 0 0 20px 0;">Rejection Reason</h2>
            
            <div style="background: #FEF2F2; border: 2px solid #EF4444; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <p style="margin: 0; color: #7F1D1D; font-size: 16px; line-height: 1.6;">
                ${reason}
              </p>
            </div>
            
            <h2 style="color: #111827; margin: 30px 0 20px 0;">What You Need To Do</h2>
            
            <div style="margin: 20px 0;">
              <div style="display: flex; align-items: start; margin-bottom: 15px;">
                <div style="background: #EF4444; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; flex-shrink: 0;">1</div>
                <div>
                  <h3 style="margin: 0 0 5px 0; color: #111827;">Review the Reason</h3>
                  <p style="margin: 0; color: #6B7280; font-size: 14px;">Carefully review the reason for rejection above</p>
                </div>
              </div>
              
              <div style="display: flex; align-items: start; margin-bottom: 15px;">
                <div style="background: #EF4444; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; flex-shrink: 0;">2</div>
                <div>
                  <h3 style="margin: 0 0 5px 0; color: #111827;">Update Documents</h3>
                  <p style="margin: 0; color: #6B7280; font-size: 14px;">Update your legal documents based on the feedback</p>
                </div>
              </div>
              
              <div style="display: flex; align-items: start;">
                <div style="background: #EF4444; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; flex-shrink: 0;">3</div>
                <div>
                  <h3 style="margin: 0 0 5px 0; color: #111827;">Resubmit for Review</h3>
                  <p style="margin: 0; color: #6B7280; font-size: 14px;">Submit your updated documents for re-verification</p>
                </div>
              </div>
            </div>
            
            <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin-top: 20px;">
              <p style="margin: 0; color: #92400E; font-size: 14px;">
                <strong>💡 Tip:</strong> If you have questions about the rejection reason, please contact our support team for clarification.
              </p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="${
              this.configService.get<string>('FRONTEND_URL') ||
              'http://localhost:5173'
            }/documents"
               style="background: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
              Update Documents
            </a>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #6B7280; font-size: 14px; margin: 0 0 10px 0;">
              Need help? Contact us at
              <a href="mailto:support@medicare.com" style="color: #4F46E5; text-decoration: none;">support@medicare.com</a>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
              © 2025 Medicare. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ Registration rejected email sent to ${adminEmail}`);
    } catch (error) {
      console.error('❌ Failed to send registration rejected email:', error);
      // Don't throw error - email should be fire-and-forget
    }
  }
}
