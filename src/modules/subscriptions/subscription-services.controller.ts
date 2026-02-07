import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
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
  SubscriptionResponseDto,
  SubscriptionHistoryResponseDto,
} from './dto';
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
 * RESTful API controller for managing subscription services in the Medicare system.
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
  ) {}

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
   * Get Current Subscription (Clinic Admin Only)
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
