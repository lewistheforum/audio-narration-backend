import {
  Controller,
  Post,
  Put,
  Patch,
  Body,
  Get,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Param,
  Res,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RsaCryptoService } from 'src/common/services/rsa-crypto.service';
import { EncryptedPayloadDto } from 'src/common/dto/encrypted-payload.dto';
import {
  LoginDto,
  LoginResponseDto,
  VerifyEmailDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ResendVerificationDto,
  VerifyResetPasswordDto,
  SetInitialPasswordDto,
} from './dto';
import {
  CreateClinicManagerForRegistrationDto,
  UploadLegalDocumentDto,
  UpdateLegalDocumentsDto,
  LegalDocumentResponseDto,
} from '../accounts/dto';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiTags,
  ApiBearerAuth,
  ApiExtraModels,
} from '@nestjs/swagger';
import { MESSAGES } from 'src/common/message';
import { ApiResponseData } from 'src/common/decorators/api-response.decorator';
import { AccountsService } from '../accounts/accounts.service';
import {
  CreateAccountDto,
  AccountResponseDto,
  CreateStaffByClinicManagerDto,
  CreateDoctorByClinicManagerDto,
  RegisterClinicAdminDto,
  CheckRegistrationStatusResponseDto,
} from '../accounts/dto';
import { JwtAuthGuard } from './jwt.strategy';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

import { MailerService } from '../mailer/mailer.service';
import { AccountRole } from '../accounts/enums';

/**
 * Authentication Controller
 * Handles user authentication, registration, email verification, and OAuth operations
 *
 * @tag Authentication
 */
@ApiTags('Authentication')
@Controller('auth')
@ApiExtraModels(
  AccountResponseDto,
  LoginResponseDto,
  CheckRegistrationStatusResponseDto,
)
export class AuthController {
  constructor(
    private authService: AuthService,
    private AccountsService: AccountsService,
    private mailerService: MailerService,
    private configService: ConfigService,
    private rsaCryptoService: RsaCryptoService,
  ) {}

