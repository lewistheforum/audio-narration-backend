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
  CreateAccountBasicDto,
  CreateAccountProfileDto,
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
  // Register
  // @Post('register')
  // @HttpCode(HttpStatus.CREATED)
  // @ApiOperation({ summary: 'Register user with email and password' })
  // @ApiBody({ type: RegisterDto })
  // @ApiResponseData({
  //   type: LoginResponseDto,
  //   status: MESSAGES.statusCode.success,
  //   message: MESSAGES.successMessage.registerSuccess,
  // })
  // @ApiResponse({
  //   status: 409,
  //   description: 'Conflict. Email already exist',
  // })
  // @ApiResponse({ status: 400, description: 'Bad Request. Validation error.' })
  // async register(@Body() registerDto: RegisterDto) {
  //   const tokenData = await this.authService.register(registerDto);

  //   return {
  //     data: tokenData,
  //     message: MESSAGES.successMessage.registerSuccess,
  //   };
  // }

  // Verify Email
  // @Post('verify-email')
  // @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Verify your email with 6-codes' })
  // @ApiBody({ type: VerifyEmailDto })
  // @ApiResponseData({
  //   type: LoginResponseDto,
  //   status: MESSAGES.statusCode.success,
  //   message: 'Verify successfully!',
  // })
  // async verifyEmail(@Body() dto: VerifyEmailDto) {
  //   const tokenData = await this.authService.verifyEmail(dto);
  //   return {
  //     data: tokenData,
  //     message: 'Verify successfully!',
  //   };
  // }

  // Forget Password
  // @Post('forgot-password')
  // @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Send password reset code to email' })
  // @ApiBody({ type: ForgotPasswordDto })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Password reset code has been sent to email if exists.',
  // })
  // async forgotPassword(@Body() dto: ForgotPasswordDto) {
  //   return await this.authService.requestPasswordReset(dto);
  // }

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

  // @Post('set-new-password')
  // @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Set a new password after verifying the code' })
  // @ApiBody({ type: SetNewPasswordDto })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Password changed successfully.',
  // })
  // async setNewPassword(@Body() dto: SetNewPasswordDto) {
  //   return await this.authService.setNewPassword(dto);
  // }

  //Google OAuth
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
   * Step 1: Create Account Basic (New 2-Step Registration)
   * Creates basic account with INCOMPLETE status
   * Must be followed by Step 2 to complete registration
   * Role is automatically set to PATIENT
   *
   * @param createAccountBasicDto - Basic account data (username, email, password)
   * @returns Account ID and basic info for Step 2
   */
  @Post('register/account')
  @ApiOperation({ 
    summary: 'Step 1: Create basic account (PATIENT role)',
    description: 'Creates account with INCOMPLETE status. Must call Step 2 to complete registration.'
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiResponse({
    status: 201,
    description: 'Account created successfully. Proceed to Step 2 to add profile.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            accountId: { type: 'string', format: 'uuid' },
            email: { type: 'string' },
            username: { type: 'string' }
          }
        },
        message: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async registerAccountBasic(
    @Body() createAccountBasicDto: CreateAccountBasicDto,
  ): Promise<{ data: { accountId: string; email: string; username: string }; message: string }> {
    const result = await this.AccountsService.createAccountBasic(createAccountBasicDto);

    return {
      data: result,
      message: 'Account created successfully. Please complete your profile in Step 2.',
    };
  }

  /**
   * Step 2: Create Account Profile (Complete Registration)
   * Creates profile data and activates account to PENDING_VERIFICATION status
   * If this fails, the account from Step 1 is automatically deleted
   * User must manually request verification code via POST /mailer/send-verification-code
   *
   * @param accountId - Account UUID from Step 1
   * @param createAccountProfileDto - Profile data (fullName, gender)
   * @returns Complete account data with profile
   */
  @Post('register/profile/:accountId')
  @ApiOperation({ 
    summary: 'Step 2: Complete account profile',
    description: 'Adds profile data and changes status to PENDING_VERIFICATION. User must manually request verification code. If this fails, account is deleted.'
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiResponseData({
    type: AccountResponseDto,
    status: MESSAGES.statusCode.created,
    message: 'Profile created successfully. Please request verification code to activate your account.',
  })
  @ApiResponse({ status: 404, description: 'Account not found' })
  @ApiResponse({ status: 400, description: 'Account not in INCOMPLETE status or validation error' })
  async registerAccountProfile(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() createAccountProfileDto: CreateAccountProfileDto,
  ): Promise<{ data: AccountResponseDto; message: string }> {
    const account = await this.AccountsService.createAccountProfile(
      accountId,
      createAccountProfileDto,
    );

    return {
      data: account,
      message: 'Profile created successfully. Please request verification code via POST /mailer/send-verification-code to activate your account.',
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
      // resetPasswordDto.code,s
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.PATIENT)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Register clinic manager account (PATIENT only - requires clinic service purchase)',
    description: 'Allows PATIENT who purchased clinic service to create clinic manager account with full permissions'
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiResponseData({
    type: AccountResponseDto,
    status: MESSAGES.statusCode.created,
    message: 'Clinic manager account created successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Requires PATIENT role and clinic service purchase' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async registerClinicManager(
    @Req() req: any,
    @Body() createClinicManagerDto: CreateClinicManagerDto,
  ): Promise<{ data: AccountResponseDto; message: string }> {
    const patientId = req.user.id;
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
    summary: 'Add clinic staff (CLINIC_MANAGER only) - Creates INCOMPLETE account',
    description: 'Creates staff account with INCOMPLETE status. Staff must complete profile before login.'
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiResponseData({
    type: AccountResponseDto,
    status: MESSAGES.statusCode.created,
    message: 'Staff account created (INCOMPLETE). Staff must complete profile.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Requires CLINIC_MANAGER role' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async addStaffByManager(
    @Req() req: any,
    @Body() createStaffDto: CreateStaffByClinicManagerDto,
  ): Promise<{ data: AccountResponseDto; message: string }> {
    const managerId = req.user.id;
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
    description: 'Creates doctor account with INCOMPLETE status. Doctor must complete profile before login.'
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiResponseData({
    type: AccountResponseDto,
    status: MESSAGES.statusCode.created,
    message: 'Doctor account created (INCOMPLETE). Doctor must complete profile.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Requires CLINIC_MANAGER role' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async addDoctorByManager(
    @Req() req: any,
    @Body() createDoctorDto: CreateDoctorByClinicManagerDto,
  ): Promise<{ data: AccountResponseDto; message: string }> {
    const managerId = req.user.id;
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
