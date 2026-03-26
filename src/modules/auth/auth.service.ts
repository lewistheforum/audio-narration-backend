import {
  BadRequestException,
  ForbiddenException,
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
  SetInitialPasswordDto,
} from './dto';
import { CodeVerificationRepository } from '../accounts/repositories';
import { AccountStatus } from '../accounts/enums/account-status.enum';
import { AccountRole } from '../accounts/enums/account-role.enum';
import { VerificationType } from '../accounts/enums/verification-type.enum';
import { Account } from '../accounts/entities/accounts.entity';
import { getCurrentVietnamTime } from 'src/common/utils/date.util';

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

  private async buildJwtPayload(user: Account): Promise<Record<string, any>> {
    const subscriptionPayload =
      await this.AccountsService.getSubscriptionPayloadForAccount(user);

    return {
      sub: user._id,
      uId: user._id,
      email: user.email,
      role: user.role,
      ...subscriptionPayload,
    };
  }

  /**
   * Standard email/password login
   * - Validates credentials against database
   * - Checks user status (bans, inactive accounts)
   * - Returns JWT token with user ID, email, role, and complete user info
   * - Marks user as online via socket gateway
   * - Returns conditional message based on account status (ACTIVE vs UNVERIFIED)
   */
  async login(loginDto: LoginDto): Promise<{
    data: {
      accessToken: string;
      userId: string;
      user: AccountResponseDto;
    };
    message: string;
  }> {
    const { email, password } = loginDto;
    const accountWithGeneral = await this.AccountsService.findAccountWithGeneralByEmail(email);
    
    if (!accountWithGeneral) {
      throw new UnauthorizedException(MESSAGES.failMessage.invalidCredentials);
    }

    // Block pure OAuth users without a password - they must use Google login
    const user = accountWithGeneral;
    if (!user || (user.isOAuthUser && !user.password)) {
      throw new UnauthorizedException(MESSAGES.failMessage.invalidCredentials);
    }

    if (!(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException(MESSAGES.failMessage.invalidCredentials);
    }

    // Check if user account is banned or deleted (UNVERIFIED is allowed)
    this.AccountsService.validateAccountAccess(user);

    // Check if parent manager is disabled (for Staff/Doctor)
    await this.AccountsService.validateParentManagerStatus(user);

    // Check clinic subscription status for clinic-related roles
    await this.AccountsService.validateClinicSubscription(user);

    const payload = await this.buildJwtPayload(user);
    this.socketGatewayService.markUserOnline(String(user._id));

    // Get general account data from the joined query
    const generalAccount = accountWithGeneral.generalAccount;

    // Determine message based on account status
    const message = user.status === AccountStatus.UNVERIFIED
      ? MESSAGES.successMessage.loginSuccessUnverified
      : MESSAGES.successMessage.loginSuccess;

    return {
      data: {
        accessToken: this.jwtService.sign(payload),
        userId: user._id,
        user: new AccountResponseDto(user, generalAccount),
      },
      message,
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

    let user = await this.AccountsService.findAccountWithGeneralByEmail(email);
    let userId: string;
    let userEmail: string;
    let generalAccount = user?.generalAccount || null;

    if (user) {
      if (user.role !== AccountRole.PATIENT) {
        throw new ForbiddenException(
          'Google login is only available for Patient accounts. Please log in using your registered email and password.',
        );
      }

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
        await this.AccountsService.saveAccount(user);
      }

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
      const fullName =
        [firstName, lastName].filter(Boolean).join(' ') || undefined;

      const createdUser = await this.AccountsService.createPatientViaOAuth({
        email,
        password: null,
        username: email.split('@')[0],
        fullName,
        profilePicture: picture,
      });

      userId = createdUser.id;
      userEmail = createdUser.email;

      const setupToken = this.jwtService.sign(
        { userId, email: userEmail, type: 'INITIAL_PWD_SETUP' },
        { expiresIn: '15m' },
      );

      return {
        requirePasswordSetup: true,
        setupToken: setupToken,
        userId: userId,
        email: userEmail,
      };
    }

    this.AccountsService.validateAccountAccess(user);

    const payload = await this.buildJwtPayload(user);
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

    const now = getCurrentVietnamTime();

    const record = await this.codeVerificationRepository.findValidByUserIdAndCode(
      user._id,
      code,
      VerificationType.RESET,
    );

    if (!record) {
      throw new BadRequestException('Invalid verification code');
    }

    if (record.expiredAt < now) {
      throw new BadRequestException('Verification code has expired');
    }

    return {
      message: 'Verification code validated successfully. You can now set a new password.',
    };
  }

  /**
   * Set Initial Password for New OAuth User
   *
   * Completes the forced password setup flow for new Google OAuth users.
   * Validates the temporary setup token, hashes the provided password,
   * updates the user entity, and returns full access tokens.
   *
   * Security Features:
   * - Temporary token expires after 15 minutes
   * - Token type must be 'INITIAL_PWD_SETUP'
   * - User must be OAuth user with no password set
   * - Password is hashed with bcrypt before storage
   *
   * @param {SetInitialPasswordDto} dto - Contains temporary token and new password
   * @returns {Promise<{accessToken: string, userId: string, user: AccountResponseDto}>} Full auth tokens
   * @throws {UnauthorizedException} If token is invalid or expired
   * @throws {BadRequestException} If user is not OAuth-only or already has password
   *
   * @example
   * ```typescript
   * const result = await authService.setInitialPasswordForOAuthUser({
   *   token: 'eyJhbGciOiJIUzI1NiIs...',
   *   password: 'SecureP@ss123'
   * });
   * // Returns full access token and user data
   * ```
   */
  async setInitialPasswordForOAuthUser(dto: SetInitialPasswordDto): Promise<{
    data: {
      accessToken: string;
      userId: string;
      user: AccountResponseDto;
    };
    message: string;
  }> {
    let decoded: any;
    try {
      decoded = this.jwtService.verify(dto.token);
    } catch {
      throw new UnauthorizedException('Invalid or expired setup token');
    }

    if (decoded.type !== 'INITIAL_PWD_SETUP') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.AccountsService.findAccountWithGeneralById(decoded.userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.password !== null) {
      throw new BadRequestException(
        'This account already has a password set.',
      );
    }

    if (!user.isOAuthUser) {
      throw new BadRequestException(
        'This account does not require initial password setup',
      );
    }

    user.password = await bcrypt.hash(dto.password, 10);
    await this.AccountsService.updateAccountEntity(user);

    const generalAccount = user.generalAccount || null;

    this.AccountsService.validateAccountAccess(user);
    await this.AccountsService.validateClinicSubscription(user);

    const payload = await this.buildJwtPayload(user);
    const accessToken = this.jwtService.sign(payload);

    this.socketGatewayService.markUserOnline(String(user._id));

    return {
      data: {
        accessToken: accessToken,
        userId: user._id,
        user: new AccountResponseDto(user, generalAccount),
      },
      message: 'Password set successfully. You can now login with email/password or Google.',
    };
  }

}
