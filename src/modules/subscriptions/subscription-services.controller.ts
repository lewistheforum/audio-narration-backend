import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiExtraModels,
} from '@nestjs/swagger';
import { SubscriptionServicesService } from './subscription-services.service';
import {
  SubscriptionServiceResponseDto,
  CreateSubscriptionServiceDto,
  UpdateSubscriptionServiceDto,
  ClinicUsageStatisticsDto,
} from './dto';
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
}
