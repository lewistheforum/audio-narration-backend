import { Injectable, NotFoundException } from '@nestjs/common';
import { SubscriptionService } from './entities/subscription-service.entity';
import { SubscriptionServiceRepository } from './repositories/subscription-service.repository';
import { SubscriptionServiceResponseDto } from './dto';
import { SubscriptionServiceStatus } from './enums/subscription-service-status.enum';

/**
 * Subscription Services Service
 *
 * Centralized service layer for managing subscription service operations in the Medicare system.
 * This service implements the business logic layer between controllers and the data access layer (repository).
 *
 * Core Responsibilities:
 * - Subscription service retrieval (list and detail)
 * - Soft-deleted record exclusion
 * - Data transformation to DTOs
 *
 * Database Architecture:
 * - subcription_services table: Core subscription service data
 *
 * Design Patterns:
 * - Repository Pattern: All database operations delegated to SubscriptionServiceRepository
 * - DTO Pattern: Data transformation via SubscriptionServiceResponseDto
 * - Service Layer Pattern: Business logic separation from controllers
 *
 * @class SubscriptionServicesService
 * @injectable
 */
@Injectable()
export class SubscriptionServicesService {
  constructor(
    private readonly subscriptionServiceRepository: SubscriptionServiceRepository,
  ) {}

  /**
   * Find All Subscription Services
   *
   * Retrieves all active subscription services from the system.
   * Excludes soft-deleted records (deletedAt IS NULL).
   * Filters by status = 'ACTIVE' by default.
   * Orders by createdAt DESC (newest first).
   *
   * Use Cases:
   * - Pricing screen display
   * - Subscription plan listing
   * - Public subscription browsing
   *
   * @returns {Promise<SubscriptionServiceResponseDto[]>} Array of subscription service DTOs
   *
   * @example
   * ```typescript
   * const services = await subscriptionServicesService.findAll();
   * // Returns array of active services ordered by newest first
   * ```
   */
  async findAll(): Promise<SubscriptionServiceResponseDto[]> {
    const services = await this.subscriptionServiceRepository.findAll(
      false,
      SubscriptionServiceStatus.ACTIVE,
    );
    return services.map((service) =>
      this.toResponseDto(service),
    );
  }

  /**
   * Find Subscription Service by ID
   *
   * Retrieves a single subscription service by its UUID.
   * Excludes soft-deleted records (deletedAt IS NULL).
   *
   * Business Rules:
   * - Service must exist
   * - Service must not be soft-deleted
   * - Returns 404 Not Found if service not found
   *
   * @param {string} id - Subscription service UUID
   * @returns {Promise<SubscriptionServiceResponseDto>} Subscription service DTO
   * @throws {NotFoundException} If service does not exist or is soft-deleted
   *
   * @example
   * ```typescript
   * const service = await subscriptionServicesService.findOne('uuid-here');
   * // Returns service details
   * ```
   */
  async findOne(id: string): Promise<SubscriptionServiceResponseDto> {
    const service = await this.subscriptionServiceRepository.findById(id);
    
    if (!service) {
      throw new NotFoundException('Subscription service not found');
    }
    
    return this.toResponseDto(service);
  }

  /**
   * Transform SubscriptionService Entity to Response DTO
   *
   * Maps entity fields to DTO format.
   * Handles field name mapping (_id -> id).
   *
   * @param {SubscriptionService} service - Subscription service entity
   * @returns {SubscriptionServiceResponseDto} Response DTO
   *
   * @private
   */
  private toResponseDto(
    service: SubscriptionService,
  ): SubscriptionServiceResponseDto {
    const priceAfterDiscount = service.price - (service.price * service.discount / 100);
    
    return {
      id: service._id,
      serviceName: service.serviceName,
      code: service.code,
      description: service.description,
      price: service.price,
      discount: service.discount,
      serviceFunctions: service.serviceFunctions,
      isPopular: service.isPopular,
      status: service.status,
      chartColor: service.chartColor,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
      priceAfterDiscount,
    };
  }
}
