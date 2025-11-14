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
import { LoginDto, LoginResponseDto } from './dto';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiResponse, ApiBody, ApiTags, ApiBearerAuth, ApiExtraModels } from '@nestjs/swagger';
import { MESSAGES } from 'src/common/message';
import { ApiResponseData } from 'src/common/decorators/api-response.decorator';
import { UserService } from '../user/user.service';
import { CreateUserDto, CreateClinicStaffDto, UserResponseDto } from '../user/dto';
import { JwtAuthGuard } from './jwt.strategy';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../user/entities/user.entity';

/**
 * Authentication Controller
 * Handles user authentication, registration, and OAuth operations
 * 
 * @tag Authentication
 */
@ApiTags('Authentication')
@Controller('auth')
@ApiExtraModels(UserResponseDto, LoginResponseDto)
export class AuthController {
  constructor(
    private authService: AuthService,
    private userService: UserService,
  ) {}

  /**
   * User Login
   * Authenticates user with email and password
   * 
   * @param loginDto - User credentials (email & password)
   * @returns JWT access token and user information
   */
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
  async login(@Body() loginDto: LoginDto) {
    const tokenData = await this.authService.login(loginDto);
    return { data: tokenData, message: MESSAGES.successMessage.loginSuccess };
  }

  /**
   * Google OAuth Login Initiation
   * Redirects user to Google consent screen
   */
  @Get('google')
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  @ApiResponse({ status: 302, description: 'Redirects to Google login page' })
  @UseGuards(AuthGuard('google'))
  async googleAuth() {}

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
  async googleAuthRedirect(@Req() req) {
    const tokenData = await this.authService.googleLogin(req.user);
    return {
      statusCode: 200,
      message: 'Google login successful',
      data: tokenData,
    };
  }

  /**
   * Patient Registration (Public Endpoint)
   * Creates a new patient account with standard authentication
   * 
   * @param createUserDto - Patient registration data
   * @returns Created patient user object
   */
  @Post('register')
  @ApiOperation({ summary: 'Register new patient account (Public)' })
  @HttpCode(HttpStatus.CREATED)
  @ApiResponseData({
    type: UserResponseDto,
    status: MESSAGES.statusCode.created,
    message: MESSAGES.successMessage.userCreateSuccess,
  })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @ApiResponse({ status: 400, description: 'Validation error - Check password requirements' })
  async register(@Body() createUserDto: CreateUserDto) {
    const user = await this.userService.createPatient(createUserDto);
    return { data: user, message: MESSAGES.successMessage.userCreateSuccess };
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
    type: UserResponseDto,
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
  ) {
    const staff = await this.userService.createClinicStaff(patientId, createClinicStaffDto);
    return { data: staff, message: 'Clinic staff account created successfully' };
  }
}
