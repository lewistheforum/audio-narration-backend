import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
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
import { LegalDocumentVerificationStatus } from '../accounts/enums/legal-document-verification-status.enum';
import { VerificationType } from '../accounts/enums/verification-type.enum';
import { Account } from '../accounts/entities/accounts.entity';
import { getCurrentVietnamTime } from 'src/common/utils/date.util';
import { RegistrationStatus } from '../subscriptions/enums/subscription-status.enum';

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

  private isOnboardingStatus(status?: RegistrationStatus): boolean {
    return (
      !!status &&
      [
        RegistrationStatus.PENDING_SEPAY_SETUP,
        RegistrationStatus.PENDING_MANAGER_SETUP,
        RegistrationStatus.PENDING_LEGAL_SETUP,
        RegistrationStatus.PENDING_APPROVAL,
        RegistrationStatus.PENDING_PAYMENT,
      ].includes(status)
    );
  }

  private ensureHierarchySubscription(
    subscription: Account['subscription'] | undefined,
    message: string,
  ): void {
    const now = getCurrentVietnamTime();

    if (!subscription) {
      throw new ForbiddenException(message);
    }

    const allowedStatuses = [
      RegistrationStatus.ACTIVE,
      RegistrationStatus.NON_RENEWING,
    ];

    if (!allowedStatuses.includes(subscription.subscriptionStatus)) {
      throw new ForbiddenException(message);
    }

    if (
      subscription.expirationDate &&
      new Date(subscription.expirationDate) <= now
    ) {
      throw new ForbiddenException(message);
    }
  }

  private canBypassHierarchyChecksForOnboarding(
    user: Account,
    onboardingStatus?: RegistrationStatus,
  ): boolean {
    if (!this.isOnboardingStatus(onboardingStatus)) {
      return false;
    }

    if (user.role === AccountRole.CLINIC_ADMIN) {
      return true;
    }

    return (
      user.role === AccountRole.CLINIC_MANAGER &&
      [
        RegistrationStatus.PENDING_LEGAL_SETUP,
        RegistrationStatus.PENDING_APPROVAL,
      ].includes(onboardingStatus)
    );
  }

  private validateHierarchyLoginAccess(
    user: Account,
    onboardingStatus?: RegistrationStatus,
  ): void {
    if (this.canBypassHierarchyChecksForOnboarding(user, onboardingStatus)) {
      return;
    }

    if (user.role === AccountRole.CLINIC_ADMIN) {
      this.ensureHierarchySubscription(
        user.subscription,
        'Clinic subscription is not active. Please renew or complete the registration flow.',
      );
      return;
    }

    if (user.role === AccountRole.CLINIC_MANAGER) {
      if (user.status === AccountStatus.MANAGER_DISABLED) {
        throw new ForbiddenException(
          'Your clinic branch has been temporarily disabled. Please contact your clinic administrator.',
        );
      }

      const parentAdmin = user.parent;

      if (!parentAdmin) {
        throw new ForbiddenException(
          'Account hierarchy error. No parent clinic admin found.',
        );
      }

      if (parentAdmin.status === AccountStatus.BAN) {
        throw new ForbiddenException(
          'The clinic network has been suspended. Please contact support for assistance.',
        );
      }

      if (parentAdmin.status === AccountStatus.DELETED) {
        throw new ForbiddenException(
          'The clinic network has been deleted. Please contact support.',
        );
      }

      this.ensureHierarchySubscription(
        parentAdmin.subscription,
        'The parent clinic subscription is not active. Please contact the clinic administrator.',
      );

      if (
        !user.legalDocuments ||
        user.legalDocuments.verificationStatus !==
          LegalDocumentVerificationStatus.APPROVED
      ) {
        throw new ForbiddenException(
          'Manager legal documents are not approved yet. Dashboard access is blocked.',
        );
      }

      return;
    }

    if (
      user.role === AccountRole.CLINIC_STAFF ||
      user.role === AccountRole.DOCTOR
    ) {
      const parentManager = user.parent;

      if (!parentManager) {
        throw new ForbiddenException(
          'Account hierarchy error. No parent clinic manager found.',
        );
      }

      if (parentManager.status === AccountStatus.BAN) {
        throw new ForbiddenException(
          'Your clinic branch has been suspended. Please contact support.',
        );
      }

      if (parentManager.status === AccountStatus.MANAGER_DISABLED) {
        throw new ForbiddenException(
          'Your clinic branch has been temporarily disabled. Please contact your clinic administrator.',
        );
      }

      if (
        !parentManager.legalDocuments ||
        parentManager.legalDocuments.verificationStatus !==
          LegalDocumentVerificationStatus.APPROVED
      ) {
        throw new ForbiddenException(
          'Parent manager legal documents are not approved yet. Dashboard access is blocked.',
        );
      }

      const rootAdmin = parentManager.parent;

      if (!rootAdmin) {
        throw new ForbiddenException(
          'Account hierarchy error. No root clinic admin found.',
        );
      }

      if (rootAdmin.status === AccountStatus.BAN) {
        throw new ForbiddenException(
          'The clinic network has been suspended. Please contact support for assistance.',
        );
      }

      if (rootAdmin.status === AccountStatus.DELETED) {
        throw new ForbiddenException(
          'The clinic network has been deleted. Please contact support.',
        );
      }

      this.ensureHierarchySubscription(
        rootAdmin.subscription,
        'The root clinic subscription is not active. Please contact the clinic administrator.',
      );
    }
  }

  private async resolveLoginAccount(loginDto: LoginDto): Promise<Account> {
    const candidateAccounts =
      await this.AccountsService.findLoginCandidatesByEmail(
        loginDto.email,
        loginDto.role,
      );

    if (candidateAccounts.length === 0) {
      throw new UnauthorizedException(MESSAGES.failMessage.invalidAccountRole);
    }

    const matchedAccounts: Account[] = [];

    for (const candidate of candidateAccounts) {
      if (candidate.isOAuthUser && !candidate.password) {
        continue;
      }

      if (
        candidate.password &&
        (await bcrypt.compare(loginDto.password, candidate.password))
      ) {
        matchedAccounts.push(candidate);
      }
    }

    if (matchedAccounts.length === 0) {
      throw new UnauthorizedException(MESSAGES.failMessage.invalidCredentials);
    }

    if (matchedAccounts.length > 1) {
      const prioritizedClinicAdmin = matchedAccounts.find(
        (account) => account.role === AccountRole.CLINIC_ADMIN,
      );

      if (prioritizedClinicAdmin) {
        return prioritizedClinicAdmin;
      }

      throw new UnauthorizedException(
        'Multiple accounts matched this email and password. Please contact support.',
      );
    }

    return matchedAccounts[0];
  }

  private async buildJwtPayload(
    user: Account,
    onboardingState?: Record<string, any>,
  ): Promise<Record<string, any>> {
    const subscriptionPayload =
      await this.AccountsService.getSubscriptionPayloadForAccount(user);
    const resolvedOnboardingState =
      onboardingState ||
      (await this.AccountsService.getLoginOnboardingState(user));

    return {
      sub: user._id,
      uId: user._id,
      email: user.email,
      role: user.role,
      ...subscriptionPayload,
      ...resolvedOnboardingState,
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
      onboardingStatus?: RegistrationStatus;
      registrationStep?: string;
      nextAction?: string;
      canAccessDashboard?: boolean;
      managerAccountId?: string;
      notice?: string;
      expirationDate?: string;
    };
    message: string;
  }> {
    const user = await this.resolveLoginAccount(loginDto);

    if (user.role !== loginDto.role) {
      throw new UnauthorizedException(MESSAGES.failMessage.roleMissmatch);
    }

    // Block pure OAuth users without a password - they must use Google login
    if (!user || (user.isOAuthUser && !user.password)) {
      throw new UnauthorizedException(MESSAGES.failMessage.invalidCredentials);
    }

    // Check if user account is banned or deleted (UNVERIFIED is allowed)
    this.AccountsService.validateAccountAccess(user);

    const onboardingState =
      await this.AccountsService.getLoginOnboardingState(user);
    this.validateHierarchyLoginAccess(user, onboardingState.onboardingStatus);
    const payload = await this.buildJwtPayload(user, onboardingState);
    this.socketGatewayService.markUserOnline(String(user._id));

    // Get general account data from the joined query
    const generalAccount = user.generalAccount;

    // Determine message based on account status
    const message =
      user.status === AccountStatus.UNVERIFIED
        ? MESSAGES.successMessage.loginSuccessUnverified
        : MESSAGES.successMessage.loginSuccess;

    return {
      data: {
        accessToken: this.jwtService.sign(payload),
        userId: user._id,
        user: new AccountResponseDto(user, generalAccount),
        ...onboardingState,
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

      if (
        picture &&
        generalAccount &&
        generalAccount.profilePicture !== picture
      ) {
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
    const { email, code, role } = dto;

    const user = await this.AccountsService.findByEmail(email, role);

    if (!user) {
      throw new NotFoundException(
        MESSAGES.failMessage.accountCannotResetInRole,
      );
    }

    if (user.isOAuthUser && !user.password) {
      throw new BadRequestException(
        MESSAGES.failMessage.oauthUserCannotResetPassword,
      );
    }

    const now = getCurrentVietnamTime();

    const record =
      await this.codeVerificationRepository.findValidByUserIdAndCode(
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
      message:
        'Verification code validated successfully. You can now set a new password.',
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

    const user = await this.AccountsService.findAccountWithGeneralById(
      decoded.userId,
    );
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.password !== null) {
      throw new BadRequestException('This account already has a password set.');
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
      message:
        'Password set successfully. You can now login with email/password or Google.',
    };
  }
}
