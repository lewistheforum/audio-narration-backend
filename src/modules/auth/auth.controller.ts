import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  LoginDto,
  LoginResponseDto,
  VerifyEmailDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ResendVerificationDto,
  VerifyResetPasswordDto,
} from './dto';
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
  CreateClinicManagerDto,
  CreateStaffByClinicManagerDto,
  CreateDoctorByClinicManagerDto,
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
@ApiExtraModels(AccountResponseDto, LoginResponseDto)
export class AuthController {
  constructor(
    private authService: AuthService,
    private AccountsService: AccountsService,
    private mailerService: MailerService,
  ) {}

  /**
   * User Login
   * Authenticates user with email and password
   *
   * @param loginDto - User credentials (email & password)
   * @returns JWT access token and user information
   */
  // Login
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponseData({
    type: LoginResponseDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.loginSuccess,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async login(
    @Body() loginDto: LoginDto,
  ): Promise<{ data: any; message: string }> {
    const tokenData = await this.authService.login(loginDto);
    return { data: tokenData, message: MESSAGES.successMessage.loginSuccess };
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
  async googleAuthRedirect(
    @Req() req: any,
  ): Promise<{ statusCode: number; message: string; data: any }> {
    const tokenData = await this.authService.googleLogin(req.user);
    return {
      statusCode: MESSAGES.statusCode.success,
      message: MESSAGES.successMessage.googleLoginSuccess,
      data: tokenData,
    };
  }

  /**
   * Register Account (Single-Step Registration)
   * Creates complete account with profile in one transaction
   * Frontend can handle multi-step UI while backend processes everything in one call
   *
   * @param createAccountDto - Complete account data (credentials + profile)
   * @returns Complete account with PENDING_VERIFICATION status
   */
  @Post('register')
  @ApiOperation({
    summary: 'Register new account (PATIENT role)',
    description:
      'Single-step registration. Creates account and profile in one transaction. Account status will be PENDING_VERIFICATION.',
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
   * Resets user password using the code sent to their email
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
      resetPasswordDto.code,
      resetPasswordDto.newPassword,
    );

    return {
      message: MESSAGES.successMessage.passwordResetSuccess,
    };
  }

  /**
   * Clinic Manager Registration (Protected Endpoint - PATIENT Only)
   * Allows PATIENT accounts who purchased clinic service to upgrade to CLINIC_MANAGER
   * Manager can add staff, doctors, and manage clinic documents
   *
   * Business Rule:
   * - Only PATIENT role can create clinic manager account
   * - PATIENT must have purchased clinic service (TODO: validate subscription/payment)
   * - This upgrades the PATIENT account to CLINIC_MANAGER role
   *
   * @param req - Request object containing authenticated patient user
   * @param createClinicManagerDto - Clinic manager registration data
   * @returns Created clinic manager account
   */
  @Post('register-clinic-manager')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.PATIENT)
  // @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Register clinic manager account (PATIENT only - requires clinic service purchase)',
    description:
      'Allows PATIENT who purchased clinic service to create clinic manager account with full permissions',
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiResponseData({
    type: AccountResponseDto,
    status: MESSAGES.statusCode.created,
    message: 'Clinic manager account created successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - Requires PATIENT role and clinic service purchase',
  })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async registerClinicManager(
    @Req() req: any,
    @Body() createClinicManagerDto: CreateClinicManagerDto,
  ): Promise<{ data: AccountResponseDto; message: string }> {
    const patientId = req.user._id;
    const manager = await this.AccountsService.createClinicManager(
      patientId,
      createClinicManagerDto,
    );
    return {
      data: manager,
      message: 'Clinic manager account created successfully',
    };
  }

  /**
   * Add Clinic Staff by Manager (Protected Endpoint)
   * Allows clinic managers to add staff accounts to their clinic
   * Requires authentication and CLINIC_MANAGER role
   *
   * 2-Step Registration Pattern:
   * - Creates account with INCOMPLETE status
   * - Staff must complete profile themselves via separate endpoint
   * - Account cannot login until profile is completed
   *
   * @param req - Request object containing authenticated user
   * @param createStaffDto - Staff registration data
   * @returns Created staff account (INCOMPLETE status)
   */
  @Post('clinic-manager/add-staff')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_MANAGER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Add clinic staff (CLINIC_MANAGER only) - Creates INCOMPLETE account',
    description:
      'Creates staff account with INCOMPLETE status. Staff must complete profile before login.',
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiResponseData({
    type: AccountResponseDto,
    status: MESSAGES.statusCode.created,
    message: 'Staff account created (INCOMPLETE). Staff must complete profile.',
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
   * - Creates account with INCOMPLETE status
   * - Doctor must complete profile themselves via separate endpoint
   * - Account cannot login until profile is completed
   *
   * @param req - Request object containing authenticated user
   * @param createDoctorDto - Doctor registration data
   * @returns Created doctor account (INCOMPLETE status)
   */
  @Post('clinic-manager/add-doctor')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_MANAGER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Add doctor (CLINIC_MANAGER only) - Creates INCOMPLETE account',
    description:
      'Creates doctor account with INCOMPLETE status. Doctor must complete profile before login.',
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiResponseData({
    type: AccountResponseDto,
    status: MESSAGES.statusCode.created,
    message:
      'Doctor account created (INCOMPLETE). Doctor must complete profile.',
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
}
