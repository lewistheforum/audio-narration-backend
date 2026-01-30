import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiExtraModels,
} from '@nestjs/swagger';
import { SubscriptionServicesService } from './subscription-services.service';
import { SubscriptionServiceResponseDto } from './dto';
import { ApiResponseData } from 'src/common/decorators/api-response.decorator';
import { MESSAGES } from 'src/common/message';

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
@ApiExtraModels(SubscriptionServiceResponseDto)
@Controller('subscription/services')
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
  @Get()
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
  @Get(':id')
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
}
