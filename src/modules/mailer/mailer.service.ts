import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * ============================================================================
 * SUBSCRIPTION EMAIL INTERFACES
 * ============================================================================
 */

/**
 * Context for warning emails (7-day or 1-day warnings)
 */
export interface WarningEmailContext {
  clinicName: string;
  planName: string;
  expirationDate: string; // Formatted date string
  renewalLink: string;
}

/**
 * Context for reassurance emails (renewal already scheduled)
 */
export interface ReassuranceEmailContext {
  clinicName: string;
  currentPlan: string;
  nextPlan: string;
  renewalDate: string; // Formatted date string
}

/**
 * Context for subscription expired email
 */
export interface ExpiredEmailContext {
  clinicName: string;
  planName: string;
  expirationDate: string; // Formatted date string
  renewalLink: string;
}

/**
 * Context for renewal success email
 */
export interface RenewalSuccessContext {
  clinicName: string;
  planName: string;
  startDate: string; // Formatted date string
  endDate: string; // Formatted date string
  transactionId: string;
  invoiceLink: string;
}

/**
 * Context for plan change success email
 */
export interface PlanChangeContext {
  clinicName: string;
  oldPlan: string;
  newPlan: string;
  startDate: string; // Formatted date string
  endDate: string; // Formatted date string
}

/**
 * Context for appointment reminder email
 */
