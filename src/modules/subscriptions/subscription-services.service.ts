import { Injectable, NotFoundException } from '@nestjs/common';
import { SubscriptionService } from './entities/subscription-service.entity';
import { SubscriptionServiceRepository } from './repositories/subscription-service.repository';
import {
  SubscriptionServiceResponseDto,
  SubscriptionResponseDto,
  SubscriptionHistoryResponseDto,
  SubscriptionHistoryItemDto,
} from './dto';
import { SubscriptionServiceStatus } from './enums/subscription-service-status.enum';
import { ClinicSubscriptionRepository } from './repositories/clinic-subscription.repository';
import { ClinicSubscriptionHistoryRepository } from './repositories/clinic-subscription-history.repository';
import { MESSAGES } from 'src/common/message';

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
    private readonly clinicSubscriptionRepository: ClinicSubscriptionRepository,
    private readonly clinicSubscriptionHistoryRepository: ClinicSubscriptionHistoryRepository,
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

  /**
   * Check and Update Expired Subscriptions (TO BE IMPLEMENTED)
   *
   * This method should be implemented as either:
   * 1. A scheduled cron job (recommended - runs automatically at intervals)
   * 2. A lazy check (runs on authenticated requests)
   *
   * Business Rules:
   * - Checks subscriptions with status ACTIVE or NON_RENEWING
   * - Compares expirationDate with current timestamp
   * - Transitions to EXPIRED if date has passed
   * - Creates history record for the transition
   * - No auto-renewal (manual renewal required)
   *
   * Logic:
   * ```typescript
   * IF (expirationDate < NOW) AND (status IN ['ACTIVE', 'NON_RENEWING']) THEN
   *   1. Update ClinicSubscription.subscriptionStatus = EXPIRED
   *   2. Create ClinicSubscriptionHistory record with status EXPIRED
   *   3. Revoke user access immediately
   * END IF
   * ```
   *
   * Implementation Options:
   *
   * Option 1 - Cron Job (Recommended):
   * ```typescript
   * import { Cron, CronExpression } from '@nestjs/schedule';
   *
   * @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
   * async checkExpiredSubscriptions() {
   *   const now = new Date();
   *   const expiredSubscriptions = await this.clinicSubscriptionRepository.find({
   *     where: [
   *       { subscriptionStatus: RegistrationStatus.ACTIVE, expirationDate: LessThan(now) },
   *       { subscriptionStatus: RegistrationStatus.NON_RENEWING, expirationDate: LessThan(now) }
   *     ]
   *   });
   *
   *   for (const subscription of expiredSubscriptions) {
   *     subscription.subscriptionStatus = RegistrationStatus.EXPIRED;
   *     await this.clinicSubscriptionRepository.save(subscription);
   *
   *     // Create history record
   *     await this.clinicSubscriptionHistoryRepository.createHistoryRecord({
   *       clinicId: subscription.clinicId,
   *       serviceId: subscription.serviceId,
   *       subscriptionDate: subscription.subscriptionDate,
   *       expirationDate: subscription.expirationDate,
   *       subscriptionStatus: RegistrationStatus.EXPIRED
   *     });
   *   }
   * }
   * ```
   *
   * Option 2 - Lazy Check (On Request):
   * ```typescript
   * async checkSubscriptionExpiration(subscription: ClinicSubscription) {
   *   if ((subscription.subscriptionStatus === RegistrationStatus.ACTIVE ||
   *        subscription.subscriptionStatus === RegistrationStatus.NON_RENEWING) &&
   *       subscription.expirationDate < new Date()) {
   *     subscription.subscriptionStatus = RegistrationStatus.EXPIRED;
   *     await this.clinicSubscriptionRepository.save(subscription);
   *
   *     // Create history record
   *     await this.clinicSubscriptionHistoryRepository.createHistoryRecord({
   *       clinicId: subscription.clinicId,
   *       serviceId: subscription.serviceId,
   *       subscriptionDate: subscription.subscriptionDate,
   *       expirationDate: subscription.expirationDate,
   *       subscriptionStatus: RegistrationStatus.EXPIRED
   *     });
   *   }
   * }
   * ```
   *
   * History Logging:
   * - ACTIVE -> EXPIRED: Natural expiration (user did nothing)
   * - NON_RENEWING -> EXPIRED: Expiration after explicit cancellation
   *
   * @future-implementation
   * @cron-job-candidate
   */
  // Placeholder for future implementation
  // async checkExpiredSubscriptions(): Promise<void> {
  //   // Implementation goes here
  // }

  /**
   * Get Current Subscription for Clinic Admin
   *
   * Retrieves the current active subscription for the logged-in clinic admin.
   * Joins with subscription_services table to return full service details.
   * Filters by clinic_id (which matches the user's account _id).
   *
   * Business Rules:
   * - Query: clinic_subscriptions WHERE clinic_id = :currentUserId
   * - Excludes soft-deleted records (deletedAt IS NULL)
   * - Returns 404 if no subscription found
   * - Joins with subscription_services table for service details
   *
   * Security:
   * - User can only view their own subscription
   * - Data is automatically filtered by logged-in user's ID
   * - Protected by @Roles(Role.CLINIC_ADMIN) and JwtAuthGuard
   *
   * @param {string} clinicId - Clinic account UUID (from JWT token)
   * @returns {Promise<SubscriptionResponseDto>} Current subscription with service details
   * @throws {NotFoundException} If no subscription found for this clinic
   *
   * @example
   * ```typescript
   * const subscription = await subscriptionServicesService.getCurrentSubscription(user._id);
   * // Returns current subscription with service details
   * ```
   */
  async getCurrentSubscription(
    clinicId: string,
  ): Promise<SubscriptionResponseDto> {
    const subscription =
      await this.clinicSubscriptionRepository.findByClinicId(clinicId);

    if (!subscription) {
      throw new NotFoundException(MESSAGES.failMessage.subscriptionNotFound);
    }

    // Fetch service details
    const service = await this.subscriptionServiceRepository.findById(
      subscription.serviceId,
    );

    if (!service) {
      throw new NotFoundException('Subscription service not found');
    }

    return this.toSubscriptionResponseDto(subscription, service);
  }

  /**
   * Get Subscription History for Clinic Admin
   *
   * Retrieves paginated subscription history for the logged-in clinic admin.
   * Joins with subscription_services table to return service details.
   * Filters by clinic_id and orders by created_at DESC (newest first).
   *
   * Business Rules:
   * - Query: clinic_subscriptions_history WHERE clinic_id = :currentUserId
   * - Excludes soft-deleted records (deletedAt IS NULL)
   * - Pagination: page and limit parameters
   * - Ordering: created_at DESC (newest first)
   * - Joins with subscription_services table for service details
   *
   * Security:
   * - User can only view their own history
   * - Data is automatically filtered by logged-in user's ID
   * - Protected by @Roles(Role.CLINIC_ADMIN) and JwtAuthGuard
   *
   * Pagination:
   * - Default page: 1
   * - Default limit: 10
   * - Returns: data, page, limit, total, totalPages
   *
   * @param {string} clinicId - Clinic account UUID (from JWT token)
   * @param {number} page - Page number (default: 1)
   * @param {number} limit - Records per page (default: 10)
   * @returns {Promise<SubscriptionHistoryResponseDto>} Paginated subscription history
   *
   * @example
   * ```typescript
   * const history = await subscriptionServicesService.getSubscriptionHistory(user._id, 1, 10);
   * // Returns paginated history with service details
   * ```
   */
  async getSubscriptionHistory(
    clinicId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<SubscriptionHistoryResponseDto> {
    const skip = (page - 1) * limit;

    // Get total count
    const [historyRecords, total] =
      await this.clinicSubscriptionHistoryRepository.findAndCount({
        where: { clinicId },
        order: { createdAt: 'DESC' },
        skip,
        take: limit,
      });

    // Fetch service details for each history record
    const historyWithServices = await Promise.all(
      historyRecords.map(async (record) => {
        const service = await this.subscriptionServiceRepository.findById(
          record.serviceId,
        );
        return this.toSubscriptionHistoryItemDto(record, service);
      }),
    );

    const totalPages = Math.ceil(total / limit);

    return {
      data: historyWithServices,
      page,
      limit,
      total,
      totalPages,
    };
  }

  /**
   * Transform ClinicSubscription and SubscriptionService to Response DTO
   *
   * Maps entity fields to DTO format.
   * Combines subscription and service data into a single flat DTO.
   * Calculates price after discount.
   *
   * @param {ClinicSubscription} subscription - Clinic subscription entity
   * @param {SubscriptionService} service - Subscription service entity
   * @returns {SubscriptionResponseDto} Response DTO
   *
   * @private
   */
  private toSubscriptionResponseDto(
    subscription: any,
    service: SubscriptionService,
  ): SubscriptionResponseDto {
    const priceAfterDiscount =
      service.price - (service.price * service.discount) / 100;

    return {
      id: subscription._id,
      clinicId: subscription.clinicId,
      serviceId: service._id,
      serviceName: service.serviceName,
      serviceCode: service.code,
      serviceDescription: service.description,
      servicePrice: service.price,
      serviceDiscount: service.discount,
      servicePriceAfterDiscount: priceAfterDiscount,
      serviceFunctions: service.serviceFunctions,
      subscriptionDate: subscription.subscriptionDate,
      expirationDate: subscription.expirationDate,
      subscriptionStatus: subscription.subscriptionStatus,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    };
  }

  /**
   * Transform ClinicSubscriptionHistory and SubscriptionService to History Item DTO
   *
   * Maps entity fields to DTO format.
   * Combines history record and service data into a single flat DTO.
   * Calculates price after discount.
   *
   * @param {ClinicSubscriptionHistory} record - History record entity
   * @param {SubscriptionService} service - Subscription service entity
   * @returns {SubscriptionHistoryItemDto} History item DTO
   *
   * @private
   */
  private toSubscriptionHistoryItemDto(
    record: any,
    service: SubscriptionService | null,
  ): SubscriptionHistoryItemDto {
    const priceAfterDiscount = service
      ? service.price - (service.price * service.discount) / 100
      : 0;

    return {
      id: record._id,
      clinicId: record.clinicId,
      serviceId: record.serviceId,
      serviceName: service?.serviceName || 'Unknown Service',
      serviceCode: service?.code || 'N/A',
      serviceDescription: service?.description,
      servicePrice: service?.price || 0,
      serviceDiscount: service?.discount || 0,
      servicePriceAfterDiscount: priceAfterDiscount,
      serviceFunctions: service?.serviceFunctions,
      subscriptionDate: record.subscriptionDate,
      expirationDate: record.expirationDate,
      subscriptionStatus: record.subscriptionStatus,
      createdAt: record.createdAt,
    };
  }
}
