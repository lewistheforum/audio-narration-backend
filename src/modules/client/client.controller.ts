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
import { ClientService } from './client.service';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  UpdateClientDto,
  ClientResponseDto,
  UpdatePasswordDto,
  BanClientDto,
} from './dto';
import { MESSAGES } from 'src/common/message';
import { ApiResponseData } from 'src/common/decorators/api-response.decorator';
import { UserRole } from 'src/enums/client/enum';
import { UsernameEmailListDto } from './dto/username-email-list.dto';

/**
 * Client Management Controller
 *
 * Handles CRUD operations for client accounts
 * All endpoints require authentication and role-based authorization
 *
 * Note: Client registration endpoints are in AuthController
 */
@ApiTags('Client management')
@Controller('users')
@ApiExtraModels(ClientResponseDto)
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  /**
   * Get All Clients (Admin Only)
   *
   * Retrieves a list of all registered clients in the system
   * Optional query parameter to include soft-deleted clients
   *
   * @param includeDeleted - Whether to include soft-deleted clients
   * @returns Array of client objects with sensitive data excluded
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
    description: 'Include soft-deleted users in results',
  })
  @ApiResponseData({
    type: ClientResponseDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.userFetchSuccess,
    isArray: true,
  })
  async findAll(
    @Query('includeDeleted') includeDeleted?: string,
  ): Promise<{ data: ClientResponseDto[]; message: string }> {
    const shouldIncludeDeleted = includeDeleted === 'true';
    const clients = await this.clientService.findAll(shouldIncludeDeleted);
    return { data: clients, message: MESSAGES.successMessage.userFetchSuccess };
  }

  /**
   * Get username and email list
   *
   * @returns List of username and email
   */
  @Get('username-email-list')
  @ApiOperation({ summary: 'Get full list of usernames and emails' })
  @ApiResponseData({
    type: UsernameEmailListDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.userFetchSuccess,
  })
  async getUsernameEmailList() {
    const data = await this.clientService.getUserEmailList();
    return {
      message: 'Successfully get the list of usernames and emails',
      data,
    };
  }

  /**
   * Get Client by ID
   *
   * Retrieves detailed information for a specific client
   * All authenticated clients can access this endpoint
   *
   * @param id - Client UUID
   * @returns Client object with sensitive data excluded
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.DOCTOR,
    UserRole.CLINIC_STAFF,
    UserRole.PATIENT,
  )
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponseData({
    type: ClientResponseDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.userFetchSuccess,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ data: ClientResponseDto; message: string }> {
    const client = await this.clientService.findOne(id);
    return { data: client, message: MESSAGES.successMessage.userFetchSuccess };
  }

  /**
   * Update Client Profile
   *
   * Updates client information (name, email, etc.)
   * If email is changed, sets isEmailVerified to false and generates new code
   * Use /auth/send-verification-code to send verification email
   * Clients can update their own profile, admins can update any profile
   *
   * @param id - Client UUID
   * @param updateClientDto - Updated client data
   * @returns Updated client object
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.PATIENT,
    UserRole.CLINIC_STAFF,
    UserRole.DOCTOR,
  )
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update user profile' })
  @HttpCode(HttpStatus.OK)
  @ApiResponseData({
    type: ClientResponseDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.userUpdateSuccess,
  })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateClientDto: UpdateClientDto,
  ): Promise<{ data: ClientResponseDto; message: string }> {
    const { user, emailChanged } = await this.clientService.update(
      id,
      updateClientDto,
    );

    // If email changed, inform client to verify
    if (emailChanged) {
      return {
        data: user,
        message: MESSAGES.successMessage.profileUpdatedWithEmailChange,
      };
    }

    return { data: user, message: MESSAGES.successMessage.userUpdateSuccess };
  }

  /**
   * Update Client Password
   *
   * Changes client password after verifying old password
   * Clients can only update their own password
   *
   * @param id - Client UUID
   * @param updatePasswordDto - Old and new password
   */
  @Patch(':id/password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.PATIENT,
    UserRole.CLINIC_STAFF,
    UserRole.DOCTOR,
  )
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update user password' })
  @ApiResponse({ status: 204, description: 'Password updated successfully' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Incorrect old password or missing token',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error - Check password requirements',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async updatePassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePasswordDto: UpdatePasswordDto,
  ): Promise<void> {
    await this.clientService.updatePassword(id, updatePasswordDto);
  }

  /**
   * Delete Client (Admin Only)
   *
   * Soft deletes a client account from the system
   * Client data is retained for audit trails and can be restored
   * Only administrators can perform this action
   *
   * @param id - Client UUID to delete
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
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Requires ADMIN role' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    await this.clientService.delete(id);
    return { message: MESSAGES.successMessage.userDeleteSuccess };
  }

  /**
   * Restore Soft-Deleted Client (Admin Only)
   *
   * Restores a previously soft-deleted client account
   * Only administrators can perform this action
   *
   * @param id - Client UUID to restore
   * @returns Restored client object
   */
  @Post(':id/restore')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Restore soft-deleted user (Admin only)' })
  @ApiResponseData({
    type: ClientResponseDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.userRestoredSuccess,
  })
  @ApiResponse({ status: 400, description: 'User is not deleted' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ data: ClientResponseDto; message: string }> {
    const client = await this.clientService.restore(id);
    return {
      data: client,
      message: MESSAGES.successMessage.userRestoredSuccess,
    };
  }

  /**
   * Ban Client Account (Admin Only)
   *
   * Bans a client account, preventing login and access
   * Stores ban reason and timestamp
   * Cannot ban admin users or self
   *
   * @param id - Client UUID to ban
   * @param banDto - Ban reason
   * @param req - Request object containing admin user info
   * @returns Banned client object
   */
  @Post(':id/ban')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Ban user account (Admin only)' })
  @ApiResponseData({
    type: ClientResponseDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.userBannedSuccess,
  })
  @ApiResponse({ status: 403, description: 'Cannot ban admin users or self' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'User already banned' })
  async banUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() banDto: BanClientDto,
    @Request() req: any,
  ): Promise<{ data: ClientResponseDto; message: string }> {
    const adminId = req.user.userId;
    const client = await this.clientService.banUser(id, banDto, adminId);
    return { data: client, message: MESSAGES.successMessage.userBannedSuccess };
  }

  /**
   * Unban Client Account (Admin Only)
   *
   * Removes ban from client account, allowing access again
   * Sets client status back to ACTIVE
   *
   * @param id - Client UUID to unban
   * @returns Unbanned client object
   */
  @Post(':id/unban')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Unban user account (Admin only)' })
  @ApiResponseData({
    type: ClientResponseDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.userUnbannedSuccess,
  })
  @ApiResponse({ status: 400, description: 'User is not banned' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async unbanUser(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ data: ClientResponseDto; message: string }> {
    const client = await this.clientService.unbanUser(id);
    return {
      data: client,
      message: MESSAGES.successMessage.userUnbannedSuccess,
    };
  }
}
