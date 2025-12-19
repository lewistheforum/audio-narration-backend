import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { AccountsService } from '../accounts/client.service';
import { SocketGatewayService } from '../socket-gateway/socket-gateway.service';
import { AccountResponseDto } from '../accounts/dto/client-response.dto';
import { MESSAGES } from 'src/common/message';
import { RegisterDto } from './dto/register.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  VerifyEmailDto,
  ForgotPasswordDto,
  VerifyResetPasswordDto,
  SetNewPasswordDto,
} from './dto';
import { randomBytes } from 'crypto';
import { CodeVerification } from '../mailer/entities/mailer.entity';

/**
 * Authentication Service
 * Handles user authentication logic including standard login and OAuth
 */
@Injectable()
export class AuthService {
  constructor(
    private AccountsService: AccountsService,
    private jwtService: JwtService,
    private socketGatewayService: SocketGatewayService,
    @InjectRepository(CodeVerification)
    private codeVerificationRepo: Repository<CodeVerification>,
  ) {}

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
      user: AccountResponseDto;
    };
  }> {
    const { email, password } = loginDto;
    const user = await this.AccountsService.findByEmail(email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException(MESSAGES.failMessage.invalidCredentials);
    }

    // Check if user account is banned or inactive
    this.AccountsService.validateUserAccess(user);

    const payload = { sub: user.id, email: user.email, role: user.role };
    this.socketGatewayService.markUserOnline(String(user.id));

    // Get general account data for response
    const generalAccount = await this.AccountsService.findGeneralAccountByUserId(
      user.id,
    );

    return {
      data: {
        access_token: this.jwtService.sign(payload),
        userId: user.id,
        user: new AccountResponseDto(user, generalAccount),
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
  // async googleLogin(googleUser: any): Promise<{
  //   access_token: string;
  //   userId: string;
  //   user: AccountResponseDto;
  // }> {
  // Register
  async register(registerDto: RegisterDto) {
    const { username, password, email, gender, dateOfBirth } = registerDto;

    const createResult = await this.AccountsService.create({
      email,
      password,
      name: username,
      isOAuthUser: false,
      isEmailVerified: false,
      profilePicture: undefined,
      gender,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
    } as any);

    const createdUser = createResult.user;

    // Create 6-code send to user
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Save code
    const verification = this.codeVerificationRepo.create({
      account: { id: createdUser.id } as any,
      code,
      expiredAt: expiresAt,
      used: false,
    });
    await this.codeVerificationRepo.save(verification);

    // TODO: Implement sendVerificationEmail method or use MailerService
    // await this.sendVerificationEmail(email, code);
    console.log(`[DEV] Verification code for ${email}: ${code}`);

    const payload = { sub: createdUser.id, email: createdUser.email };
    const accessToken = this.jwtService.sign(payload);

    this.socketGatewayService.markUserOnline(String(createdUser.id));

    return {
      access_token: accessToken,
      userId: createdUser.id,
      message: 'Mã xác thực đã được gửi tới email. Vui lòng kiểm tra hộp thư.',
    };
  }

  // Verify email
  // async verifyEmail(dto: VerifyEmailDto) {
  //   const { email, code } = dto;

  //   const user = await this.userService.findByEmail(email);
  //   if (!user) {
  //     throw new BadRequestException('User không tồn tại');
  //   }

  //   if (user.isEmailVerified) {
  //     throw new BadRequestException('Email đã được xác thực trước đó');
  //   }

  //   const now = new Date();

  //   const record = await this.emailVerificationRepo.findOne({
  //     where: {
  //       user: { id: user.id },
  //       code,
  //       used: false,
  //     },
  //     order: { createdAt: 'DESC' },
  //     relations: ['user'],
  //   });

  //   if (!record) {
  //     throw new BadRequestException('Mã xác thực không chính xác');
  //   }

  //   if (record.expiresAt < now) {
  //     throw new BadRequestException('Mã xác thực đã hết hạn');
  //   }

  //   record.used = true;
  //   await this.emailVerificationRepo.save(record);

  //   user.isEmailVerified = true;
  //   await this.userService['userRepository'].save(user as any);

  //   const payload = { sub: user.id, email: user.email };
  //   const accessToken = this.jwtService.sign(payload);

  //   this.socketGatewayService.markUserOnline(String(user.id));

  //   return {
  //     access_token: accessToken,
  //     userId: user.id,
  //   };
  // }

  // Google Login
  async googleLogin(googleUser: any): Promise<any> {
    if (!googleUser) {
      throw new UnauthorizedException(MESSAGES.failMessage.invalidCredentials);
    }

    // const { email, firstName, lastName, picture } = googleUser;
    const { email, firstName, lastName, picture, googleId, isEmailVerified } =
      googleUser;

    if (!email) {
      throw new UnauthorizedException(
        MESSAGES.failMessage.googleAccountNoEmail,
      );
    }

    let user = await this.AccountsService.findByEmail(email);
    let userId: string;
    let userEmail: string;
    let generalAccount = null;

    if (user) {
      // Update existing user with OAuth data if not already set
      if (!user.isOAuthUser) {
        user.isOAuthUser = true;
        user.isEmailVerified = true;
        user.profilePicture = picture;
        await this.AccountsService.updateUserEntity(user);
      }
      userId = user.id;
      userEmail = user.email;
      generalAccount = await this.AccountsService.findGeneralAccountByUserId(
        userId,
      );
      if (user) {
        let needUpdate = false;

        if (!user.isOAuthUser) {
          user.isOAuthUser = true;
          needUpdate = true;
        }
        // if (!user.googleId && googleId) {
        //   user.googleId = googleId;
        //   needUpdate = true;
        // }
        if (picture && user.profilePicture !== picture) {
          user.profilePicture = picture;
          needUpdate = true;
        }
        if (isEmailVerified && !user.isEmailVerified) {
          user.isEmailVerified = true;
          needUpdate = true;
        }

        if (needUpdate) {
          await this.AccountsService.updateUserEntity(user);
        }

        userId = user.id;
        userEmail = user.email;
      } else {
        // Create new patient account via Google OAuth
        const randomPassword = randomBytes(16).toString('hex');

        // Construct fullName from first and last name
        const fullName =
          [firstName, lastName].filter(Boolean).join(' ') || undefined;

        const createdUser = await this.AccountsService.createPatientViaOAuth({
          email,
          password: randomPassword,
          username: email.split('@')[0],
          fullName,
          profilePicture: picture,
        });

        userId = createdUser.id;
        userEmail = createdUser.email;
        generalAccount = await this.AccountsService.findGeneralAccountByUserId(
          userId,
        );
      }

      user = await this.AccountsService.findUserEntityById(userId);

      // Check if user account is banned or inactive
      this.AccountsService.validateUserAccess(user);

      const payload = { sub: userId, email: userEmail, role: user.role };
      const accessToken = this.jwtService.sign(payload);

      this.socketGatewayService.markUserOnline(String(userId));

      // Return token data with complete user information
      return {
        access_token: accessToken,
        userId: userId,
        user: new AccountResponseDto(user, generalAccount),
      };
      // const baseUrl = process.env.GOOGLE_URL;
      // if (!baseUrl) {
      //   throw new UnauthorizedException('Google redirect URL is not configured');
      // }

      // const redirectUrl = new URL(baseUrl);
      // if (!redirectUrl.pathname.endsWith('/sso')) {
      //   redirectUrl.pathname = redirectUrl.pathname.replace(/\/$/, '') + '/sso';
      // }
      // redirectUrl.searchParams.set('account_id', userId);
      // redirectUrl.searchParams.set('access_token', accessToken);

      // return redirectUrl.toString();
    }
  }

  // Forget password
  // async requestPasswordReset(dto: ForgotPasswordDto) {
  //   const { email } = dto;
  //   const user = await this.userService.findByEmail(email);
  //   if (!user) {
  //     throw new BadRequestException('User không tồn tại');
  //   }

  //   const code = Math.floor(100000 + Math.random() * 900000).toString();

  //   const expiresAt = new Date();
  //   expiresAt.setMinutes(expiresAt.getMinutes() + 10);

  //   const reset = this.passwordResetRepo.create({
  //     user: { id: user.id } as any,
  //     code,
  //     expiresAt,
  //     verified: false,
  //     used: false,
  //   });

  //   await this.passwordResetRepo.save(reset);
  //   await this.sendResetPasswordEmail(email, code);

  //   return {
  //     message:
  //       'Mã đặt lại mật khẩu đã được gửi tới email. Vui lòng kiểm tra hộp thư.',
  //   };
  // }

  // verify email when enter reset button
  async verifyResetPasswordCode(dto: VerifyResetPasswordDto) {
    const { email, code } = dto;

    const user = await this.AccountsService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('User không tồn tại');
    }

    const now = new Date();

    const record = await this.codeVerificationRepo.findOne({
      where: {
        account: { id: user.id },
        code,
        used: false,
      },
      order: { createdAt: 'DESC' },
    });

    if (!record) {
      throw new BadRequestException('Mã xác thực không chính xác');
    }

    if (record.expiredAt < now) {
      throw new BadRequestException('Mã xác thực đã hết hạn');
    }

    record.used = true;
    await this.codeVerificationRepo.save(record);

    return {
      message: 'Xác thực mã thành công, bạn có thể đặt mật khẩu mới.',
    };
  }

  // user enter new password
  // async setNewPassword(dto: SetNewPasswordDto) {
  //   const { email, newPassword } = dto;

  //   const user = await this.userService.findByEmail(email);
  //   if (!user) {
  //     throw new BadRequestException('User không tồn tại');
  //   }

  //   const record = await this.passwordResetRepo.findOne({
  //     where: {
  //       user: { id: user.id },
  //       verified: true,
  //       used: false,
  //     },
  //     order: { createdAt: 'DESC' },
  //   });

  //   if (!record) {
  //     throw new BadRequestException(
  //       'Bạn chưa xác thực mã hoặc mã đã được sử dụng.',
  //     );
  //   }

  //   const isSameAsOld = await bcrypt.compare(newPassword, user.password);
  //   if (isSameAsOld) {
  //     throw new BadRequestException(
  //       'Mật khẩu mới không được trùng với mật khẩu hiện tại',
  //     );
  //   }

  //   const salt = await bcrypt.genSalt(10);
  //   user.password = await bcrypt.hash(newPassword, salt);
  //   await this.userService['userRepository'].save(user as any);

  //   record.used = true;
  //   await this.passwordResetRepo.save(record);

  //   return {
  //     message:
  //       'Đổi mật khẩu thành công, vui lòng sử dụng mật khẩu mới để đăng nhập.',
  //   };
  // }
}
