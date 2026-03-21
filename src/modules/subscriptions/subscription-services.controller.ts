import {
  Controller,
  Get,
  Patch,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  Body,
  Post,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiExtraModels,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { SubscriptionServicesService } from './subscription-services.service';
import {
  SubscriptionServiceResponseDto,
  CreateSubscriptionServiceDto,
  UpdateSubscriptionServiceDto,
  ClinicUsageStatisticsDto,
  SubscriptionResponseDto,
  SubscriptionHistoryResponseDto,
  CreateSubscriptionRequestDto,
} from './dto';
import { AllowExpiredSubscription } from 'src/common/decorators/allow-expired-subscription.decorator';
import { ApiResponseData } from 'src/common/decorators/api-response.decorator';
import { MESSAGES } from 'src/common/message';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { User } from '../../common/decorators/user.decorator';
import { AccountRole } from '../accounts/enums/account-role.enum';
import { Account } from '../accounts/entities/accounts.entity';

/**
 * Subscription Services Controller
 *
 * RESTful API controller for managing subscription services in the Bonix system.
 * Provides subscription service listing and detail retrieval functionality for the Pricing screen.
 *
 * Features:
 * - Subscription service list retrieval (all services, no pagination)
 * - Subscription service detail retrieval by ID
 * - Excludes soft-deleted records
 * - No search or filters
 *
 * Access Control:
 * - All endpoints are public (no authentication required)
 *
 * @controller
 * @tags Subscription Services
 */
@ApiTags('Subscription Services')
@ApiExtraModels(
  SubscriptionServiceResponseDto,
  SubscriptionResponseDto,
  SubscriptionHistoryResponseDto,
)
@Controller('subscription')
export class SubscriptionServicesController {
  constructor(
    private readonly subscriptionServicesService: SubscriptionServicesService,
  ) { }

  /**
   * Get All Subscription Services
   *
   * Retrieves a list of all subscription services in the system.
   * Returns all services ordered by newest first (createdAt DESC).
   * Excludes soft-deleted records (deletedAt IS NULL).
   * No pagination, search, or filters.
   *
   * Response Format:
   * - Returns array of SubscriptionServiceResponseDto objects
   * - Ordered by createdAt DESC (newest first)
   *
   * Access Control:
   * - Public endpoint (no authentication required)
   *
   * Use Cases:
   * - Pricing screen display
   * - Subscription plan listing
   * - Public subscription browsing
   *
   * @returns {Promise<{data: SubscriptionServiceResponseDto[], message: string}>} List of all subscription services
   *
   * @swagger
   * @response 200 - Successfully retrieved subscription services
   */
  @Get('services')
  @ApiOperation({ summary: 'Get all subscription services' })
  @ApiResponseData({
    type: SubscriptionServiceResponseDto,
    status: MESSAGES.statusCode.success,
    message: 'Subscription services retrieved successfully',
    isArray: true,
  })
  async findAll(): Promise<{
    data: SubscriptionServiceResponseDto[];
    message: string;
  }> {
    const services = await this.subscriptionServicesService.findAll();
    return {
      data: services,
      message: 'Subscription services retrieved successfully',
    };
  }

  /**
   * Get Subscription Service by ID
   *
   * Retrieves detailed information for a specific subscription service.
   * Excludes soft-deleted records.
   *
   * Path Parameters:
   * - id: Subscription service UUID
   *
   * Response Format:
   * - Returns SubscriptionServiceResponseDto with full service details
   *
   * Access Control:
   * - Public endpoint (no authentication required)
   *
   * Use Cases:
   * - Pricing screen detail view
   * - Individual subscription plan details
   *
   * @param {string} id - Subscription service UUID
   * @returns {Promise<{data: SubscriptionServiceResponseDto, message: string}>} Subscription service details
   * @throws {NotFoundException} If subscription service not found
   *
   * @swagger
   * @response 200 - Successfully retrieved subscription service
   * @response 404 - Subscription service not found
   */
  @Get('services/:id')
  @ApiOperation({ summary: 'Get subscription service by ID' })
  @ApiResponseData({
    type: SubscriptionServiceResponseDto,
    status: MESSAGES.statusCode.success,
    message: 'Subscription service retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Subscription service not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ data: SubscriptionServiceResponseDto; message: string }> {
    const service = await this.subscriptionServicesService.findOne(id);
    return {
      data: service,
      message: 'Subscription service retrieved successfully',
    };
  }

  /**
   * Create Subscription Service
   *
   * Creates a new subscription service (plan).
   *
   * @param {CreateSubscriptionServiceDto} createDto - Data for new service
   * @returns {Promise<{data: SubscriptionServiceResponseDto, message: string}>} Created service details
   *
   * @swagger
   * @response 201 - Successfully created subscription service
   */
  @Post()
  @ApiOperation({ summary: 'Create subscription service' })
  @ApiResponseData({
    type: SubscriptionServiceResponseDto,
    status: MESSAGES.statusCode.created,
    message: 'Subscription service created successfully',
  })
  async create(
    @Body() createDto: CreateSubscriptionServiceDto,
  ): Promise<{ data: SubscriptionServiceResponseDto; message: string }> {
    const service = await this.subscriptionServicesService.create(createDto);
    return {
      data: service,
      message: 'Subscription service created successfully',
    };
  }

  /**
   * Update Subscription Service
   *
   * Updates an existing subscription service.
   *
   * @param {string} id - Subscription service UUID
   * @param {UpdateSubscriptionServiceDto} updateDto - Data to update
   * @returns {Promise<{data: SubscriptionServiceResponseDto, message: string}>} Updated service details
   * @throws {NotFoundException} If subscription service not found
   *
   * @swagger
   * @response 200 - Successfully updated subscription service
   * @response 404 - Subscription service not found
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update subscription service' })
  @ApiResponseData({
    type: SubscriptionServiceResponseDto,
    status: MESSAGES.statusCode.success,
    message: 'Subscription service updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Subscription service not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateSubscriptionServiceDto,
  ): Promise<{ data: SubscriptionServiceResponseDto; message: string }> {
    const service = await this.subscriptionServicesService.update(
      id,
      updateDto,
    );
    return {
      data: service,
      message: 'Subscription service updated successfully',
    };
  }

  /**
   * Remove Subscription Service
   *
   * Soft deletes a subscription service.
   *
   * @param {string} id - Subscription service UUID
   * @returns {Promise<{message: string}>} Success message
   * @throws {NotFoundException} If subscription service not found
   *
   * @swagger
   * @response 200 - Successfully deleted subscription service
   * @response 404 - Subscription service not found
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete subscription service' })
  @ApiResponse({
    status: 200,
    description: 'Subscription service deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Subscription service not found' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    await this.subscriptionServicesService.remove(id);
    return {
      message: 'Subscription service deleted successfully',
    };
  }

  @Get('statistics/clinic-usage/:patientId')
  @ApiOperation({ summary: 'Get clinic usage statistics for a patient' })
  @ApiResponseData({
    type: ClinicUsageStatisticsDto,
    status: MESSAGES.statusCode.success,
    message: 'Clinic usage statistics retrieved successfully',
    isArray: true,
  })
  async getClinicUsageStatistics(
    @Param('patientId', ParseUUIDPipe) patientId: string,
  ) {
    const data =
      await this.subscriptionServicesService.getClinicUsageStatistics(
        patientId,
      );
    return {
      data,
      message: 'Clinic usage statistics retrieved successfully',
    };
  }

  /* Get Current Subscription (Clinic Admin Only)
   *
   * Retrieves the current active subscription for the logged-in clinic admin.
   * Returns subscription details including service information.
   *
   * Security:
   * - Requires JWT authentication
   * - Requires CLINIC_ADMIN role
   * - User can only view their own subscription
   * - Data is automatically filtered by logged-in user's ID (clinic_id = user._id)
   *
   * Response Format:
   * - Returns SubscriptionResponseDto with full subscription and service details
   * - Includes: service name, price, discount, features, subscription dates, status
   *
   * Use Cases:
   * - Clinic admin dashboard
   * - View current subscription status
   * - Check expiration date
   *
   * @param {Account} user - Logged-in user from JWT token
   * @returns {Promise<{data: SubscriptionResponseDto, message: string}>} Current subscription details
   * @throws {NotFoundException} If no subscription found for this clinic
   * @throws {UnauthorizedException} If not authenticated
   * @throws {ForbiddenException} If not CLINIC_ADMIN role
   *
   * @swagger
   * @security JWT-auth
   * @response 200 - Successfully retrieved subscription
   * @response 401 - Unauthorized - Missing or invalid JWT token
   * @response 403 - Forbidden - Requires CLINIC_ADMIN role
   * @response 404 - No subscription found
   */
  @Get('clinic/me/current')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_ADMIN)
  @AllowExpiredSubscription()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get current subscription (Clinic Admin only)',
    description:
      'Retrieves the current active subscription for the logged-in clinic admin with full service details',
  })
  @ApiResponseData({
    type: SubscriptionResponseDto,
    status: MESSAGES.statusCode.success,
    message: 'Subscription fetched successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires CLINIC_ADMIN role',
  })
  @ApiResponse({ status: 404, description: 'No subscription found' })
  async getCurrentSubscription(
    @User() user: Account,
  ): Promise<{ data: SubscriptionResponseDto; message: string }> {
    const subscription =
      await this.subscriptionServicesService.getCurrentSubscription(user._id);
    return {
      data: subscription,
      message: MESSAGES.successMessage.subscriptionFetchedSuccess,
    };
  }

  /**
   * Cancel Current Subscription (Clinic Admin Only)
   *
   * Cancels the active subscription for the logged-in clinic admin.
   * Changes status to NON_RENEWING. The clinic remains active until expirationDate.
   *
   * @param {Account} user - Logged-in user from JWT token
   * @returns {Promise<{message: string}>} Success message
   * @throws {NotFoundException} If subscription not found
   * @throws {BadRequestException} If subscription is not ACTIVE
   *
   * @swagger
   * @security JWT-auth
   * @response 200 - Successfully cancelled subscription
   * @response 404 - No active subscription found
   */
  @Patch('clinic/me/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Cancel current subscription (Clinic Admin only)',
    description:
      'Cancels the active subscription. Status becomes NON_RENEWING. Must be Clinic Admin.',
  })
  @ApiResponse({
    status: 200,
    description: 'Subscription cancelled successfully (Non-renewing)',
  })
  @ApiResponse({ status: 404, description: 'No active subscription found' })
  async cancelCurrentSubscription(
    @User() user: Account,
  ): Promise<{ message: string }> {
    await this.subscriptionServicesService.cancelCurrentSubscription(user._id);
    return {
      message: 'Hủy gia hạn gói dịch vụ thành công.',
    };
  }

  /**
   * Get Subscription History (Clinic Admin Only)
   *
   * Retrieves paginated subscription history for the logged-in clinic admin.
   * Returns historical subscription records including service information.
   * Ordered by newest first (created_at DESC).
   *
   * Security:
   * - Requires JWT authentication
   * - Requires CLINIC_ADMIN role
   * - User can only view their own history
   * - Data is automatically filtered by logged-in user's ID (clinic_id = user._id)
   *
   * Query Parameters:
   * - page: Page number (default: 1)
   * - limit: Records per page (default: 10)
   *
   * Response Format:
   * - Returns SubscriptionHistoryResponseDto with pagination metadata
   * - Includes: data[], page, limit, total, totalPages
   * - Each record includes: service name, price, dates, status
   *
   * Use Cases:
   * - View past subscriptions
   * - Audit subscription changes
   * - Track subscription history
   *
   * @param {Account} user - Logged-in user from JWT token
   * @param {number} page - Page number (default: 1)
   * @param {number} limit - Records per page (default: 10)
   * @returns {Promise<{data: SubscriptionHistoryResponseDto, message: string}>} Paginated subscription history
   * @throws {UnauthorizedException} If not authenticated
   * @throws {ForbiddenException} If not CLINIC_ADMIN role
   *
   * @swagger
   * @security JWT-auth
   * @response 200 - Successfully retrieved subscription history
   * @response 401 - Unauthorized - Missing or invalid JWT token
   * @response 403 - Forbidden - Requires CLINIC_ADMIN role
   */
  @Get('clinic/me/history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_ADMIN)
  @AllowExpiredSubscription()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get subscription history (Clinic Admin only)',
    description:
      'Retrieves paginated subscription history for the logged-in clinic admin with pagination support',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Records per page (default: 10)',
    example: 10,
  })
  @ApiResponseData({
    type: SubscriptionHistoryResponseDto,
    status: MESSAGES.statusCode.success,
    message: 'Subscription history fetched successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires CLINIC_ADMIN role',
  })
  async getSubscriptionHistory(
    @User() user: Account,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<{ data: SubscriptionHistoryResponseDto; message: string }> {
    const history =
      await this.subscriptionServicesService.getSubscriptionHistory(
        user._id,
        page,
        limit,
      );
    return {
      data: history,
      message: MESSAGES.successMessage.subscriptionHistoryFetchedSuccess,
    };
  }
}
