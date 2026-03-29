import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
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

type TemplateContext = Record<string, unknown>;

type HandlebarsCompiler = {
  compile: (source: string) => (context: TemplateContext) => string;
};

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private handlebarsCompiler: HandlebarsCompiler | null = null;

  constructor(private readonly configService: ConfigService) {}

  private resolveTemplatePath(templateRelativePath: string): string {
    const candidates = [
      path.join(
        process.cwd(),
        'src',
        'modules',
        'mailer',
        'templates',
        templateRelativePath,
      ),
      path.join(
        process.cwd(),
        'dist',
        'src',
        'modules',
        'mailer',
        'templates',
        templateRelativePath,
      ),
      path.join(__dirname, 'templates', templateRelativePath),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    throw new Error(`Email template not found: ${templateRelativePath}`);
  }

  private loadHandlebars(): HandlebarsCompiler {
    if (this.handlebarsCompiler) {
      return this.handlebarsCompiler;
    }

    const directPath = path.join(process.cwd(), 'node_modules', 'handlebars');
    if (fs.existsSync(directPath)) {
      this.handlebarsCompiler = require(directPath) as HandlebarsCompiler;
      return this.handlebarsCompiler;
    }

    const pnpmStoreDir = path.join(process.cwd(), 'node_modules', '.pnpm');
    if (fs.existsSync(pnpmStoreDir)) {
      for (const entry of fs.readdirSync(pnpmStoreDir)) {
        const candidatePath = path.join(
          pnpmStoreDir,
          entry,
          'node_modules',
          'handlebars',
        );
        if (fs.existsSync(candidatePath)) {
          this.handlebarsCompiler = require(candidatePath) as HandlebarsCompiler;
          return this.handlebarsCompiler;
        }
      }
    }

    throw new Error('Cannot resolve handlebars for email rendering.');
  }

  private renderTemplate(
    templateRelativePath: string,
    context: TemplateContext,
  ): string {
    const templatePath = this.resolveTemplatePath(templateRelativePath);
    const source = fs.readFileSync(templatePath, 'utf8');
    return this.loadHandlebars().compile(source)(context);
  }

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
      html: this.renderTemplate('moderation/account-warning.hbs', { name, reason, strikes })
    };

    try {
      await transporter.sendMail(mailOptions);
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
      subject: '🚫 Account Suspended - Medicare',
      html: this.renderTemplate('moderation/account-banned.hbs', { name, reason })
    };

    try {
      await transporter.sendMail(mailOptions);
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
      html: this.renderTemplate('moderation/account-unbanned.hbs', { name, loginUrl: this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173' })
    };

    try {
      await transporter.sendMail(mailOptions);
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
        name: 'Medicare',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: '⚠️ Clinic Account Warning - Medicare',
      html: this.renderTemplate('moderation/clinic-warning.hbs', { name, reason, strikes })
    };

    try {
      await transporter.sendMail(mailOptions);
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
        name: 'Medicare',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: '🚫 Clinic Account Suspended - Medicare',
      html: this.renderTemplate('moderation/clinic-banned.hbs', { name, reason })
    };

    try {
      await transporter.sendMail(mailOptions);
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
        name: 'Medicare',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: '✅ Clinic Account Restored - Medicare',
      html: this.renderTemplate('moderation/clinic-unbanned.hbs', { name, loginUrl: this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173' })
    };

    try {
      await transporter.sendMail(mailOptions);
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
        name: 'Medicare',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: 'Verify Your Email - Medicare',
      html: this.renderTemplate('auth/verification-code.hbs', { displayName, code })
    };

    try {
      await transporter.sendMail(mailOptions);
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
      html: this.renderTemplate('auth/password-reset-code.hbs', { displayName, code })
    };

    try {
      await transporter.sendMail(mailOptions);
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
      html: this.renderTemplate('auth/contract-signing-code.hbs', { displayName, contractCode, code })
    };

    try {
      await transporter.sendMail(mailOptions);
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
      subject: 'Welcome to Medicare',
      html: this.renderTemplate('auth/welcome.hbs', { fullName, frontendUrl: this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173' })
    };

    try {
      await transporter.sendMail(mailOptions);
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
      subject: 'New Contact Inquiry - Medicare',
      text: 'Bonix Text',
      html: this.renderTemplate('legacy/send-mail.hbs', {}),
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

    const html = this.renderTemplate('auth/verification-email.hbs', { code })

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

    const html = this.renderTemplate('auth/reset-password-email.hbs', { email, code })

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
        name: 'Medicare',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: 'Welcome to Medicare - Clinic Registration Initiated',
      html: this.renderTemplate('onboarding/clinic-admin-welcome.hbs', { displayName })
    };

    try {
      await transporter.sendMail(mailOptions);
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
        name: 'Medicare',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: `Action Required: Employee Signed Contract #${contractCode}`,
      html: this.renderTemplate('contracts/signed-manager.hbs', { employeeName, contractCode, actionUrl: `${this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000'}/?tab=contract&id=${contractId}` })
    };

    try {
      await transporter.sendMail(mailOptions);
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
  ): Promise<void> {
    const transporter = this.mailTransport();
    const contractCode = contractId.substring(0, 8).toUpperCase();

    const mailOptions = {
      from: {
        name: 'Medicare',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: `Contract #${contractCode} is Now Active`,
      html: this.renderTemplate('contracts/completed-employee.hbs', { contractCode, managerName })
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('❌ Failed to send employee notification:', error);
    }
  }


    async sendContractRejectNotification(
        email: string,
        signerName: string,
        contractId: string,
        reason: string
    ) {
        const transporter = this.mailTransport();
        const contractCode = contractId.substring(0, 8).toUpperCase();
        const subject = `[Medicare] Contract #${contractCode} Has Been Rejected`;
        
        const mailOptions = {
            from: {
                name: 'Medicare',
                address: this.configService.get<string>('EMAIL_USER'),
            },
            to: email,
            subject,
            html: this.renderTemplate('contracts/rejected.hbs', { contractCode, signerName, reason })
        };

        try {
            await transporter.sendMail(mailOptions);
        } catch (error) {
            console.error('❌ Failed to send contract rejection email:', error);
        }
    }

    /**
     * Send Contract Cancelled Notification
     * Notifies parties that the contract has been cancelled (e.g., due to tampering)
     */
    async sendContractCancelledNotification(
        email: string,
        contractId: string,
        reason: string
    ) {
        const transporter = this.mailTransport();
        const contractCode = contractId.substring(0, 8).toUpperCase();
        const subject = `[Medicare] ⚠️ ALERT: Contract #${contractCode} has been CANCELLED`;
        
        const mailOptions = {
            from: {
                name: 'Bonix Security',
                address: this.configService.get<string>('EMAIL_USER'),
            },
            to: email,
            subject,
            html: this.renderTemplate('contracts/cancelled.hbs', { contractCode, reason })
        };

        try {
            await transporter.sendMail(mailOptions);
            this.logger.log(`✅ Contract cancellation email sent to ${email}`);
        } catch (error) {
            this.logger.error(`❌ Failed to send contract cancellation email to ${email}:`, error);
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
        name: 'Medicare',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: managerEmail,
      subject: 'Your Clinic Manager Account Credentials - Medicare',
      html: this.renderTemplate('onboarding/manager-credentials.hbs', { displayName, username, password, loginUrl: `${this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173'}/login` })
    };

    try {
      await transporter.sendMail(mailOptions);
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
      html: this.renderTemplate('onboarding/registration-approved.hbs', { displayName, paymentUrl: `${this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173'}/payment` })
    };

    try {
      await transporter.sendMail(mailOptions);
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
      html: this.renderTemplate('onboarding/registration-rejected.hbs', { displayName, reason, documentsUrl: `${this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173'}/documents` })
    };

    try {
      await transporter.sendMail(mailOptions);
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
        name: 'Medicare',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to,
      subject: `${urgentFlag}Your Medicare Subscription Expires in ${daysText}`,
      html: this.renderTemplate('subscription/warning.hbs', { titleText: isUrgent ? 'Immediate Attention Required' : 'Subscription Reminder', clinicName: context.clinicName, planName: context.planName, daysText, expirationDate: context.expirationDate, highlightMessage: isUrgent ? 'Your subscription will expire tomorrow. Please renew promptly to avoid any interruption to your services.' : 'Please renew in advance to ensure uninterrupted access to your Medicare services.', renewalLink: context.renewalLink, ctaText: isUrgent ? 'Renew Now' : 'Renew Subscription' })
    };

    try {
      await transporter.sendMail(mailOptions);
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
        name: 'Medicare',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to,
      subject: `✅ Your Medicare Subscription Renews ${daysText}`,
      html: this.renderTemplate('subscription/reassurance.hbs', { clinicName: context.clinicName, currentPlan: context.currentPlan, nextPlan: context.nextPlan, activationText, subscriptionUrl: `${this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173'}/subscription` })
    };

    try {
      await transporter.sendMail(mailOptions);
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
        name: 'Medicare',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to,
      subject: '❌ Your Medicare Subscription Has Expired',
      html: this.renderTemplate('subscription/subscription-expired.hbs', { clinicName: context.clinicName, planName: context.planName, expirationDate: context.expirationDate, renewalLink: context.renewalLink })
    };

    try {
      await transporter.sendMail(mailOptions);
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
        name: 'Medicare',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to,
      subject: '✅ Your Medicare Subscription Has Been Renewed',
      html: this.renderTemplate('subscription/renewal-success.hbs', { clinicName: context.clinicName, planName: context.planName, startDate: context.startDate, endDate: context.endDate, transactionId: context.transactionId, invoiceLink: context.invoiceLink, subscriptionUrl: `${this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173'}/subscription` })
    };

    try {
      await transporter.sendMail(mailOptions);
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
        name: 'Medicare',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to,
      subject: `${icon} Your Medicare Subscription Plan Has Changed`,
      html: this.renderTemplate('subscription/plan-change-success.hbs', { icon, changeType, clinicName: context.clinicName, summaryText: isUpgrade ? 'Your enhanced plan benefits are now available.' : 'Your updated plan is now active.', oldPlan: context.oldPlan, newPlan: context.newPlan, startDate: context.startDate, endDate: context.endDate, highlightMessage: isUpgrade ? 'You now have access to the enhanced capabilities included with your updated plan.' : 'Your updated subscription plan is now active and ready for use.', subscriptionUrl: `${this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173'}/subscription`, buttonText: isUpgrade ? 'Explore New Features' : 'View Subscription', featureNote: isUpgrade ? 'Additional premium capabilities are now available to your clinic.' : 'The benefits of your updated plan are now available to your clinic.' })
    };

    try {
      await transporter.sendMail(mailOptions);
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
        name: 'Medicare',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: '🗑️ Incomplete Registration Data Removed - Medicare',
      html: this.renderTemplate('onboarding/stale-registration-deleted.hbs', { greeting: clinicName ? `Dear ${clinicName},` : 'Dear Valued Clinic,', status, reRegisterUrl: this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173' })
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
        name: 'Medicare Support',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: 'Update on Your Report - Medicare',
      html: this.renderTemplate('support/report-response.hbs', { name, responseHtml: responseDescription.replace(/\n/g, '<br>') })
    };

    try {
      await transporter.sendMail(mailOptions);
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
        name: 'Medicare',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: 'Welcome to Medicare - Access Credentials',
      html: this.renderTemplate('patient/welcome-with-password.hbs', { fullName, username, temporaryPassword, loginUrl: `${frontendUrl}/login` })
    };

    try {
      await transporter.sendMail(mailOptions);
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
    const mailOptions = {
      from: {
        name: 'Medicare',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: email,
      subject: `[${context.clinicName}] Appointment Reminder for ${context.appointmentDate}`,
      html: this.renderTemplate('appointment/appointment-reminder.hbs', { ...context })
    };

    try {
      await transporter.sendMail(mailOptions);
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
        name: 'Medicare',
        address: this.configService.get<string>('EMAIL_USER'),
      },
      to: data.email,
      subject: '✨ Your Medicare Account Is Ready',
      html: this.renderTemplate('patient/account-notification.hbs', { ...data, frontendUrl })
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('❌ Failed to send account notification email:', error);
      throw new Error('Failed to send account notification email');
    }
  }
}
