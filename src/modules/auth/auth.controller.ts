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
  
} from './dto';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiResponse, ApiBody, ApiTags, ApiBearerAuth, ApiExtraModels } from '@nestjs/swagger';
import { MESSAGES } from 'src/common/message';
import { ApiResponseData } from 'src/common/decorators/api-response.decorator';
import { ClientService } from '../client/client.service';
import { CreateClientDto, CreateClinicStaffDto, ClientResponseDto } from '../client/dto';
import { JwtAuthGuard } from './jwt.strategy';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../client/entities/accounts.entity';
import { MailerService } from '../mailer/mailer.service';

/**
 * Authentication Controller
 * Handles user authentication, registration, email verification, and OAuth operations
 * 
 * @tag Authentication
 */
@ApiTags('Authentication')
@Controller('auth')
@ApiExtraModels(ClientResponseDto, LoginResponseDto)
export class AuthController {
  constructor(
    private authService: AuthService,
    private clientService: ClientService,
    private mailerService: MailerService,
  ) { }

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
  async login(@Body() loginDto: LoginDto): Promise<{ data: any; message: string }> {
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

  // @Post('verify-reset-code')
  // @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Password reset code authentication' })
  // @ApiBody({ type: VerifyResetPasswordDto })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Password reset code authentication successful.',
  // })
  // async verifyResetCode(@Body() dto: VerifyResetPasswordDto) {
  //   return await this.authService.verifyResetPasswordCode(dto);
  // }

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
  async googleAuth(): Promise<void> { }

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
  async googleAuthRedirect(@Req() req: any): Promise<{ statusCode: number; message: string; data: any }> {
    const tokenData = await this.authService.googleLogin(req.user);
    return {
      statusCode: MESSAGES.statusCode.success,
      message: MESSAGES.successMessage.googleLoginSuccess,
      data: tokenData,
    };
  }

  /**
   * Patient Registration (Public Endpoint)
   * Creates a new patient account with standard authentication
   * Generates verification code but does NOT auto-send email
   * Use /auth/send-verification-code to send the verification email
   * 
   * @param createUserDto - Patient registration data
   * @returns Created patient user object
   */
  @Post('register')
  @ApiOperation({ summary: 'Register new patient account (Public)' })
  @HttpCode(HttpStatus.CREATED)
  @ApiResponseData({
    type: ClientResponseDto,
    status: MESSAGES.statusCode.created,
    message: 'Account created successfully. Use /auth/send-verification-code to receive verification email.',
  })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @ApiResponse({ status: 400, description: 'Validation error - Check password requirements' })
  async register(@Body() createClientDto: CreateClientDto): Promise<{ data: ClientResponseDto; message: string }> {
    const { user } = await this.clientService.createPatient(createClientDto);

    return {
      data: user,
      message: MESSAGES.successMessage.accountCreatedSuccess
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
  @ApiResponse({ status: 401, description: 'Invalid or expired verification code' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Email already verified' })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto): Promise<{ message: string }> {
    const user = await this.clientService.verifyEmailCode(
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
      message: MESSAGES.successMessage.emailVerifiedSuccess
    };
  }

  /**
   * Send Verification Code
   * Generates a new verification code and sends it to user's email
   * Can be used for initial verification or resending code
   * 
   * @param resendVerificationDto - User email
   * @returns Success message
   */
  @Post('send-verification-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send verification code to email' })
  @ApiBody({ type: ResendVerificationDto })
  @ApiResponse({ status: 200, description: 'Verification code sent successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Email already verified' })
  async sendVerificationCode(@Body() resendVerificationDto: ResendVerificationDto): Promise<{ message: string }> {
    const { code, user } = await this.clientService.resendVerificationCode(
      resendVerificationDto.email,
    );

    // Send verification email
    await this.mailerService.sendVerificationCode(
      user.email,
      code,
      user.firstName,
    );

    return {
      message: MESSAGES.successMessage.verificationCodeSentSuccess
    };
  }

  /**
   * Forgot Password - Request Reset Code
   * Initiates password reset process by sending reset code to user's email
   * Public endpoint - no authentication required
   * 
   * @param forgotPasswordDto - User email
   * @returns Success message
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset code' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({ status: 200, description: 'Reset code sent to email' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 400, description: 'OAuth users cannot reset password' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string }> {
    const { code, user } = await this.clientService.initiatePasswordReset(
      forgotPasswordDto.email,
    );

    // Send password reset email
    await this.mailerService.sendPasswordResetCode(
      user.email,
      code,
      user.firstName,
    );

    return {
      message: MESSAGES.successMessage.passwordResetCodeSentSuccess
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
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    await this.clientService.resetPasswordWithCode(
      resetPasswordDto.email,
      resetPasswordDto.code,
      resetPasswordDto.newPassword,
    );

    return {
      message: MESSAGES.successMessage.passwordResetSuccess
    };
  }

  /**
   * Clinic Staff Registration (Protected Endpoint)
   * Creates a clinic staff account linked to an existing patient account
   * Requires authentication and PATIENT or ADMIN role
   * 
   * @param patientId - UUID of the patient who owns this clinic staff account
   * @param createClinicStaffDto - Clinic staff registration data
   * @returns Created clinic staff user object
   */
  @Post('register-clinic-staff/:patientId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PATIENT, UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Register clinic staff account linked to patient' })
  @HttpCode(HttpStatus.CREATED)
  @ApiResponseData({
    type: ClientResponseDto,
    status: MESSAGES.statusCode.created,
    message: 'Clinic staff account created successfully',
  })
  @ApiResponse({ status: 409, description: 'Email already exists or invalid patient' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Requires PATIENT or ADMIN role' })
  async registerClinicStaff(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() createClinicStaffDto: CreateClinicStaffDto,
  ): Promise<{ data: ClientResponseDto; message: string }> {
    const staff = await this.clientService.createClinicStaff(patientId, createClinicStaffDto);
    return { data: staff, message: MESSAGES.successMessage.clinicStaffCreatedSuccess };
  }
}
