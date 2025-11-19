import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiExtraModels,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../user/entities/user.entity';
import {
  CreateProfileDto,
  UpdateProfileDto,
  ProfileResponseDto,
} from './dto';
import { MESSAGES } from 'src/common/message';
import { ApiResponseData } from 'src/common/decorators/api-response.decorator';

/**
 * Profile Management Controller
 * 
 * Handles CRUD operations for user profiles
 * All endpoints require authentication
 * 
 * Features:
 * - Get user profile
 * - Create profile (typically automatic on registration)
 * - Update profile
 * - Get profile completion percentage
 * - Delete profile (admin only)
 */
@ApiTags('Profile Management')
@Controller('profile')
@ApiExtraModels(ProfileResponseDto)
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  /**
   * Get My Profile
   * 
   * Retrieves the authenticated user's profile
   * 
   * @param req - Request object containing authenticated user
   * @returns User's profile data
   */
  @Get('me')
  @ApiOperation({ summary: 'Get my profile' })
  @ApiResponseData({
    type: ProfileResponseDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.profileFetchSuccess,
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
  async getMyProfile(@Request() req: any): Promise<{ data: ProfileResponseDto; message: string }> {
    const userId = req.user.userId;
    const profile = await this.profileService.findByUserId(userId);
    return { data: profile, message: MESSAGES.successMessage.profileFetchSuccess };
  }

  /**
   * Get Profile by User ID
   * 
   * Retrieves profile for a specific user
   * All authenticated users can view profiles
   * 
   * @param userId - User UUID
   * @returns User's profile data
   */
  @Get('user/:userId')
  @ApiOperation({ summary: 'Get user profile by ID' })
  @ApiResponseData({
    type: ProfileResponseDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.profileFetchSuccess,
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
  async getProfileByUserId(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<{ data: ProfileResponseDto; message: string }> {
    const profile = await this.profileService.findByUserId(userId);
    return { data: profile, message: MESSAGES.successMessage.profileFetchSuccess };
  }

  /**
   * Create Profile
   * 
   * Creates a new profile for the authenticated user
   * Typically called automatically during registration
   * 
   * @param createProfileDto - Profile data
   * @param req - Request object containing authenticated user
   * @returns Created profile data
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create my profile' })
  @ApiResponseData({
    type: ProfileResponseDto,
    status: MESSAGES.statusCode.created,
    message: MESSAGES.successMessage.profileCreateSuccess,
  })
  @ApiResponse({ status: 409, description: 'Profile already exists' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
  async createProfile(
    @Body() createProfileDto: CreateProfileDto,
    @Request() req: any,
  ): Promise<{ data: ProfileResponseDto; message: string }> {
    const userId = req.user.userId;
    const profile = await this.profileService.create(userId, createProfileDto);
    return { data: profile, message: MESSAGES.successMessage.profileCreateSuccess };
  }

  /**
   * Update My Profile
   * 
   * Updates the authenticated user's profile
   * 
   * @param updateProfileDto - Updated profile data
   * @param req - Request object containing authenticated user
   * @returns Updated profile data
   */
  @Put('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update my profile' })
  @ApiResponseData({
    type: ProfileResponseDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.profileUpdateSuccess,
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
  async updateMyProfile(
    @Body() updateProfileDto: UpdateProfileDto,
    @Request() req: any,
  ): Promise<{ data: ProfileResponseDto; message: string }> {
    const userId = req.user.userId;
    const profile = await this.profileService.update(
      userId,
      updateProfileDto,
      userId,
      req.user.role,
    );
    return { data: profile, message: MESSAGES.successMessage.profileUpdateSuccess };
  }

  /**
   * Update User Profile (Admin)
   * 
   * Allows admin to update any user's profile
   * 
   * @param userId - User UUID
   * @param updateProfileDto - Updated profile data
   * @param req - Request object containing authenticated admin
   * @returns Updated profile data
   */
  @Put('user/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user profile (Admin only)' })
  @ApiResponseData({
    type: ProfileResponseDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.profileUpdateSuccess,
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Requires ADMIN role' })
  async updateUserProfile(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() updateProfileDto: UpdateProfileDto,
    @Request() req: any,
  ): Promise<{ data: ProfileResponseDto; message: string }> {
    const profile = await this.profileService.update(
      userId,
      updateProfileDto,
      req.user.userId,
      req.user.role,
    );
    return { data: profile, message: MESSAGES.successMessage.profileUpdateSuccess };
  }

  /**
   * Delete Profile (Admin Only)
   * 
   * Deletes a user's profile
   * Typically cascades automatically when user is deleted
   * 
   * @param userId - User UUID
   * @returns Success message
   */
  @Delete('user/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete user profile (Admin only)' })
  @ApiResponse({
    status: MESSAGES.statusCode.success,
    description: MESSAGES.successMessage.profileDeleteSuccess,
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Requires ADMIN role' })
  async deleteProfile(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<{ message: string }> {
    await this.profileService.delete(userId);
    return { message: MESSAGES.successMessage.profileDeleteSuccess };
  }
}