export interface AppointmentReminderContext {
  patientName: string;
  clinicName: string;
  clinicAddress: string;
  clinicPhone: string;
  appointmentDate: string; // Formatted date
  appointmentHour: string; // Formatted time
  doctorName: string;
  doctorSpecialization?: string;
  services: Array<{
    serviceName: string;
    serviceType: string;
  }>;
}

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
        name: 'Bonix',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: '⚠️ Account Warning - Bonix',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img 
              alt="Bonix Logo" 
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
              © 2025 Bonix. All rights reserved.
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
        name: 'Bonix',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: '🚫 Account Banned - Bonix',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img 
              alt="Bonix Logo" 
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
              © 2025 Bonix. All rights reserved.
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
        name: 'Bonix',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: '✅ Account Restored - Bonix',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img 
              alt="Bonix Logo" 
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
              © 2025 Bonix. All rights reserved.
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
   * Send Clinic Admin Warning Email
   */
  async sendClinicAdminWarningEmail(
    email: string,
    name: string,
    reason: string,
    strikes: number,
  ): Promise<void> {
    const transporter = this.mailTransport();
    const mailOptions = {
      from: {
        name: 'Bonix',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: '⚠️ Clinic Account Warning - Bonix',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img 
              alt="Bonix Logo" 
              style="width: 150px; height: auto;"
              src="https://res.cloudinary.com/dx1ejni0o/image/upload/v1758100904/crypto/ikz8lyq7dmaesm8atpxh.png"
            />
          </div>
          
          <div style="background: #FFFBEB; border-radius: 10px; padding: 30px; text-align: center; border: 1px solid #FCD34D;">
            <h1 style="color: #D97706; margin: 0 0 20px 0;">⚠️ Clinic Account Warning</h1>
            <p style="color: #4B5563; font-size: 16px; margin: 0 0 20px 0;">
              Hi ${name},
            </p>
            <p style="color: #4B5563; font-size: 16px; margin: 0 0 20px 0;">
              Your clinic account has received a warning. This is strike <strong>${strikes}/3</strong>.
            </p>
            
            <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: left;">
              <p style="margin: 0; color: #6B7280; font-size: 14px; font-weight: 600;">Reason:</p>
              <p style="margin: 5px 0 0 0; color: #111827;">${reason}</p>
            </div>

            <p style="color: #DC2626; font-size: 14px; margin: 20px 0 0 0; font-weight: 600;">
              Please note that accumulating 3 strikes will result in a permanent ban for your clinic and all associated accounts.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
              © 2025 Bonix. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ Clinic warning email sent to ${email}`);
    } catch (error) {
      console.error('❌ Failed to send clinic warning email:', error);
    }
  }

  /**
   * Send Clinic Admin Banned Email
   */
  async sendClinicAdminBannedEmail(
    email: string,
    name: string,
    reason: string,
  ): Promise<void> {
    const transporter = this.mailTransport();
    const mailOptions = {
      from: {
        name: 'Bonix',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: '🚫 Clinic Account Suspended - Bonix',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img 
              alt="Bonix Logo" 
              style="width: 150px; height: auto;"
              src="https://res.cloudinary.com/dx1ejni0o/image/upload/v1758100904/crypto/ikz8lyq7dmaesm8atpxh.png"
            />
          </div>
          
          <div style="background: #FEF2F2; border-radius: 10px; padding: 30px; text-align: center; border: 1px solid #FECACA;">
            <h1 style="color: #DC2626; margin: 0 0 20px 0;">🚫 Clinic Account Suspended</h1>
            <p style="color: #4B5563; font-size: 16px; margin: 0 0 20px 0;">
              Hi ${name},
            </p>
            <p style="color: #4B5563; font-size: 16px; margin: 0 0 20px 0;">
              Your clinic account has been permanently banned due to multiple violations (3/3 strikes).
            </p>
            <p style="color: #DC2626; font-size: 15px; margin: 0 0 20px 0; font-weight: 600;">
              All associated accounts (Managers, Doctors, Staff) have also been suspended.
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
              © 2025 Bonix. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ Clinic ban email sent to ${email}`);
    } catch (error) {
      console.error('❌ Failed to send clinic ban email:', error);
    }
  }

  /**
   * Send Clinic Admin Unbanned Email
   */
  async sendClinicAdminUnbannedEmail(
    email: string,
    name: string,
  ): Promise<void> {
    const transporter = this.mailTransport();
    const mailOptions = {
      from: {
        name: 'Bonix',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: '✅ Clinic Account Restored - Bonix',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img 
              alt="Bonix Logo" 
              style="width: 150px; height: auto;"
              src="https://res.cloudinary.com/dx1ejni0o/image/upload/v1758100904/crypto/ikz8lyq7dmaesm8atpxh.png"
            />
          </div>
          
          <div style="background: #F0FDF4; border-radius: 10px; padding: 30px; text-align: center; border: 1px solid #BBF7D0;">
            <h1 style="color: #166534; margin: 0 0 20px 0;">✅ Clinic Account Restored</h1>
            <p style="color: #4B5563; font-size: 16px; margin: 0 0 20px 0;">
              Hi ${name},
            </p>
            <p style="color: #4B5563; font-size: 16px; margin: 0 0 20px 0;">
              Great news! Your clinic account and all associated accounts have been reactivated.
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
              © 2025 Bonix. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ Clinic unban email sent to ${email}`);
    } catch (error) {
      console.error('❌ Failed to send clinic unban email:', error);
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
        name: 'Bonix',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: 'Verify Your Email - Bonix',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img 
              alt="Bonix Logo" 
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
              Thank you for registering with Bonix. Please use the verification code below to verify your email address:
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
              If you didn't create an account with Bonix, please ignore this email.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
              © 2025 Bonix. All rights reserved.
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
        name: 'Bonix',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: 'Password Reset Request - Bonix',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img 
              alt="Bonix Logo" 
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
              <li>Bonix will never ask for your password via email</li>
              <li>Use a strong, unique password for your account</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
              © 2025 Bonix. All rights reserved.
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
        name: 'Bonix',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: 'Contract Signing OTP - Bonix',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img 
              alt="Bonix Logo" 
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
              © 2025 Bonix. All rights reserved.
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
        name: 'Bonix',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: 'Welcome to Bonix!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img 
              alt="Bonix Logo" 
              style="width: 150px; height: auto;"
              src="https://res.cloudinary.com/dx1ejni0o/image/upload/v1758100904/crypto/ikz8lyq7dmaesm8atpxh.png"
            />
          </div>
          
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px; padding: 40px; text-align: center; color: white;">
            <h1 style="margin: 0 0 20px 0; font-size: 32px;">🎉 Welcome to Bonix!</h1>
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
              <a href="mailto:support@Bonix.com" style="color: #4F46E5; text-decoration: none;">support@Bonix.com</a>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
              © 2025 Bonix. All rights reserved.
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
        name: 'Bonix',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: [targetMail],
      subject: 'Bonix Subject',
      text: 'Bonix Text',
      html: ` 
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="margin: 16px 0;">
                <img 
                  alt="Bonix" 
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
          filename: 'logo-Bonix.png',
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
                  Bonix App
                </p>
                <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;font-weight:700;color:#111827;text-align:center;">
                  Email Verification for Account Registration
                </h1>
                <p style="margin:0 0 6px 0;font-size:14px;line-height:1.6;color:#374151;">
                  Hello from Bonix,
                </p>
                <p style="margin:0;font-size:14px;line-height:1.6;color:#374151;">
                  Thank you for registering an account on <strong>Bonix</strong>.<br/>
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
      from: `"Bonix App" <${user}>`,
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
                  Bonix App
                </p>
                <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;font-weight:700;color:#111827;text-align:center;">
                  Password Reset Request
                </h1>
                <p style="margin:0 0 6px 0;font-size:14px;line-height:1.6;color:#374151;">
                  Hello from Bonix,
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
      from: `"Bonix App" <${user}>`,
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
        name: 'Bonix',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: 'Welcome to Bonix - Clinic Registration Initiated',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img
              alt="Bonix Logo"
              style="width: 150px; height: auto;"
              src="https://res.cloudinary.com/dx1ejni0o/image/upload/v1758100904/crypto/ikz8lyq7dmaesm8atpxh.png"
            />
          </div>
          
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px; padding: 40px; text-align: center; color: white;">
            <h1 style="margin: 0 0 20px 0; font-size: 32px;">🏥 Welcome to Bonix!</h1>
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
              <a href="mailto:support@Bonix.com" style="color: #4F46E5; text-decoration: none;">support@Bonix.com</a>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
              © 2025 Bonix. All rights reserved.
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
   * Send Contract Signed Notification to Manager
   * Notifies the manager that an employee has signed the contract
   */
  async sendContractSignedNotificationToManager(
    email: string,
    employeeName: string,
    contractId: string,
  ): Promise<void> {
    const transporter = this.mailTransport();
    const contractCode = contractId.substring(0, 8).toUpperCase();

    const mailOptions = {
      from: {
        name: 'Bonix',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: `Action Required: Employee Signed Contract #${contractCode}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img 
              alt="Bonix Logo" 
              style="width: 150px; height: auto;"
              src="https://res.cloudinary.com/dx1ejni0o/image/upload/v1758100904/crypto/ikz8lyq7dmaesm8atpxh.png"
            />
          </div>
          
          <div style="background: #eff6ff; border-radius: 10px; padding: 30px; text-align: center;">
            <h1 style="color: #1e40af; margin: 0 0 20px 0;">✍️ Contract Signed</h1>
            <p style="color: #6B7280; font-size: 16px; margin: 0 0 20px 0;">
              Employee <strong>${employeeName}</strong> has signed the contract <strong>#${contractCode}</strong>.
            </p>
            
            <div style="margin: 30px 0;">
              <a href="${this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173'}/contracts/${contractId}" 
                 style="background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                Review & Sign Now
              </a>
            </div>
            
            <p style="color: #6B7280; font-size: 14px; margin: 0;">
              Please review and countersign to finalize the agreement.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
              © 2025 Bonix. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ Manager notification sent to ${email}`);
    } catch (error) {
      console.error('❌ Failed to send manager notification:', error);
    }
  }

  /**
   * Send Contract Completed Notification to Employee
   * Notifies the employee that the contract is fully signed and active
   */
  async sendContractCompletedNotificationToEmployee(
    email: string,
    managerName: string,
    contractId: string,
    fileUrl: string,
  ): Promise<void> {
    const transporter = this.mailTransport();
    const contractCode = contractId.substring(0, 8).toUpperCase();

    const mailOptions = {
      from: {
        name: 'Bonix',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: `Contract #${contractCode} is Now Active`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img 
              alt="Bonix Logo" 
              style="width: 150px; height: auto;"
              src="https://res.cloudinary.com/dx1ejni0o/image/upload/v1758100904/crypto/ikz8lyq7dmaesm8atpxh.png"
            />
          </div>
          
          <div style="background: #f0fdf4; border-radius: 10px; padding: 30px; text-align: center;">
            <h1 style="color: #166534; margin: 0 0 20px 0;">🎉 Contract Finalized</h1>
            <p style="color: #6B7280; font-size: 16px; margin: 0 0 20px 0;">
              Your contract <strong>#${contractCode}</strong> has been signed by <strong>${managerName}</strong> and is now <strong>ACTIVE</strong>.
            </p>
            
            <div style="margin: 30px 0;">
              <a href="${fileUrl}" 
                 style="background: #166534; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                Download Signed Contract
              </a>
            </div>
            
            <p style="color: #6B7280; font-size: 14px; margin: 0;">
              A copy of the signed document is available at the link above.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
              © 2025 Bonix. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ Employee completed notification sent to ${email}`);
    } catch (error) {
      console.error('❌ Failed to send employee notification:', error);
    }
  }

  /**
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
        name: 'Bonix',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: managerEmail,
      subject: 'Your Clinic Manager Account Credentials - Bonix',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img
              alt="Bonix Logo"
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
              <a href="mailto:support@Bonix.com" style="color: #4F46E5; text-decoration: none;">support@Bonix.com</a>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
              © 2025 Bonix. All rights reserved.
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
        name: 'Bonix',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: adminEmail,
      subject: '🎉 Registration Approved - Bonix',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img
              alt="Bonix Logo"
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
              Your clinic registration has been approved by Bonix!
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
                Your clinic is ready to go! Please complete the payment process to activate your subscription and start using Bonix services.
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
              <a href="mailto:support@Bonix.com" style="color: #4F46E5; text-decoration: none;">support@Bonix.com</a>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
              © 2025 Bonix. All rights reserved.
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
        name: 'Bonix',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: adminEmail,
      subject: 'Registration Update - Bonix',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img
              alt="Bonix Logo"
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
              <a href="mailto:support@Bonix.com" style="color: #4F46E5; text-decoration: none;">support@Bonix.com</a>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
              © 2025 Bonix. All rights reserved.
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

  /**
   * ============================================================================
   * SUBSCRIPTION SWEEPER EMAIL METHODS
   * ============================================================================
   */

  /**
   * Send Subscription Warning Email (7-day or 1-day)
   * Alerts clinic that subscription is expiring soon and action is required
   */
  async sendSubscriptionWarning(
    to: string,
    type: '7_DAYS' | '1_DAY',
    context: WarningEmailContext,
  ): Promise<void> {
    const transporter = this.mailTransport();
    const isUrgent = type === '1_DAY';
    const daysText = isUrgent ? '1 Day' : '7 Days';
    const urgentFlag = isUrgent ? '🚨 URGENT: ' : '';

    const mailOptions = {
      from: {
        name: 'Bonix',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to,
      subject: `${urgentFlag}Your Bonix Subscription Expires in ${daysText}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img 
              alt="Bonix Logo" 
              style="width: 150px; height: auto;"
              src="https://res.cloudinary.com/dx1ejni0o/image/upload/v1758100904/crypto/ikz8lyq7dmaesm8atpxh.png"
            />
          </div>
          
          <div style="background: ${isUrgent ? '#FEF2F2' : '#FFF7ED'}; border-radius: 10px; padding: 30px; border-left: 4px solid ${isUrgent ? '#DC2626' : '#F59E0B'};">
            <h1 style="color: ${isUrgent ? '#DC2626' : '#F59E0B'}; margin: 0 0 20px 0; font-size: 24px;">
              ${isUrgent ? '🚨 URGENT ACTION REQUIRED' : '⏰ Subscription Reminder'}
            </h1>
            <p style="color: #111827; font-size: 16px; margin: 0 0 15px 0;">
              Hi <strong>${context.clinicName}</strong>,
            </p>
            <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">
              Your Bonix subscription (<strong>${context.planName}</strong>) will expire in <strong style="color: ${isUrgent ? '#DC2626' : '#F59E0B'};">${daysText}</strong>.
            </p>
            
            <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span style="color: #6B7280; font-size: 14px;">Current Plan:</span>
                <strong style="color: #111827; font-size: 16px;">${context.planName}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #6B7280; font-size: 14px;">Expiration Date:</span>
                <strong style="color: ${isUrgent ? '#DC2626' : '#F59E0B'}; font-size: 16px;">${context.expirationDate}</strong>
              </div>
            </div>
            
            ${
              isUrgent
                ? `
              <div style="background: #FEE2E2; border: 2px solid #DC2626; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <p style="color: #991B1B; font-size: 14px; margin: 0; font-weight: 600;">
                  ⚠️ Your subscription expires TOMORROW! Renew now to avoid service interruption.
                </p>
              </div>
            `
                : `
              <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0;">
                <p style="color: #92400E; font-size: 14px; margin: 0;">
                  💡 <strong>Tip:</strong> Renew now to ensure uninterrupted access to your Bonix services.
                </p>
              </div>
            `
            }
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${context.renewalLink}"
                 style="background: ${isUrgent ? '#DC2626' : '#F59E0B'}; color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px;">
                ${isUrgent ? 'Renew Now' : 'Renew Subscription'}
              </a>
            </div>
          </div>
          
          <div style="background: #F9FAFB; border-radius: 8px; padding: 20px; margin-top: 20px;">
            <h3 style="color: #111827; margin: 0 0 10px 0; font-size: 16px;">Why Renew?</h3>
            <ul style="color: #6B7280; font-size: 14px; margin: 10px 0; padding-left: 20px;">
              <li>Maintain uninterrupted access to all features</li>
              <li>Continue managing patient appointments seamlessly</li>
              <li>Keep your clinic data secure and accessible</li>
              <li>Receive ongoing support from our team</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #6B7280; font-size: 14px; margin: 0 0 10px 0;">
              Need help? Contact us at
              <a href="mailto:support@Bonix.com" style="color: #4F46E5; text-decoration: none;">support@Bonix.com</a>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
              © 2026 Bonix. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ Subscription warning (${type}) email sent to ${to}`);
    } catch (error) {
      console.error(
        `❌ Failed to send subscription warning (${type}) email:`,
        error,
      );
      // Don't throw - email should be fire-and-forget
    }
  }

  /**
   * Send Subscription Reassurance Email (7-day or 1-day)
   * Informs clinic that renewal is already scheduled and no action is needed
   */
  async sendSubscriptionReassurance(
    to: string,
    type: '7_DAYS' | '1_DAY',
    context: ReassuranceEmailContext,
  ): Promise<void> {
    const transporter = this.mailTransport();
    const daysText = type === '1_DAY' ? 'Tomorrow' : 'in 7 Days';
    const activationText =
      type === '1_DAY' ? 'tomorrow at midnight' : `on ${context.renewalDate}`;

    const mailOptions = {
      from: {
        name: 'Bonix',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to,
      subject: `✅ Your Bonix Subscription Renews ${daysText}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img 
              alt="Bonix Logo" 
              style="width: 150px; height: auto;"
              src="https://res.cloudinary.com/dx1ejni0o/image/upload/v1758100904/crypto/ikz8lyq7dmaesm8atpxh.png"
            />
          </div>
          
          <div style="background: #F0FDF4; border-radius: 10px; padding: 30px; border-left: 4px solid #10B981;">
            <h1 style="color: #10B981; margin: 0 0 20px 0; font-size: 24px;">
              ✅ Your Renewal is Scheduled
            </h1>
            <p style="color: #111827; font-size: 16px; margin: 0 0 15px 0;">
              Hi <strong>${context.clinicName}</strong>,
            </p>
            <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">
              Good news! Your Bonix subscription renewal is already scheduled. No action needed from your side.
            </p>
            
            <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #D1FAE5;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <span style="color: #6B7280; font-size: 14px;">Current Plan:</span>
                <strong style="color: #111827; font-size: 16px;">${context.currentPlan}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <span style="color: #6B7280; font-size: 14px;">Next Plan:</span>
                <strong style="color: #10B981; font-size: 16px;">${context.nextPlan}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #6B7280; font-size: 14px;">Activates:</span>
                <strong style="color: #059669; font-size: 16px;">${activationText}</strong>
              </div>
            </div>
            
            <div style="background: #D1FAE5; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0;">
              <p style="color: #065F46; font-size: 14px; margin: 0;">
                🎉 <strong>Automatic Renewal:</strong> Your subscription will seamlessly continue with zero downtime.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173'}/subscription"
                 style="background: #10B981; color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px;">
                View Subscription Details
              </a>
            </div>
          </div>
          
          <div style="background: #F9FAFB; border-radius: 8px; padding: 20px; margin-top: 20px;">
            <h3 style="color: #111827; margin: 0 0 10px 0; font-size: 16px;">What Happens Next?</h3>
            <ul style="color: #6B7280; font-size: 14px; margin: 10px 0; padding-left: 20px;">
              <li>Your new subscription will activate automatically</li>
              <li>You'll continue to have uninterrupted access</li>
              <li>All your data and settings will remain intact</li>
              <li>We'll send you a confirmation once the renewal is complete</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #6B7280; font-size: 14px; margin: 0 0 10px 0;">
              Questions? Contact us at
              <a href="mailto:support@Bonix.com" style="color: #4F46E5; text-decoration: none;">support@Bonix.com</a>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
              © 2026 Bonix. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ Subscription reassurance (${type}) email sent to ${to}`);
    } catch (error) {
      console.error(
        `❌ Failed to send subscription reassurance (${type}) email:`,
        error,
      );
      // Don't throw - email should be fire-and-forget
    }
  }

  /**
   * Send Subscription Expired Email
   * Notifies clinic that their subscription has ended
   */
  async sendSubscriptionExpired(
    to: string,
    context: ExpiredEmailContext,
  ): Promise<void> {
    const transporter = this.mailTransport();

    const mailOptions = {
      from: {
        name: 'Bonix',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to,
      subject: '❌ Your Bonix Subscription Has Expired',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img 
              alt="Bonix Logo" 
              style="width: 150px; height: auto;"
              src="https://res.cloudinary.com/dx1ejni0o/image/upload/v1758100904/crypto/ikz8lyq7dmaesm8atpxh.png"
            />
          </div>
          
          <div style="background: #FEF2F2; border-radius: 10px; padding: 30px; border-left: 4px solid #DC2626;">
            <h1 style="color: #DC2626; margin: 0 0 20px 0; font-size: 24px;">
              ⚠️ Subscription Expired
            </h1>
            <p style="color: #111827; font-size: 16px; margin: 0 0 15px 0;">
              Hi <strong>${context.clinicName}</strong>,
            </p>
            <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">
              Your Bonix subscription (<strong>${context.planName}</strong>) has expired as of <strong>${context.expirationDate}</strong>.
            </p>
            
            <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 2px solid #FEE2E2;">
              <h3 style="color: #DC2626; margin: 0 0 15px 0; font-size: 16px;">Services No Longer Available:</h3>
              <ul style="color: #6B7280; font-size: 14px; margin: 0; padding-left: 20px;">
                <li>Patient appointment management</li>
                <li>Medical record access</li>
                <li>Clinic dashboard features</li>
                <li>Staff and doctor management</li>
                <li>Reporting and analytics</li>
              </ul>
            </div>
            
            <div style="background: #FEE2E2; border: 2px solid #DC2626; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="color: #991B1B; font-size: 14px; margin: 0; font-weight: 600;">
                🔒 Your account is now in limited access mode. Renew to restore full functionality.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${context.renewalLink}"
                 style="background: #DC2626; color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px;">
                Renew Subscription Now
              </a>
            </div>
          </div>
          
          <div style="background: #F9FAFB; border-radius: 8px; padding: 20px; margin-top: 20px;">
            <h3 style="color: #111827; margin: 0 0 10px 0; font-size: 16px;">Renew Today to:</h3>
            <ul style="color: #6B7280; font-size: 14px; margin: 10px 0; padding-left: 20px;">
              <li>Restore full access to all Bonix features</li>
              <li>Resume managing patient appointments</li>
              <li>Access your clinic data and reports</li>
              <li>Continue providing quality healthcare services</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #6B7280; font-size: 14px; margin: 0 0 10px 0;">
              Need assistance? Contact us at
              <a href="mailto:support@Bonix.com" style="color: #4F46E5; text-decoration: none;">support@Bonix.com</a>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
              © 2026 Bonix. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ Subscription expired email sent to ${to}`);
    } catch (error) {
      console.error('❌ Failed to send subscription expired email:', error);
      // Don't throw - email should be fire-and-forget
    }
  }

  /**
   * Send Renewal Success Email
   * Confirms successful automatic renewal of the same subscription plan
   */
  async sendRenewalSuccess(
    to: string,
    context: RenewalSuccessContext,
  ): Promise<void> {
    const transporter = this.mailTransport();

    const mailOptions = {
      from: {
        name: 'Bonix',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to,
      subject: '✅ Your Bonix Subscription Has Been Renewed',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img 
              alt="Bonix Logo" 
              style="width: 150px; height: auto;"
              src="https://res.cloudinary.com/dx1ejni0o/image/upload/v1758100904/crypto/ikz8lyq7dmaesm8atpxh.png"
            />
          </div>
          
          <div style="background: #F0FDF4; border-radius: 10px; padding: 30px; border-left: 4px solid #10B981;">
            <h1 style="color: #10B981; margin: 0 0 20px 0; font-size: 24px;">
              🎉 Subscription Renewed Successfully!
            </h1>
            <p style="color: #111827; font-size: 16px; margin: 0 0 15px 0;">
              Hi <strong>${context.clinicName}</strong>,
            </p>
            <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">
              Great news! Your Bonix subscription has been successfully renewed. Your services continue uninterrupted.
            </p>
            
            <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #D1FAE5;">
              <h3 style="color: #111827; margin: 0 0 15px 0; font-size: 16px;">Renewal Details</h3>
              <div style="border-bottom: 1px solid #E5E7EB; padding-bottom: 10px; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span style="color: #6B7280; font-size: 14px;">Subscription Plan:</span>
                  <strong style="color: #111827; font-size: 15px;">${context.planName}</strong>
                </div>
              </div>
              <div style="border-bottom: 1px solid #E5E7EB; padding-bottom: 10px; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span style="color: #6B7280; font-size: 14px;">Start Date:</span>
                  <strong style="color: #111827; font-size: 15px;">${context.startDate}</strong>
                </div>
              </div>
              <div style="border-bottom: 1px solid #E5E7EB; padding-bottom: 10px; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span style="color: #6B7280; font-size: 14px;">Expiration Date:</span>
                  <strong style="color: #10B981; font-size: 15px;">${context.endDate}</strong>
                </div>
              </div>
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #6B7280; font-size: 14px;">Transaction ID:</span>
                  <code style="background: #F3F4F6; padding: 4px 8px; border-radius: 4px; font-size: 13px; color: #111827;">${context.transactionId}</code>
                </div>
              </div>
            </div>
            
            <div style="background: #D1FAE5; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0;">
              <p style="color: #065F46; font-size: 14px; margin: 0;">
                ✅ <strong>All Services Active:</strong> You have full access to all Bonix features until ${context.endDate}.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${context.invoiceLink}"
                 style="background: #10B981; color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px; margin-right: 10px;">
                View Invoice
              </a>
              <a href="${this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173'}/subscription"
                 style="background: #6B7280; color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px;">
                Manage Subscription
              </a>
            </div>
          </div>
          
          <div style="background: #F9FAFB; border-radius: 8px; padding: 20px; margin-top: 20px;">
            <h3 style="color: #111827; margin: 0 0 10px 0; font-size: 16px;">Thank You for Choosing Bonix</h3>
            <p style="color: #6B7280; font-size: 14px; margin: 10px 0;">
              We're committed to providing you with the best healthcare management platform. Your continued trust means everything to us!
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #6B7280; font-size: 14px; margin: 0 0 10px 0;">
              Questions? Reach out at
              <a href="mailto:support@Bonix.com" style="color: #4F46E5; text-decoration: none;">support@Bonix.com</a>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
              © 2026 Bonix. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ Renewal success email sent to ${to}`);
    } catch (error) {
      console.error('❌ Failed to send renewal success email:', error);
      // Don't throw - email should be fire-and-forget
    }
  }

  /**
   * Send Plan Change Success Email
   * Confirms successful subscription plan change (upgrade or downgrade)
   */
  async sendPlanChangeSuccess(
    to: string,
    context: PlanChangeContext,
  ): Promise<void> {
    const transporter = this.mailTransport();
    const isUpgrade =
      context.newPlan.toLowerCase().includes('premium') ||
      context.newPlan.toLowerCase().includes('pro');
    const changeType = isUpgrade ? 'Upgrade' : 'Change';
    const icon = isUpgrade ? '⬆️' : '🔄';

    const mailOptions = {
      from: {
        name: 'Bonix',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to,
      subject: `${icon} Your Bonix Subscription Plan Has Changed`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img 
              alt="Bonix Logo" 
              style="width: 150px; height: auto;"
              src="https://res.cloudinary.com/dx1ejni0o/image/upload/v1758100904/crypto/ikz8lyq7dmaesm8atpxh.png"
            />
          </div>
          
          <div style="background: ${isUpgrade ? '#F0F9FF' : '#F0FDF4'}; border-radius: 10px; padding: 30px; border-left: 4px solid ${isUpgrade ? '#0284C7' : '#10B981'};">
            <h1 style="color: ${isUpgrade ? '#0284C7' : '#10B981'}; margin: 0 0 20px 0; font-size: 24px;">
              ${icon} Subscription Plan ${changeType} Successful!
            </h1>
            <p style="color: #111827; font-size: 16px; margin: 0 0 15px 0;">
              Hi <strong>${context.clinicName}</strong>,
            </p>
            <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">
              Your subscription plan has been successfully updated. ${isUpgrade ? 'Enjoy your enhanced features!' : 'Your new plan is now active.'}
            </p>
            
            <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid ${isUpgrade ? '#BAE6FD' : '#D1FAE5'};">
              <h3 style="color: #111827; margin: 0 0 15px 0; font-size: 16px;">Plan Change Details</h3>
              
              <div style="background: #FEF2F2; border-radius: 6px; padding: 15px; margin-bottom: 15px;">
                <div style="text-align: center;">
                  <span style="color: #6B7280; font-size: 12px; text-transform: uppercase; font-weight: 600;">Previous Plan</span>
                  <div style="color: #DC2626; font-size: 18px; font-weight: bold; margin-top: 5px;">${context.oldPlan}</div>
                </div>
              </div>
              
              <div style="text-align: center; margin: 10px 0;">
                <span style="font-size: 24px;">${isUpgrade ? '⬆️' : '➡️'}</span>
              </div>
              
              <div style="background: ${isUpgrade ? '#DBEAFE' : '#D1FAE5'}; border-radius: 6px; padding: 15px; margin-bottom: 15px;">
                <div style="text-align: center;">
                  <span style="color: #065F46; font-size: 12px; text-transform: uppercase; font-weight: 600;">New Plan</span>
                  <div style="color: ${isUpgrade ? '#0284C7' : '#10B981'}; font-size: 18px; font-weight: bold; margin-top: 5px;">${context.newPlan}</div>
                </div>
              </div>
              
              <div style="border-top: 1px solid #E5E7EB; padding-top: 15px; margin-top: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                  <span style="color: #6B7280; font-size: 14px;">Start Date:</span>
                  <strong style="color: #111827; font-size: 15px;">${context.startDate}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #6B7280; font-size: 14px;">Next Renewal:</span>
                  <strong style="color: ${isUpgrade ? '#0284C7' : '#10B981'}; font-size: 15px;">${context.endDate}</strong>
                </div>
              </div>
            </div>
            
            ${
              isUpgrade
                ? `
              <div style="background: #DBEAFE; border-left: 4px solid #0284C7; padding: 15px; margin: 20px 0;">
                <p style="color: #075985; font-size: 14px; margin: 0;">
                  🎉 <strong>Congratulations!</strong> You now have access to premium features and enhanced capabilities.
                </p>
              </div>
            `
                : `
              <div style="background: #D1FAE5; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0;">
                <p style="color: #065F46; font-size: 14px; margin: 0;">
                  ✅ <strong>Plan Updated:</strong> Your new subscription plan is now active.
                </p>
              </div>
            `
            }
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173'}/subscription"
                 style="background: ${isUpgrade ? '#0284C7' : '#10B981'}; color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px;">
                ${isUpgrade ? 'Explore New Features' : 'View Subscription'}
              </a>
            </div>
          </div>
          
          ${
            isUpgrade
              ? `
            <div style="background: #F9FAFB; border-radius: 8px; padding: 20px; margin-top: 20px;">
              <h3 style="color: #111827; margin: 0 0 10px 0; font-size: 16px;">What's New in Your Plan?</h3>
              <ul style="color: #6B7280; font-size: 14px; margin: 10px 0; padding-left: 20px;">
                <li>Access to advanced analytics and reporting</li>
                <li>Priority customer support</li>
                <li>Enhanced data storage capacity</li>
                <li>Additional customization options</li>
              </ul>
            </div>
          `
              : ''
          }
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #6B7280; font-size: 14px; margin: 0 0 10px 0;">
              Questions about your new plan? Contact us at
              <a href="mailto:support@Bonix.com" style="color: #4F46E5; text-decoration: none;">support@Bonix.com</a>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
              © 2026 Bonix. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ Plan change success email sent to ${to}`);
    } catch (error) {
      console.error('❌ Failed to send plan change success email:', error);
      // Don't throw - email should be fire-and-forget
    }
  }

  /**
   * Send Stale Registration Deleted Email
   *
   * Notifies a clinic admin that their incomplete registration data
   * has been removed after 6 months of inactivity.
   */
  async sendStaleRegistrationDeletedEmail(
    email: string,
    clinicName: string,
    status: string,
  ): Promise<void> {
    const transporter = this.mailTransport();
    const mailOptions = {
      from: {
        name: 'Bonix',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: '🗑️ Incomplete Registration Data Removed - Bonix',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img 
              alt="Bonix Logo" 
              style="width: 150px; height: auto;"
              src="https://res.cloudinary.com/dx1ejni0o/image/upload/v1758100904/crypto/ikz8lyq7dmaesm8atpxh.png"
            />
          </div>
          
          <div style="background: #FEF3C7; border-radius: 10px; padding: 30px; text-align: center; border: 1px solid #FCD34D;">
            <h1 style="color: #92400E; margin: 0 0 20px 0;">🗑️ Registration Data Removed</h1>
            <p style="color: #4B5563; font-size: 16px; margin: 0 0 20px 0;">
              Hi${clinicName ? ' ' + clinicName : ''},
            </p>
            <p style="color: #4B5563; font-size: 16px; margin: 0 0 20px 0;">
              Your subscription registration has been in <strong>${status}</strong> status for over 6 months without any updates. As part of our data maintenance, the previously saved registration information has been removed.
            </p>
            
            <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: left;">
              <p style="margin: 0; color: #6B7280; font-size: 14px; font-weight: 600;">What does this mean?</p>
              <ul style="color: #111827; font-size: 14px; margin: 10px 0; padding-left: 20px;">
                <li>All previously saved registration data has been deleted</li>
                <li>This includes clinic information, legal documents, and manager details</li>
                <li>If you wish to subscribe, you will need to register again from scratch</li>
              </ul>
            </div>

            <p style="color: #6B7280; font-size: 14px; margin: 20px 0 0 0;">
              If you'd like to re-register, please visit our platform and start a new subscription.
            </p>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173'}" 
                 style="background: #92400E; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
                Re-Register Now
              </a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
              © 2026 Bonix. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error(
        '❌ Failed to send stale registration deleted email:',
        error,
      );
      throw error; // Re-throw so caller can track failure
    }
  }

  /**
   * Send Report Response Email
   *
   * Notifies a user that their report has been reviewed and responded to.
   */
  async sendReportResponseEmail(
    email: string,
    name: string,
    responseDescription: string,
  ): Promise<void> {
    const transporter = this.mailTransport();
    const mailOptions = {
      from: {
        name: 'Bonix Support',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: 'Update on Your Report - Bonix',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img 
              alt="Bonix Logo" 
              style="width: 150px; height: auto;"
              src="https://res.cloudinary.com/dx1ejni0o/image/upload/v1758100904/crypto/ikz8lyq7dmaesm8atpxh.png"
            />
          </div>
          
          <div style="background: #F8FAFC; border-radius: 10px; padding: 30px; border: 1px solid #E2E8F0;">
            <h1 style="color: #0F172A; margin: 0 0 20px 0;">Report Update</h1>
            <p style="color: #4B5563; font-size: 16px; margin: 0 0 20px 0;">
              Hi ${name},
            </p>
            <p style="color: #4B5563; font-size: 16px; margin: 0 0 20px 0;">
              Thank you for taking the time to submit a report. Our team has reviewed it and provided the following response:
            </p>
            
            <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #E5E7EB;">
              <p style="margin: 0; color: #111827; line-height: 1.5;">${responseDescription.replace(/\\n/g, '<br>')}</p>
            </div>
            
            <p style="color: #6B7280; font-size: 14px; margin: 20px 0 0 0;">
              If you have any further questions or concerns, please feel free to reply to this email or contact our support team.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
              © 2026 Bonix. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ Report response email sent to ${email}`);
    } catch (error) {
      console.error('❌ Failed to send report response email:', error);
      throw error;
    }
  }

  /**
   * Send Welcome Email with Password (for Walk-in Patients)
   * 
   * Sends welcome email to patients created by clinic staff containing:
   * - Login credentials (username/email + temporary password)
   * - Instructions to change password on first login
   * - Reminder to update profile information
   * 
   * @param email - Patient email address
   * @param fullName - Patient full name
   * @param username - Username (usually email)
   * @param temporaryPassword - Auto-generated password
   */
  async sendWelcomeEmailWithPassword(
    email: string,
    fullName: string,
    username: string,
    temporaryPassword: string,
  ): Promise<void> {
    const transporter = this.mailTransport();
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';

    const mailOptions = {
      from: {
        name: 'Bonix',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: 'Chào mừng bạn đến với Bonix - Thông tin đăng nhập',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img 
              alt="Bonix Logo" 
              style="width: 150px; height: auto;"
              src="https://res.cloudinary.com/dx1ejni0o/image/upload/v1758100904/crypto/ikz8lyq7dmaesm8atpxh.png"
            />
          </div>
          
          <div style="background: #F0F9FF; border-radius: 10px; padding: 30px; border: 1px solid #BAE6FD;">
            <h1 style="color: #0369A1; margin: 0 0 20px 0;">Chào mừng bạn đến với Bonix!</h1>
            <p style="color: #4B5563; font-size: 16px; margin: 0 0 20px 0;">
              Kính chào <strong>${fullName}</strong>,
            </p>
            <p style="color: #4B5563; font-size: 16px; margin: 0 0 20px 0;">
              Cảm ơn bạn đã chọn Bonix để chăm sóc sức khỏe. Tài khoản của bạn đã được tạo thành công!
            </p>
            
            <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #E5E7EB;">
              <h2 style="color: #111827; margin: 0 0 15px 0; font-size: 18px;">Thông tin đăng nhập:</h2>
              <div style="margin-bottom: 10px;">
                <span style="color: #6B7280; font-size: 14px;">Email/Tài khoản:</span>
                <p style="margin: 5px 0 0 0; color: #111827; font-weight: 600; font-size: 16px;">${username}</p>
              </div>
              <div>
                <span style="color: #6B7280; font-size: 14px;">Mật khẩu tạm thời:</span>
                <p style="margin: 5px 0 0 0; color: #0369A1; font-weight: 600; font-size: 18px; letter-spacing: 1px;">${temporaryPassword}</p>
              </div>
            </div>

            <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #92400E; font-size: 14px; font-weight: 600;">⚠️ LƯU Ý QUAN TRỌNG:</p>
              <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #92400E; font-size: 14px;">
                <li>Vui lòng đổi mật khẩu ngay sau khi đăng nhập lần đầu</li>
                <li>Không chia sẻ mật khẩu cho bất kỳ ai</li>
                <li>Bạn có thể cập nhật thông tin cá nhân (ngày sinh, giới tính, địa chỉ...) trong phần "Hồ sơ của tôi"</li>
              </ul>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${frontendUrl}/login" 
                 style="background: #0369A1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
                Đăng nhập ngay
              </a>
            </div>

            <p style="color: #6B7280; font-size: 14px; margin: 30px 0 0 0; text-align: center;">
              Nếu có bất kỳ thắc mắc nào, vui lòng liên hệ với chúng tôi qua email hoặc hotline được cung cấp tại phòng khám.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
              © 2026 Bonix. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ Welcome email with password sent to ${email}`);
    } catch (error) {
      console.error('❌ Failed to send welcome email with password:', error);
      throw error;
    }
  }

  /**
   * Send Appointment Reminder Email
   */
  async sendAppointmentReminderEmail(
    email: string,
    context: AppointmentReminderContext,
  ): Promise<void> {
    const transporter = this.mailTransport();

    const servicesListHtml = context.services
      .map(
        (service) =>
          `<li style="margin: 8px 0; color: #374151; line-height: 1.5;">${service.serviceName}</li>`,
      )
      .join('');

    const mailOptions = {
      from: {
        name: 'Bonix',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: `[${context.clinicName}] - Nhắc nhở lịch hẹn ngày ${context.appointmentDate}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); text-align: center; padding: 30px 20px;">
              <img 
                src="https://res.cloudinary.com/dx1ejni0o/image/upload/v1758100904/crypto/ikz8lyq7dmaesm8atpxh.png" 
                alt="${context.clinicName}" 
                style="max-width: 180px; height: auto; margin-bottom: 15px;"
              />
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">NHẮC NHỞ LỊCH HẸN</h1>
            </div>

            <!-- Content -->
            <div style="padding: 30px 25px;">
              <p style="margin: 0 0 20px 0; font-size: 15px;">Kính gửi <strong>${context.patientName}</strong>,</p>
              
              <p style="margin: 0 0 20px 0; font-size: 15px;">Đây là email nhắc nhở về lịch hẹn của bạn tại <strong>${context.clinicName}</strong>:</p>
              
              <!-- Appointment Details -->
              <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0;">
                <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 16px; font-weight: 600;">THÔNG TIN LỊCH HẸN</h3>
                <p style="margin: 10px 0; color: #475569; font-size: 14px;"><strong>Ngày giờ:</strong> ${context.appointmentHour}, ${context.appointmentDate}</p>
                <p style="margin: 10px 0; color: #475569; font-size: 14px;"><strong>Bác sĩ:</strong> ${context.doctorName}${context.doctorSpecialization ? ` - ${context.doctorSpecialization}` : ''}</p>
                <p style="margin: 10px 0 5px 0; color: #475569; font-size: 14px;"><strong>Dịch vụ:</strong></p>
                <ul style="margin: 0; padding-left: 25px;">
                  ${servicesListHtml}
                </ul>
              </div>

              <!-- Clinic Info -->
              <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 25px 0;">
                <h3 style="margin: 0 0 15px 0; color: #92400e; font-size: 16px; font-weight: 600;">ĐỊA CHỈ PHÒNG KHÁM</h3>
                <p style="margin: 10px 0; color: #78350f; font-size: 14px;"><strong>Địa chỉ:</strong> ${context.clinicAddress}</p>
                <p style="margin: 10px 0; color: #78350f; font-size: 14px;"><strong>Hotline:</strong> ${context.clinicPhone}</p>
              </div>

              <!-- Preparation Guide -->
              <div style="margin: 25px 0;">
                <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 16px; font-weight: 600;">HƯỚNG DẪN CHUẨN BỊ</h3>
                <ul style="margin: 0; padding-left: 25px; color: #475569; font-size: 14px;">
                  <li style="margin: 8px 0; line-height: 1.6;">Vui lòng có mặt trước 15 phút để làm thủ tục</li>
                  <li style="margin: 8px 0; line-height: 1.6;">Mang theo giấy tờ tùy thân (CMND/CCCD)</li>
                  <li style="margin: 8px 0; line-height: 1.6;">Mang theo kết quả xét nghiệm cũ (nếu có)</li>
                </ul>
              </div>

              <p style="margin: 25px 0 0 0; font-size: 14px; color: #64748b;">Nếu bạn cần thay đổi hoặc hủy lịch hẹn, vui lòng liên hệ với chúng tôi sớm nhất có thể.</p>
            </div>

            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 25px; text-align: center; font-size: 13px; color: #64748b;">
              <p style="margin: 0 0 8px 0; font-weight: 600; color: #475569;">${context.clinicName}</p>
              <p style="margin: 0 0 5px 0;">Hotline: ${context.clinicPhone}</p>
              <p style="margin: 0 0 15px 0;">${context.clinicAddress}</p>
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">© 2026 Bonix. All rights reserved.</p>
            </div>

          </div>
        </body>
        </html>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ Appointment reminder email sent to ${email}`);
    } catch (error) {
      console.error('❌ Failed to send appointment reminder email:', error);
      throw error;
    }
  }

  /**
   * Send New Account Notification with full details
   */
  async sendAccountNotification(data: {
    email: string;
    fullName: string;
    username: string;
    password: string;
    phone?: string;
    dob?: string;
  }): Promise<void> {
    const transporter = this.mailTransport();
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';

    const mailOptions = {
      from: {
        name: 'Bonix',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: data.email,
      subject: '✨ Thông báo tạo tài khoản thành công - Bonix',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img 
              alt="Bonix Logo" 
              style="width: 150px; height: auto;"
              src="https://res.cloudinary.com/dx1ejni0o/image/upload/v1758100904/crypto/ikz8lyq7dmaesm8atpxh.png"
            />
          </div>
          
          <div style="background: #F0F9FF; border-radius: 10px; padding: 30px; border: 1px solid #BAE6FD;">
            <h1 style="color: #0369A1; margin: 0 0 20px 0;">Tài khoản Bonix của bạn đã sẵn sàng!</h1>
            <p style="color: #4B5563; font-size: 16px; margin: 0 0 20px 0;">
              Chào mừng <strong>${data.fullName}</strong> đến với Bonix.
            </p>
            
            <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #E5E7EB;">
              <h2 style="color: #111827; margin: 0 0 15px 0; font-size: 18px;">Thông tin chi tiết:</h2>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                <div>
                  <span style="color: #6B7280; font-size: 12px; display: block;">Họ và tên:</span>
                  <span style="color: #111827; font-weight: 600;">${data.fullName}</span>
                </div>
                ${data.phone ? `
                <div>
                  <span style="color: #6B7280; font-size: 12px; display: block;">Số điện thoại:</span>
                  <span style="color: #111827; font-weight: 600;">${data.phone}</span>
                </div>
                ` : ''}
              </div>

              ${data.dob ? `
              <div style="margin-bottom: 15px;">
                <span style="color: #6B7280; font-size: 12px; display: block;">Ngày sinh:</span>
                <span style="color: #111827; font-weight: 600;">${data.dob}</span>
              </div>
              ` : ''}

              <div style="border-top: 1px dashed #E5E7EB; padding-top: 15px; margin-top: 15px;">
                <div style="margin-bottom: 10px;">
                  <span style="color: #6B7280; font-size: 12px;">Tên đăng nhập:</span>
                  <p style="margin: 2px 0 0 0; color: #111827; font-weight: 600; font-size: 16px;">${data.username}</p>
                </div>
                <div>
                  <span style="color: #6B7280; font-size: 12px;">Mật khẩu tạm thời:</span>
                  <p style="margin: 2px 0 0 0; color: #0369A1; font-weight: 600; font-size: 18px; letter-spacing: 1px;">${data.password}</p>
                </div>
              </div>
            </div>

            <div style="background: #FDF2F2; border-left: 4px solid #EF4444; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #991B1B; font-size: 14px; font-weight: 600;">⚠️ Bảo mật:</p>
              <p style="margin: 5px 0 0 0; color: #991B1B; font-size: 13px;">
                Đây là mật khẩu tạm thời. Để bảo mật, vui lòng thay đổi mật khẩu ngay sau lần đăng nhập đầu tiên.
              </p>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${frontendUrl}" 
                 style="background: #0369A1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                Bắt đầu ngay
              </a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
              © 2025 Bonix. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ Account notification email sent to ${data.email}`);
    } catch (error) {
      console.error('❌ Failed to send account notification email:', error);
      throw new Error('Failed to send account notification email');
    }
  }
}
