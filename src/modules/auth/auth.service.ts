import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { ClientService } from '../client/client.service';
import { SocketGatewayService } from '../socket-gateway/socket-gateway.service';
import { randomBytes } from 'crypto';
import { ClientResponseDto } from '../client/dto/client-response.dto';
import { MESSAGES } from 'src/common/message';
import { RegisterDto } from './dto/register.dto';
import { EmailVerification } from './entities/email-verification.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  VerifyEmailDto,
  ForgotPasswordDto,
  VerifyResetPasswordDto,
  SetNewPasswordDto,
} from './dto';
import * as nodemailer from 'nodemailer';
import { PasswordReset } from './entities/password-reset.entity';

/**
 * Authentication Service
 * Handles user authentication logic including standard login and OAuth
 */
@Injectable()
export class AuthService {
  constructor(
    private clientService: ClientService,
    private jwtService: JwtService,
    private socketGatewayService: SocketGatewayService,
  ) { }

  /**
   * Standard email/password login
   * - Validates credentials against database
   * - Checks user status (bans, inactive accounts)
   * - Returns JWT token with user ID, email, role, and complete user info
   * - Marks user as online via socket gateway
   */
  async login(loginDto: LoginDto): Promise<{
    data: {
      access_token: string;
      userId: string;
      user: ClientResponseDto;
    };
  }> {
    @InjectRepository(EmailVerification)
    private emailVerificationRepo: Repository<EmailVerification>,
    @InjectRepository(PasswordReset)
    private passwordResetRepo: Repository<PasswordReset>,
  ) {}

  // Login
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const user = await this.clientService.findByEmail(email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException(MESSAGES.failMessage.invalidCredentials);
    const user = await this.userService.findByEmail(email);

    if (user && (await bcrypt.compare(password, user.password))) {
      if (!user.isEmailVerified) {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10);

        const verification = this.emailVerificationRepo.create({
          user: { id: user.id } as any,
          code,
          expiresAt,
          used: false,
        });
        await this.emailVerificationRepo.save(verification);
        await this.sendVerificationEmail(email, code);
        throw new UnauthorizedException(
          'Email not verified. A verification code has been sent to your email.',
        );
      }

      const payload = { sub: user.id, email: user.email };
      // Broadcast user online presence
      this.socketGatewayService.markUserOnline(String(user.id));
      return {
        data: {
          access_token: this.jwtService.sign(payload),
          userId: user.id,
        },
      };
    }

    // Check if user account is banned or inactive
    this.clientService.validateUserAccess(user);

    const payload = { sub: user.id, email: user.email, role: user.role };
    this.socketGatewayService.markUserOnline(String(user.id));

    // Get general account data for response
    const generalAccount = await this.clientService.findGeneralAccountByUserId(user.id);

