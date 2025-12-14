import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  LoginDto,
  LoginResponseDto,
  RegisterDto,
  VerifyEmailDto,
  ForgotPasswordDto,
  VerifyResetPasswordDto,
  SetNewPasswordDto,
} from './dto';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiResponse, ApiBody, ApiTags } from '@nestjs/swagger';
import { MESSAGES } from 'src/common/message';
import { ApiResponseData } from 'src/common/decorators/api-response.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // Login
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login users with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponseData({
    type: LoginResponseDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.loginSuccess,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Wrong email or password.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request. Validation error.' })
  async login(@Body() loginDto: LoginDto) {
    const tokenData = await this.authService.login(loginDto);

    return { data: tokenData, message: MESSAGES.successMessage.loginSuccess };
  }

  // Register
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register user with email and password' })
  @ApiBody({ type: RegisterDto })
  @ApiResponseData({
    type: LoginResponseDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.registerSuccess,
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict. Email already exist',
  })
  @ApiResponse({ status: 400, description: 'Bad Request. Validation error.' })
  async register(@Body() registerDto: RegisterDto) {
    const tokenData = await this.authService.register(registerDto);

    return {
      data: tokenData,
      message: MESSAGES.successMessage.registerSuccess,
    };
  }

  // Verify Email
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify your email with 6-codes' })
  @ApiBody({ type: VerifyEmailDto })
  @ApiResponseData({
    type: LoginResponseDto,
    status: MESSAGES.statusCode.success,
    message: 'Verify successfully!',
  })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    const tokenData = await this.authService.verifyEmail(dto);
    return {
      data: tokenData,
      message: 'Verify successfully!',
    };
  }

  // Forget Password
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send password reset code to email' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password reset code has been sent to email if exists.',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return await this.authService.requestPasswordReset(dto);
  }

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

  @Post('set-new-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a new password after verifying the code' })
  @ApiBody({ type: SetNewPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully.',
  })
  async setNewPassword(@Body() dto: SetNewPasswordDto) {
    return await this.authService.setNewPassword(dto);
  }

  //Google OAuth
  @Get('google')
  @ApiOperation({ summary: 'Login with Google (redirect)' })
  @ApiResponse({ status: 302, description: 'Shift user to Google login page.' })
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    console.log('googleAuth');
  }

  @Get('google/callback')
  @ApiOperation({ summary: 'Callback URL after Google authentication' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Cannot be authenticated with Google.',
  })
  @ApiResponse({
    status: 302,
    description:
      'Redirects to the client application with Google authentication result.',
  })
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req, @Res() res) {
    console.log('googleAuthRedirect');
    const redirectUrl = await this.authService.googleLogin(req.user);
    return res.redirect(redirectUrl);
  }
}