  /**
   * Expose RSA Public Key
   *
   * Returns the server's RSA public key in PEM format.
   * Clients must use this key to encrypt login credentials and blog payloads
   * before sending them to the protected endpoints.
   *
   * @returns RSA public key PEM string
   */
  @Get('public-key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get server RSA public key',
    description:
      'Returns the RSA public key used to encrypt request payloads. ' +
      'Use this key with RSA-OAEP-SHA256 padding before calling POST /auth/login or blog CUD endpoints.',
  })
  @ApiResponse({
    status: 200,
    description: 'RSA public key in PEM format',
    schema: { properties: { publicKey: { type: 'string' } } },
  })
  getPublicKey(): { publicKey: string } {
    return { publicKey: this.rsaCryptoService.getPublicKey() };
  }

  /**
   * User Login
   *
   * Authenticates user with email and password.
   * The request body must be encrypted with the server RSA public key (OAEP SHA-256).
   *
   * Encrypted body shape (before encryption): { email: string, password: string, role: string }
   *
   * @param body - { encryptedData: string } — RSA-OAEP-SHA256 encrypted + base64-encoded LoginDto JSON
   * @returns JWT access token and user information
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login with encrypted credentials (RSA-OAEP-SHA256)',
    description:
      'Accepts a base64-encoded RSA-OAEP-SHA256 encrypted JSON body. ' +
      'Encrypt { email, password, role } JSON with the public key from GET /auth/public-key.',
  })
  @ApiBody({ type: EncryptedPayloadDto })
  @ApiResponseData({
    type: LoginResponseDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.loginSuccess,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 400, description: 'Invalid or malformed encrypted payload' })
  async login(
    @Body() body: EncryptedPayloadDto,
  ): Promise<{ data: any; message: string }> {
    // Decrypt RSA payload → parse original LoginDto fields
    const plaintext = this.rsaCryptoService.decryptWithPrivateKey(body.encryptedData);
    let loginDto: LoginDto;
    try {
      loginDto = JSON.parse(plaintext);
    } catch {
      throw new BadRequestException('Invalid JSON payload after decryption');
    }
    const result = await this.authService.login(loginDto);
    return { data: result.data, message: result.message };
  }

  /**
   * Google OAuth Login Initiation
   * Redirects user to Google consent screen
   */
  @Post('verify-reset-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Password reset code authentication' })
  @ApiBody({ type: VerifyResetPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password reset code authentication successful.',
  })
  async verifyResetCode(@Body() dto: VerifyResetPasswordDto) {
    return await this.authService.verifyResetPasswordCode(dto);
  }

  @Get('google')
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  @ApiResponse({ status: 302, description: 'Redirects to Google login page' })
  @UseGuards(AuthGuard('google'))
  async googleAuth(): Promise<void> {}

  /**
   * Google OAuth Callback Handler
   * Processes Google authentication response and returns JWT token
   *
   * @param req - Request object containing authenticated user data
   * @returns JWT access token and user information
   */
  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth callback handler' })
  @ApiResponse({ status: 200, description: 'Returns JWT token and user info' })
  @ApiResponse({ status: 401, description: 'Google authentication failed' })
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: any, @Res() res: any): Promise<void> {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_LANDING_URL') ||
      'http://localhost:3000';

    try {
      const tokenData = await this.authService.googleLogin(req.user);

      const redirectUrl = new URL(`${frontendUrl}/`);

      if (tokenData.requirePasswordSetup) {
        redirectUrl.searchParams.set('requirePasswordSetup', 'true');
        redirectUrl.searchParams.set('setupToken', tokenData.setupToken);
        redirectUrl.searchParams.set('userId', tokenData.userId);
      } else {
        redirectUrl.searchParams.set('token', tokenData.accessToken);
        redirectUrl.searchParams.set('userId', tokenData.userId);
      }

      return res.redirect(redirectUrl.toString());
    } catch (error) {
      const redirectUrl = new URL(`${frontendUrl}/`);
      redirectUrl.searchParams.set('error', error.response?.error || 'AuthError');
      redirectUrl.searchParams.set(
        'message',
        error.response?.message || error.message || 'Authentication failed',
      );
      redirectUrl.searchParams.set('openLogin', 'true');

      return res.redirect(redirectUrl.toString());
    }
  }

  /**
   * Set Initial Password for New OAuth User
   *
   * Completes the forced password setup flow for new Google OAuth users.
   * Called after user clicks the link in their email or enters the setup token.
   *
   * @param setInitialPasswordDto - Contains temporary setup token and new password
   * @returns Full access token and user data
   */
  @Patch('google/set-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set initial password for new Google OAuth user',
    description:
      'Required for new Google users to establish a password. Token expires after 15 minutes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password set successfully, returns full access token',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired token, or password already set',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid token' })
  @ApiBody({ type: SetInitialPasswordDto })
  async setInitialPassword(
    @Body() setInitialPasswordDto: SetInitialPasswordDto,
  ): Promise<{
    data: { accessToken: string; userId: string; user: AccountResponseDto };
    message: string;
  }> {
    return await this.authService.setInitialPasswordForOAuthUser(
      setInitialPasswordDto,
    );
  }

  /**
   * Register Account (Single-Step Registration)
   * Creates complete account with profile in one transaction
   * Frontend can handle multi-step UI while backend processes everything in one call
   *
   * @param createAccountDto - Complete account data (credentials + profile)
   * @returns Complete account with PENDING status
   */
  @Post('register')
  @ApiOperation({
    summary: 'Register new account (PATIENT role)',
    description:
      'Single-step registration. Creates account and profile in one transaction. Account status will be PENDING.',
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiResponseData({
    type: AccountResponseDto,
    status: MESSAGES.statusCode.created,
    message:
      'Account created successfully. Please request verification code to activate your account.',
  })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async register(
    @Body() createAccountDto: CreateAccountDto,
  ): Promise<{ data: AccountResponseDto; message: string }> {
    const account = await this.AccountsService.createAccount(createAccountDto);

    return {
      data: account,
      message:
        'Account created successfully. Please request verification code via POST /mailer/send-verification-code to activate your account.',
    };
  }

  /**
   * Verify Email with 6-digit Code
   * Verifies user's email address with verification code
   * Sends welcome email after successful verification
   *
   * @param verifyEmailDto - Email and verification code
   * @returns Success message
   */
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with 6-digit code' })
  @ApiBody({ type: VerifyEmailDto })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired verification code',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Email already verified' })
  async verifyEmail(
    @Body() verifyEmailDto: VerifyEmailDto,
  ): Promise<{ message: string }> {
    const user = await this.AccountsService.verifyEmailCode(
      verifyEmailDto.email,
      verifyEmailDto.code,
      verifyEmailDto.role,
    );

    // Send welcome email
    await this.mailerService.sendWelcomeEmail(
      user.email,
      user.firstName,
      user.lastName,
    );

    return {
      message: MESSAGES.successMessage.emailVerifiedSuccess,
    };
  }

  /**
   * Reset Password with Code
   * Resets user password using code sent to their email
   * Public endpoint - no authentication required
   *
   * @param resetPasswordDto - Email, reset code, and new password
   * @returns Success message
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with code' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired reset code' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 400, description: 'Validation error or OAuth user' })
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    await this.AccountsService.resetPasswordWithCode(
      resetPasswordDto.email,
      resetPasswordDto.role,
      resetPasswordDto.code,
      resetPasswordDto.newPassword,
    );

    return {
      message: MESSAGES.successMessage.passwordResetSuccess,
    };
  }

  /**
   * Check Clinic Admin Registration Status (Public)
   *
   * Checks if an email has an in-progress clinic admin registration.
   * Returns current registration status and next action for user.
   *
   * Query Parameters:
   * - email: Email address to check
   *
   * Business Rules:
   * - Does NOT modify database
   * - Returns status if email exists and has pending registration
   * - Returns canStart: true if email doesn't exist or no pending registration
   *
   * Access Control:
   * - Public endpoint (no authentication required)
   *
   * Use Cases:
   * - Checking if user can start new registration
   * - Checking if user can resume existing registration
   * - Displaying appropriate UI based on registration status
   *
   * @param email - Email address to check
   * @returns Registration status information
   *
   * @swagger
   * @response 200 - Successfully retrieved registration status
   */
  @Post('check-registration-status')
  @ApiOperation({
    summary: 'Check clinic admin registration status (Public)',
    description:
      'Checks if an email has an in-progress clinic admin registration and returns current status',
  })
  @HttpCode(HttpStatus.OK)
  @ApiResponseData({
    type: CheckRegistrationStatusResponseDto,
    status: MESSAGES.statusCode.success,
    message: 'Registration status retrieved successfully',
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async checkRegistrationStatus(
    @Body('email') email: string,
  ): Promise<{ data: CheckRegistrationStatusResponseDto; message: string }> {
    const status = await this.AccountsService.checkRegistrationStatus(email);
    return {
      data: status,
      message: 'Registration status retrieved successfully',
    };
  }

  /**
   * Register Clinic Admin (Public)
   *
   * Creates a complete clinic admin registration with account, profile, and subscription.
   * Uses QueryRunner for transaction safety - all operations succeed or none do.
   *
   * Business Rules:
   * - Email policy: One email can be used max 2 times (1x CLINIC_ADMIN + 1x CLINIC_MANAGER)
   * - Creates Account with CLINIC_ADMIN role and PENDING status
   * - Creates ClinicAdminInformation with clinic details
   * - Creates ClinicSubscription with PENDING_SEPAY_SETUP status
   * - Password is hashed with bcrypt before storage
   *
   * Request Body:
   * - username: Username (required)
   * - email: Email address (required)
   * - password: Password (required, min 6 chars, 1 letter, 1 number)
   * - phone: Phone number (optional)
   * - clinicName: Clinic name (required)
   * - description: Clinic description (optional)
   * - specializedIn: Medical specializations (optional)
   * - pros: Clinic pros/advantages (optional)
   * - paraclinical: Paraclinical services (optional)
   * - dob: Date of birth (optional)
   * - profilePicture: Profile picture URL (optional)
   * - serviceId: Subscription service ID (required)
   *
   * Access Control:
   * - Public endpoint (no authentication required)
   *
   * Registration Flow:
   * - Step 2: Collects Initial Profile + Payment Data (including bank details)
   * - Step 3: Reserved for Payment Verification and Confirmation (PATCH /account/clinic-admin/payment-config)
   *
   * Use Cases:
   * - Initial clinic admin registration
   * - Starting new clinic registration flow
   *
   * @param dto - Clinic admin registration data (including bank configuration)
   * @returns Created account with subscription status (PENDING_SEPAY_SETUP)
   *
   * @swagger
   * @response 201 - Successfully registered clinic admin
   * @response 409 - Email already exists or exceeds usage limit
   * @response 400 - Validation error
   */
  @Post('register-clinic-admin')
  @ApiOperation({
    summary: 'Register clinic admin (Public)',
    description:
      'Creates a complete clinic admin registration with account, profile, payment configuration (bank details), and subscription in one step. Bank details are collected during initial registration (Step 2). The payment-config endpoint (Step 3) is available for verification and confirmation of the pre-filled bank details.',
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiResponseData({
    type: AccountResponseDto,
    status: MESSAGES.statusCode.created,
    message: 'Clinic admin registered successfully',
  })
  @ApiResponse({
    status: 409,
    description: 'Email already exists or exceeds usage limit',
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async registerClinicAdmin(
    @Body() dto: RegisterClinicAdminDto,
  ): Promise<{ data: AccountResponseDto; message: string }> {
    const account = await this.AccountsService.registerClinicAdmin(dto);
    return {
      data: account,
      message:
        'Clinic admin registered successfully. Please create a clinic manager account to continue.',
    };
  }

  /**
   * Add Clinic Staff by Manager (Protected Endpoint)
   * Allows clinic managers to add staff accounts to their clinic
   * Requires authentication and CLINIC_MANAGER role
   *
   * 2-Step Registration Pattern:
   * - Creates account with PENDING status
   * - Staff must complete profile themselves via separate endpoint
   * - Account cannot login until profile is completed
   *
   * @param req - Request object containing authenticated user
   * @param createStaffDto - Staff registration data
   * @returns Created staff account (PENDING status)
   */
  @Post('clinic-manager/add-staff')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_MANAGER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Add clinic staff (CLINIC_MANAGER only) - Creates PENDING account',
    description:
      'Creates staff account with PENDING status. Staff must complete profile before login.',
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiResponseData({
    type: AccountResponseDto,
    status: MESSAGES.statusCode.created,
    message: 'Staff account created (PENDING). Staff must complete profile.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires CLINIC_MANAGER role',
  })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async addStaffByManager(
    @Req() req: any,
    @Body() createStaffDto: CreateStaffByClinicManagerDto,
  ): Promise<{ data: AccountResponseDto; message: string }> {
    const managerId = req.user._id;
    const staff = await this.AccountsService.createStaffByClinicManager(
      managerId,
      createStaffDto,
    );
    return {
      data: staff,
      message: 'Staff account created successfully',
    };
  }

  /**
   * Add Doctor by Manager (Protected Endpoint)
   * Allows clinic managers to add doctor accounts to their clinic
   * Requires authentication and CLINIC_MANAGER role
   *
   * 2-Step Registration Pattern:
   * - Creates account with PENDING status
   * - Doctor must complete profile themselves via separate endpoint
   * - Account cannot login until profile is completed
   *
   * @param req - Request object containing authenticated user
   * @param createDoctorDto - Doctor registration data
   * @returns Created doctor account (PENDING status)
   */
  @Post('clinic-manager/add-doctor')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_MANAGER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Add doctor (CLINIC_MANAGER only) - Creates PENDING account',
    description:
      'Creates doctor account with PENDING status. Doctor must complete profile before login.',
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiResponseData({
    type: AccountResponseDto,
    status: MESSAGES.statusCode.created,
    message: 'Doctor account created (PENDING). Doctor must complete profile.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires CLINIC_MANAGER role',
  })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async addDoctorByManager(
    @Req() req: any,
    @Body() createDoctorDto: CreateDoctorByClinicManagerDto,
  ): Promise<{ data: AccountResponseDto; message: string }> {
    const managerId = req.user._id;
    const doctor = await this.AccountsService.createDoctorByClinicManager(
      managerId,
      createDoctorDto,
    );
    return {
      data: doctor,
      message: 'Doctor account created successfully',
    };
  }

  /**
   * Create Clinic Manager for Registration (Step 4A)
   *
   * Creates a clinic manager account for a clinic admin during registration flow.
   *
   * Business Rules:
   * - Actor must have CLINIC_ADMIN role
   * - Registration/subscription status must be PENDING_MANAGER_SETUP
   * - Only one manager allowed for this clinic admin
   * - Creates manager Account with CLINIC_MANAGER role and ACTIVE status
   * - Creates ClinicManagerInformation entity
   * - Links via parentId to the clinic admin account
   * - Transitions status to PENDING_LEGAL_SETUP
   *
   * @param req - Request object containing authenticated user
   * @param dto - Clinic manager registration data
   * @returns Created clinic manager account
   */
  @Post('clinic-manager/initial-setup')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create clinic manager for registration (Step 4A)',
    description:
      'Creates a clinic manager account for a clinic admin during registration flow. Transitions subscription status to PENDING_LEGAL_SETUP.',
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiResponseData({
    type: AccountResponseDto,
    status: MESSAGES.statusCode.created,
    message: 'Clinic manager created successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires CLINIC_ADMIN role or invalid status',
  })
  @ApiResponse({
    status: 409,
    description: 'Email already exists or manager already exists',
  })
  async createClinicManagerForRegistration(
    @Req() req: any,
    @Body() dto: CreateClinicManagerForRegistrationDto,
  ): Promise<{ data: AccountResponseDto; message: string }> {
    const adminId = req.user._id;
    const manager =
      await this.AccountsService.createClinicManagerForRegistration(
        adminId,
        dto,
      );
    return {
      data: manager,
      message:
        'Clinic manager created successfully. Please upload legal documents to continue.',
    };
  }
}
