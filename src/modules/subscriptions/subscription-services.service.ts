import { Injectable, NotFoundException } from '@nestjs/common';
import { SubscriptionService } from './entities/subscription-service.entity';
import { SubscriptionServiceRepository } from './repositories/subscription-service.repository';
import {
  SubscriptionServiceResponseDto,
  CreateSubscriptionServiceDto,
  UpdateSubscriptionServiceDto,
} from './dto';
import { SubscriptionServiceStatus } from './enums/subscription-service-status.enum';
import { DataSource } from 'typeorm';

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
    private readonly dataSource: DataSource,
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
      // SubscriptionServiceStatus.ACTIVE,
    );
    return services.map((service) => this.toResponseDto(service));
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
   * Create Subscription Service
   *
   * Creates a new subscription service (plan).
   *
   * @param {CreateSubscriptionServiceDto} createDto - Data for new service
   * @returns {Promise<SubscriptionServiceResponseDto>} Created service details
   */
  async create(
    createDto: CreateSubscriptionServiceDto,
  ): Promise<SubscriptionServiceResponseDto> {
    const service = this.subscriptionServiceRepository.create(createDto);
    const savedService = await this.subscriptionServiceRepository.save(service);
    return this.toResponseDto(savedService);
  }

  /**
   * Update Subscription Service
   *
   * Updates an existing subscription service.
   *
   * @param {string} id - Service UUID
   * @param {UpdateSubscriptionServiceDto} updateDto - Data to update
   * @returns {Promise<SubscriptionServiceResponseDto>} Updated service details
   * @throws {NotFoundException} If service not found
   */
  async update(
    id: string,
    updateDto: UpdateSubscriptionServiceDto,
  ): Promise<SubscriptionServiceResponseDto> {
    const service = await this.subscriptionServiceRepository.findById(id);

    if (!service) {
      throw new NotFoundException('Subscription service not found');
    }

    // Merge updates
    const updatedService = await this.subscriptionServiceRepository.save({
      ...service,
      ...updateDto,
    });

    return this.toResponseDto(updatedService);
  }

  /**
   * Remove Subscription Service
   *
   * Soft deletes a subscription service.
   *
   * @param {string} id - Service UUID
   * @returns {Promise<void>}
   * @throws {NotFoundException} If service not found
   */
  async remove(id: string): Promise<void> {
    const exists = await this.subscriptionServiceRepository.existsById(id);

    if (!exists) {
      throw new NotFoundException('Subscription service not found');
    }

    await this.subscriptionServiceRepository.softDelete(id);
  }

  async getClinicUsageStatistics(patientId: string) {
    const query = `
      SELECT 
          cai.clinic_name AS "clinicName",
          cmi.clinic_branch_name AS "branchName",
          COUNT(app._id)::int AS "appointmentCount"
      FROM 
          appointments app
      JOIN 
          clinic_manager_information cmi ON cmi.account_id = app.clinic_id
      JOIN 
          accounts a ON a._id = cmi.account_id
      JOIN 
          clinic_admin_information cai ON cai.account_id = a.parent_id
      WHERE 
          app.patient_id = $1
          AND app.deleted_at IS NULL
          AND cmi.deleted_at IS NULL
          AND a.deleted_at IS NULL
          AND cai.deleted_at IS NULL
      GROUP BY 
          cai.clinic_name, 
          cmi.clinic_branch_name;
    `;

    return this.dataSource.query(query, [patientId]);
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
    const priceAfterDiscount =
      service.price - (service.price * service.discount) / 100;

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
}
