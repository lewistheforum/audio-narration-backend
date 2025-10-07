import { Controller, Post, Body, Get, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, LoginResponseDto } from './dto';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login users with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 201,
    description: 'Successfully logged in. Return to JWT Access token.',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized. Wrong email or password.' })
  @ApiResponse({ status: 400, description: 'Bad Request. Validation error.' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('google')
  @ApiOperation({ summary: 'Login with Google (redirect)' })
  @ApiResponse({
    status: 302,
    description: 'Shift user to Google login page.',
  })
  @UseGuards(AuthGuard('google'))
  async googleAuth() {}

  @Get('/google/callback')
  @ApiOperation({
    summary: 'Callback URL after the user is authenticated with Google',
  })
  @ApiResponse({
    status: 200,
    description: 'Sign in to Google successfully. Returns the application JWT access token.',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Can not be authenticated with Google.',
  })
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req) {
    return this.authService.googleLogin(req.user);
  }
}
