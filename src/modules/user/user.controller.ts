import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Patch,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiExtraModels,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from './entities/user.entity';
import {
  CreateUserDto,
  CreateClinicStaffDto,
  UpdateUserDto,
  UserResponseDto,
  UpdatePasswordDto,
  BanUserDto,
} from './dto';
import { MESSAGES } from 'src/common/message';
import { ApiResponseData } from 'src/common/decorators/api-response.decorator';

/**
 * User Management Controller
 * 
 * Handles CRUD operations for user accounts
 * All endpoints require authentication and role-based authorization
 * 
 * Note: User registration endpoints are in AuthController
 */
@ApiTags('Users management')
@Controller('users')
@ApiExtraModels(UserResponseDto)
export class UserController {
  constructor(
    private readonly userService: UserService,
  ) {}

  /**
   * Get All Users (Admin Only)
   * 
   * Retrieves a list of all registered users in the system
   * Optional query parameter to include soft-deleted users
   * 
   * @param includeDeleted - Whether to include soft-deleted users
   * @returns Array of user objects with sensitive data excluded
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @ApiQuery({ 
    name: 'includeDeleted', 
    required: false, 
    type: Boolean,
    description: 'Include soft-deleted users in results'
  })
  @ApiResponseData({
    type: UserResponseDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.userFetchSuccess,
    isArray: true,
  })
  async findAll(@Query('includeDeleted') includeDeleted?: string): Promise<{ data: UserResponseDto[]; message: string }> {
    const shouldIncludeDeleted = includeDeleted === 'true';
    const users = await this.userService.findAll(shouldIncludeDeleted);
    return { data: users, message: MESSAGES.successMessage.userFetchSuccess };
  }

  /**
   * Get User by ID
   * 
   * Retrieves detailed information for a specific user
   * All authenticated users can access this endpoint
   * 
   * @param id - User UUID
   * @returns User object with sensitive data excluded
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.CLINIC_STAFF, UserRole.PATIENT)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponseData({
    type: UserResponseDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.userFetchSuccess,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<{ data: UserResponseDto; message: string }> {
    const user = await this.userService.findOne(id);
    return { data: user, message: MESSAGES.successMessage.userFetchSuccess };
  }

  /**
   * Update User Profile
   * 
   * Updates user information (name, email, etc.)
   * If email is changed, sets isEmailVerified to false and generates new code
   * Use /auth/send-verification-code to send verification email
   * Users can update their own profile, admins can update any profile
   * 
   * @param id - User UUID
   * @param updateUserDto - Updated user data
   * @returns Updated user object
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.PATIENT, UserRole.CLINIC_STAFF, UserRole.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update user profile' })
  @HttpCode(HttpStatus.OK)
  @ApiResponseData({
    type: UserResponseDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.userUpdateSuccess,
  })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<{ data: UserResponseDto; message: string }> {
    const { user, emailChanged } = await this.userService.update(id, updateUserDto);
    
    // If email changed, inform user to verify
    if (emailChanged) {
      return { 
        data: user, 
        message: MESSAGES.successMessage.profileUpdatedWithEmailChange 
      };
    }
    
    return { data: user, message: MESSAGES.successMessage.userUpdateSuccess };
  }

  /**
   * Update User Password
   * 
   * Changes user password after verifying old password
   * Users can only update their own password
   * 
   * @param id - User UUID
   * @param updatePasswordDto - Old and new password
   */
  @Patch(':id/password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.PATIENT, UserRole.CLINIC_STAFF, UserRole.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update user password' })
  @ApiResponse({ status: 204, description: 'Password updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Incorrect old password or missing token' })
  @ApiResponse({ status: 400, description: 'Validation error - Check password requirements' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async updatePassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePasswordDto: UpdatePasswordDto,
  ): Promise<void> {
    await this.userService.updatePassword(id, updatePasswordDto);
  }

  /**
   * Delete User (Admin Only)
   * 
   * Soft deletes a user account from the system
   * User data is retained for audit trails and can be restored
   * Only administrators can perform this action
   * 
   * @param id - User UUID to delete
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Soft delete user (Admin only)' })
  @ApiResponse({
    status: MESSAGES.statusCode.success,
    description: MESSAGES.successMessage.userDeleteSuccess,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Requires ADMIN role' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    await this.userService.delete(id);
    return { message: MESSAGES.successMessage.userDeleteSuccess };
  }

  /**
   * Restore Soft-Deleted User (Admin Only)
   * 
   * Restores a previously soft-deleted user account
   * Only administrators can perform this action
   * 
   * @param id - User UUID to restore
   * @returns Restored user object
   */
  @Post(':id/restore')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Restore soft-deleted user (Admin only)' })
  @ApiResponseData({
    type: UserResponseDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.userRestoredSuccess,
  })
  @ApiResponse({ status: 400, description: 'User is not deleted' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async restore(@Param('id', ParseUUIDPipe) id: string): Promise<{ data: UserResponseDto; message: string }> {
    const user = await this.userService.restore(id);
    return { data: user, message: MESSAGES.successMessage.userRestoredSuccess };
  }

  /**
   * Ban User Account (Admin Only)
   * 
   * Bans a user account, preventing login and access
   * Stores ban reason and timestamp
   * Cannot ban admin users or self
   * 
   * @param id - User UUID to ban
   * @param banDto - Ban reason
   * @param req - Request object containing admin user info
   * @returns Banned user object
   */
  @Post(':id/ban')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Ban user account (Admin only)' })
  @ApiResponseData({
    type: UserResponseDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.userBannedSuccess,
  })
  @ApiResponse({ status: 403, description: 'Cannot ban admin users or self' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'User already banned' })
  async banUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() banDto: BanUserDto,
    @Request() req: any,
  ): Promise<{ data: UserResponseDto; message: string }> {
    const adminId = req.user.userId;
    const user = await this.userService.banUser(id, banDto, adminId);
    return { data: user, message: MESSAGES.successMessage.userBannedSuccess };
  }

  /**
   * Unban User Account (Admin Only)
   * 
   * Removes ban from user account, allowing access again
   * Sets user status back to ACTIVE
   * 
   * @param id - User UUID to unban
   * @returns Unbanned user object
   */
  @Post(':id/unban')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Unban user account (Admin only)' })
  @ApiResponseData({
    type: UserResponseDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.userUnbannedSuccess,
  })
  @ApiResponse({ status: 400, description: 'User is not banned' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async unbanUser(@Param('id', ParseUUIDPipe) id: string): Promise<{ data: UserResponseDto; message: string }> {
    const user = await this.userService.unbanUser(id);
    return { data: user, message: MESSAGES.successMessage.userUnbannedSuccess };
  }
}
