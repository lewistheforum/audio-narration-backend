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

  // Gửi email verify đăng ký (HTML đẹp)
  async sendVerificationEmail(email: string, code: string) {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
      console.error('SMTP_USER hoặc SMTP_PASS chưa được cấu hình trong .env');
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
    <title>Xác thực email đăng ký tài khoản</title>
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
                  Xác thực email đăng ký tài khoản
                </h1>
                <p style="margin:0 0 6px 0;font-size:14px;line-height:1.6;color:#374151;">
                  Medicare xin chào,
                </p>
                <p style="margin:0;font-size:14px;line-height:1.6;color:#374151;">
                  Cảm ơn bạn đã đăng ký tài khoản trên <strong>Medicare</strong>.<br/>
                  Mã xác thực email của bạn là:
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
                  Mã này có hiệu lực trong <strong>10 phút</strong>. Vui lòng không chia sẻ mã cho bất kỳ ai.
                </p>
                <p style="margin:0 0 12px 0;font-size:13px;line-height:1.6;color:#4b5563;">
                  Nếu bạn không thực hiện đăng ký, vui lòng bỏ qua email này.
                </p>
                <p style="margin:0;font-size:11px;line-height:1.6;color:#9ca3af;">
                  Đây là email tự động, vui lòng không trả lời.
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
      subject: 'Xác thực email đăng ký tài khoản',
      text: `Mã xác thực của bạn là: ${code}. Mã có hiệu lực trong 10 phút.`,
      html,
    };

    await transporter.sendMail(mailOptions);
  }

  // Email reset password (HTML đẹp)
  private async sendResetPasswordEmail(email: string, code: string) {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
      console.error('SMTP_USER hoặc SMTP_PASS chưa được cấu hình trong .env');
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
    <title>Yêu cầu đặt lại mật khẩu</title>
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
                  Yêu cầu đặt lại mật khẩu
                </h1>
                <p style="margin:0 0 6px 0;font-size:14px;line-height:1.6;color:#374151;">
                  Medicare xin chào,
                </p>
                <p style="margin:0;font-size:14px;line-height:1.6;color:#374151;">
                  Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản sử dụng email:
                  <strong>${email}</strong>.<br/>
                  Mã đặt lại mật khẩu của bạn là:
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
                  Mã này có hiệu lực trong <strong>10 phút</strong>. Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.
                </p>
                <p style="margin:0 0 12px 0;font-size:13px;line-height:1.6;color:#4b5563;">
                  Vì lý do bảo mật, tuyệt đối không chia sẻ mã này cho bất kỳ ai.
                </p>
                <p style="margin:0;font-size:11px;line-height:1.6;color:#9ca3af;">
                  Đây là email tự động, vui lòng không trả lời.
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
      subject: 'Yêu cầu đặt lại mật khẩu',
      text: `Mã đặt lại mật khẩu của bạn là: ${code}. Mã có hiệu lực trong 10 phút.`,
      html,
    };

    await transporter.sendMail(mailOptions);
  }
}
