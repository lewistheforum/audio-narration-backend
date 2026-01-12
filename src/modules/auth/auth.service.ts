import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { AccountsService } from '../accounts/accounts.service';
import { SocketGatewayService } from '../socket-gateway/socket-gateway.service';
import { AccountResponseDto } from '../accounts/dto/account-response.dto';
import { MESSAGES } from 'src/common/message';
import { RegisterDto } from './dto/register.dto';
import {
  VerifyEmailDto,
  ForgotPasswordDto,
  VerifyResetPasswordDto,
  SetNewPasswordDto,
} from './dto';
import { randomBytes } from 'crypto';
import { CodeVerificationRepository } from '../accounts/repositories';

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
    private codeVerificationRepository: CodeVerificationRepository,
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
      accessToken: string;
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
    this.AccountsService.validateAccountAccess(user);

    const payload = { sub: user._id, email: user.email, role: user.role };
    this.socketGatewayService.markUserOnline(String(user._id));

    // Get general account data for response
    const generalAccount = await this.AccountsService.findGeneralAccountByUserId(
      user._id,
    );

    return {
      data: {
        accessToken: this.jwtService.sign(payload),
        userId: user._id,
        user: new AccountResponseDto(user, generalAccount),
      },
    };
  }

  /**
   * Google OAuth Login
   * Handles Google OAuth authentication flow
   * Creates new PATIENT accounts or updates existing users with OAuth data
   */
  async googleLogin(googleUser: any): Promise<any> {
    if (!googleUser) {
      throw new UnauthorizedException(MESSAGES.failMessage.invalidCredentials);
    }

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
      // Update existing user with OAuth data
      let needUpdate = false;
      let needUpdateGeneralAccount = false;

      if (!user.isOAuthUser) {
        user.isOAuthUser = true;
        needUpdate = true;
      }
      if (isEmailVerified && !user.isEmailVerified) {
        user.isEmailVerified = true;
        needUpdate = true;
      }

      if (needUpdate) {
        await this.AccountsService.updateAccountEntity(user);
      }

      // Update profilePicture in GeneralAccount if needed
      generalAccount = await this.AccountsService.findGeneralAccountByUserId(
        user._id,
      );
      
      if (picture && generalAccount && generalAccount.profilePicture !== picture) {
        generalAccount.profilePicture = picture;
        needUpdateGeneralAccount = true;
      }

      if (needUpdateGeneralAccount && generalAccount) {
        await this.AccountsService.updateGeneralAccountEntity(generalAccount);
      }

      userId = user._id;
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

      user = await this.AccountsService.findAccountEntityById(userId);

      // Check if user account is banned or inactive
      this.AccountsService.validateAccountAccess(user);

      const payload = { sub: userId, email: userEmail, role: user.role };
      const accessToken = this.jwtService.sign(payload);

      this.socketGatewayService.markUserOnline(String(userId));

      return {
        accessToken: accessToken,
        userId: userId,
        user: new AccountResponseDto(user, generalAccount),
      };
  }

  async verifyResetPasswordCode(dto: VerifyResetPasswordDto) {
    const { email, code } = dto;

    const user = await this.AccountsService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('User does not exist');
    }

    const now = new Date();

    // Find latest unused code for this user
    const userCodes = await this.codeVerificationRepository.findByUserId(user._id);
    const record = userCodes
      .filter(c => c.code === code && !c.used)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    if (!record) {
      throw new BadRequestException('Invalid verification code');
    }

    if (record.expiredAt < now) {
      throw new BadRequestException('Verification code has expired');
    }

    // await this.codeVerificationRepository.markAsUsed(record._id);

    return {
      message: 'Verification code validated successfully. You can now set a new password.',
    };
  }

  }
