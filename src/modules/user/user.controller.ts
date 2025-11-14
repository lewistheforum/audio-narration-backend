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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiExtraModels,
  ApiBearerAuth,
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
  constructor(private readonly userService: UserService) {}

  /**
   * Get All Users (Admin Only)
   * 
   * Retrieves a list of all registered users in the system
   * 
   * @returns Array of user objects with sensitive data excluded
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @ApiResponseData({
    type: UserResponseDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.userFetchSuccess,
    isArray: true,
  })
  async findAll() {
    const users = await this.userService.findAll();
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
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.userService.findOne(id);
    return { data: user, message: MESSAGES.successMessage.userFetchSuccess };
  }

  /**
   * Update User Profile
   * 
   * Updates user information (name, email, etc.)
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
  ) {
    const user = await this.userService.update(id, updateUserDto);
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
  ) {
    await this.userService.updatePassword(id, updatePasswordDto);
  }

  /**
   * Delete User (Admin Only)
   * 
   * Permanently deletes a user account from the system
   * Only administrators can perform this action
   * 
   * @param id - User UUID to delete
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete user (Admin only)' })
  @ApiResponse({
    status: MESSAGES.statusCode.success,
    description: MESSAGES.successMessage.userDeleteSuccess,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Requires ADMIN role' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.userService.delete(id);
    return { message: MESSAGES.successMessage.userDeleteSuccess };
  }
}
