import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import path from 'path';

@Injectable()
export class MailerService {
  constructor(private readonly configService: ConfigService) {}

  mailTransport() {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      port: 587,
      secure: false,
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASSWORD'),
      },
    });
    return transporter;
  }

  mailOptions(targetMail: string) {
    return {
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
        // {
        //   filename: 'test.pdf',
        //   path: path.join(__dirname, 'test.pdf'),
        //   contentType: 'application/pdf',
        // },
        {
          filename: 'logo-medicare.png',
          path: 'https://res.cloudinary.com/dx1ejni0o/image/upload/v1758100904/crypto/ikz8lyq7dmaesm8atpxh.png',
          contentType: 'image/png',
        },
      ],
    };
  }

  async sendMail(targetMail: string) {
    const transporter = this.mailTransport();
    const mailOptions = this.mailOptions(targetMail);
    try {
      return await transporter.sendMail(mailOptions);
    } catch (error) {
      console.log('❌ Failed to send mail: ', error);
      throw new Error('Failed to send mail');
    }
  }
}