    return {
      data: {
        access_token: this.jwtService.sign(payload),
        userId: user.id,
        user: new ClientResponseDto(user, generalAccount),
      },
    };
  }

  /**
   * Google OAuth login flow
   * - Only creates PATIENT accounts (business rule)
   * - Email is automatically verified for OAuth users
   * - Stores profile picture
   * - Generates random password for OAuth users
   */
  async googleLogin(googleUser: any): Promise<{
    access_token: string;
    userId: string;
    user: ClientResponseDto;
  }> {
  // Register
  async register(registerDto: RegisterDto) {
    const { username, password, email, gender, dateOfBirth } = registerDto;

    const createUser = await this.userService.create({
      email,
      password,
      name: username,
      isOAuthUser: false,
      isEmailVerified: false,
      profilePicture: undefined,
      gender,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
    } as any);

    // Create 6-code send to user
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Save code
    const verification = this.emailVerificationRepo.create({
      user: { id: createUser.id } as any,
      code,
      expiresAt,
      used: false,
    });
    await this.emailVerificationRepo.save(verification);

    // Send email
    await this.sendVerificationEmail(email, code);

    const payload = { sub: createUser.id, email: createUser.email };
    const accessToken = this.jwtService.sign(payload);

    this.socketGatewayService.markUserOnline(String(createUser.id));

    return {
      access_token: accessToken,
      userId: createUser.id,
      message: 'Mã xác thực đã được gửi tới email. Vui lòng kiểm tra hộp thư.',
    };
  }

  // Verify email
  async verifyEmail(dto: VerifyEmailDto) {
    const { email, code } = dto;

    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('User không tồn tại');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email đã được xác thực trước đó');
    }

    const now = new Date();

    const record = await this.emailVerificationRepo.findOne({
      where: {
        user: { id: user.id },
        code,
        used: false,
      },
      order: { createdAt: 'DESC' },
      relations: ['user'],
    });

    if (!record) {
      throw new BadRequestException('Mã xác thực không chính xác');
    }

    if (record.expiresAt < now) {
      throw new BadRequestException('Mã xác thực đã hết hạn');
    }

    record.used = true;
    await this.emailVerificationRepo.save(record);

    user.isEmailVerified = true;
    await this.userService['userRepository'].save(user as any);

    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    this.socketGatewayService.markUserOnline(String(user.id));

    return {
      access_token: accessToken,
      userId: user.id,
    };
  }

  // Gửi email verify đăng ký (HTML đẹp)
  private async sendVerificationEmail(email: string, code: string) {
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

  // Google Login
  async googleLogin(googleUser: any): Promise<any> {
    if (!googleUser) {
      throw new UnauthorizedException(MESSAGES.failMessage.invalidCredentials);
    }

    const { email, firstName, lastName, picture } = googleUser;
    const { email, firstName, lastName, picture, googleId, isEmailVerified } =
      googleUser;

    if (!email) {
      throw new UnauthorizedException(
        MESSAGES.failMessage.googleAccountNoEmail,
      );
    }

    let user = await this.clientService.findByEmail(email);
    let userId: string;
    let userEmail: string;
    let generalAccount = null;

    if (user) {
      // Update existing user with OAuth data if not already set
      if (!user.isOAuthUser) {
        user.isOAuthUser = true;
        user.isEmailVerified = true;
        user.profilePicture = picture;
        await this.clientService.updateUserEntity(user);
      }
      userId = user.id;
      userEmail = user.email;
      generalAccount = await this.clientService.findGeneralAccountByUserId(userId);
    if (existingUser) {
      let needUpdate = false;

      if (!existingUser.isOAuthUser) {
        existingUser.isOAuthUser = true;
        needUpdate = true;
      }
      if (!existingUser.googleId && googleId) {
        existingUser.googleId = googleId;
        needUpdate = true;
      }
      if (picture && existingUser.profilePicture !== picture) {
        existingUser.profilePicture = picture;
        needUpdate = true;
      }
      if (isEmailVerified && !existingUser.isEmailVerified) {
        existingUser.isEmailVerified = true;
        needUpdate = true;
      }

      if (needUpdate) {
        await this.userService['userRepository'].save(existingUser);
      }

      userId = existingUser.id;
      userEmail = existingUser.email;
    } else {
      // Create new patient account via Google OAuth
      const randomPassword = randomBytes(16).toString('hex');

      // Construct fullName from first and last name
      const fullName = [firstName, lastName].filter(Boolean).join(' ') || undefined;

      const createdUser = await this.clientService.createPatientViaOAuth({
        email,
        password: randomPassword,
        username: email.split('@')[0],
        fullName,
      const displayName = [firstName, lastName].filter(Boolean).join(' ');

      const createdUser = await this.userService.create({
        email,
        password: randomPassword,
        name: displayName || email,
        isOAuthUser: true,
        googleId,
        isEmailVerified,
        profilePicture: picture,
      });

      userId = createdUser.id;
      userEmail = createdUser.email;
      generalAccount = await this.clientService.findGeneralAccountByUserId(userId);
    }

    user = await this.clientService.findUserEntityById(userId);

    // Check if user account is banned or inactive
    this.clientService.validateUserAccess(user);

    const payload = { sub: userId, email: userEmail, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    this.socketGatewayService.markUserOnline(String(userId));

    // Return token data with complete user information
    return {
      access_token: accessToken,
      userId: userId,
      user: new ClientResponseDto(user, generalAccount),
    };
    const baseUrl = process.env.GOOGLE_URL;
    if (!baseUrl) {
      throw new UnauthorizedException('Google redirect URL is not configured');
    }

    const redirectUrl = new URL(baseUrl);
    if (!redirectUrl.pathname.endsWith('/sso')) {
      redirectUrl.pathname = redirectUrl.pathname.replace(/\/$/, '') + '/sso';
    }
    redirectUrl.searchParams.set('account_id', userId);
    redirectUrl.searchParams.set('access_token', accessToken);

    return redirectUrl.toString();
  }

  // Forget password
  async requestPasswordReset(dto: ForgotPasswordDto) {
    const { email } = dto;
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('User không tồn tại');
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    const reset = this.passwordResetRepo.create({
      user: { id: user.id } as any,
      code,
      expiresAt,
      verified: false,
      used: false,
    });

    await this.passwordResetRepo.save(reset);
    await this.sendResetPasswordEmail(email, code);

    return {
      message:
        'Mã đặt lại mật khẩu đã được gửi tới email. Vui lòng kiểm tra hộp thư.',
    };
  }

  // verify email when enter reset button
  async verifyResetPasswordCode(dto: VerifyResetPasswordDto) {
    const { email, code } = dto;

    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('User không tồn tại');
    }

    const now = new Date();

    const record = await this.passwordResetRepo.findOne({
      where: {
        user: { id: user.id },
        code,
        used: false,
        verified: false,
      },
      order: { createdAt: 'DESC' },
    });

    if (!record) {
      throw new BadRequestException('Mã xác thực không chính xác');
    }

    if (record.expiresAt < now) {
      throw new BadRequestException('Mã xác thực đã hết hạn');
    }

    record.verified = true;
    await this.passwordResetRepo.save(record);

    return {
      message: 'Xác thực mã thành công, bạn có thể đặt mật khẩu mới.',
    };
  }

  // user enter new password
  async setNewPassword(dto: SetNewPasswordDto) {
    const { email, newPassword } = dto;

    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('User không tồn tại');
    }

    const record = await this.passwordResetRepo.findOne({
      where: {
        user: { id: user.id },
        verified: true,
        used: false,
      },
      order: { createdAt: 'DESC' },
    });

    if (!record) {
      throw new BadRequestException(
        'Bạn chưa xác thực mã hoặc mã đã được sử dụng.',
      );
    }

    const isSameAsOld = await bcrypt.compare(newPassword, user.password);
    if (isSameAsOld) {
      throw new BadRequestException(
        'Mật khẩu mới không được trùng với mật khẩu hiện tại',
      );
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await this.userService['userRepository'].save(user as any);

    record.used = true;
    await this.passwordResetRepo.save(record);

    return {
      message:
        'Đổi mật khẩu thành công, vui lòng sử dụng mật khẩu mới để đăng nhập.',
    };
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
