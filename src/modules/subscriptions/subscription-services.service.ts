import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SubscriptionService } from './entities/subscription-service.entity';
import { SubscriptionServiceRepository } from './repositories/subscription-service.repository';
import {
  SubscriptionServiceResponseDto,
  SubscriptionResponseDto,
  SubscriptionHistoryResponseDto,
  SubscriptionHistoryItemDto,
  UpdateSubscriptionServiceDto,
  CreateSubscriptionServiceDto,
} from './dto';
import { SubscriptionServiceStatus } from './enums/subscription-service-status.enum';
import { ClinicSubscriptionRepository } from './repositories/clinic-subscription.repository';
import { ClinicSubscriptionHistoryRepository } from './repositories/clinic-subscription-history.repository';
import { ClinicSubscriptionRenewalQueueRepository } from './repositories/clinic-subscription-renewal-queue.repository';
import { RegistrationStatus } from './enums/subscription-status.enum';
import { MESSAGES } from 'src/common/message';
import { ClinicSubscriptionHistory } from './entities/clinic-subscription-history.entity';
import { DataSource } from 'typeorm';
import {
  getCurrentVietnamTime,
  getStartOfDay,
  getEndOfDay,
  addToDate,
} from 'src/common/utils/date.util';

/**
 * Subscription Services Service
 *
 * Centralized service layer for managing subscription service operations in the Bonix system.
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
    private readonly clinicSubscriptionRenewalQueueRepository: ClinicSubscriptionRenewalQueueRepository,
    private readonly dataSource: DataSource,
  ) { }

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

  /**
   * Cancel Current Subscription
   *
   * Cancels the currently active subscription for a clinic admin.
   * Updates status to NON_RENEWING and logs history.
   *
   * @param {string} clinicAdminId - UUID of the clinic admin
   * @returns {Promise<any>} The updated subscription
   * @throws {NotFoundException} If subscription not found
   * @throws {BadRequestException} If subscription is not ACTIVE
   */
  async cancelCurrentSubscription(clinicAdminId: string): Promise<any> {
    const subscription = await this.clinicSubscriptionRepository.findByClinicId(clinicAdminId);

    if (!subscription) {
      throw new NotFoundException(
        'Không tìm thấy gói dịch vụ nào đang hoạt động.',
      );
    }

    if (subscription.subscriptionStatus !== RegistrationStatus.ACTIVE) {
      throw new BadRequestException(
        `Không thể hủy gói dịch vụ đang ở trạng thái ${subscription.subscriptionStatus}. Chỉ gói đang hoạt động mới được phép hủy.`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Update status to NON_RENEWING
      subscription.subscriptionStatus = RegistrationStatus.NON_RENEWING;
      const updatedSubscription = await queryRunner.manager.save(
        subscription,
      );

      // 2. Log History
      const history = this.clinicSubscriptionHistoryRepository.create({
        clinicId: clinicAdminId,
        serviceId: subscription.serviceId,
        subscriptionDate: subscription.subscriptionDate,
        expirationDate: subscription.expirationDate,
        subscriptionStatus: RegistrationStatus.NON_RENEWING,
      });
      await queryRunner.manager.save(ClinicSubscriptionHistory, history);

      await queryRunner.commitTransaction();
      return updatedSubscription;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

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

    // Fetch queued subscription if any
    const queuedRecord =
      await this.clinicSubscriptionRenewalQueueRepository.findByClinicId(
        clinicId,
      );

    let queuedServiceDetails = null;
    if (queuedRecord) {
      queuedServiceDetails = await this.subscriptionServiceRepository.findById(
        queuedRecord.nextServiceId,
      );
    }

    return this.toSubscriptionResponseDto(
      subscription,
      service,
      queuedRecord,
      queuedServiceDetails,
    );
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
   * Handle Subscription Payment Success
   *
   * Logic:
   * 1. New/Expired -> Activate Immediately.
   * 2. Active -> Queue for Renewal (Change Package or same).
   *
   * @param {string} subscriptionId - ID of the ClinicSubscription record
   * @param {string} targetServiceId - Optional ID of the new service (if changing/upgrading)
   * @param {string} transactionId - Optional ID of the transaction for history linking
   * @param {number} duration - Duration in months (default 1)
   */
  async handleSubscriptionPaymentSuccess(
    subscriptionId: string,
    targetServiceId?: string,
    transactionId?: string,
    duration: number = 1,
  ): Promise<void> {
    console.log(
      `[DEBUG] handleSubscriptionPaymentSuccess called. SubID: ${subscriptionId}, TargetServiceID: ${targetServiceId}, TxID: ${transactionId}, Duration: ${duration}`,
    );

    // 1. Get Subscription
    const subscription =
      await this.clinicSubscriptionRepository.findById(subscriptionId);
    if (!subscription) throw new NotFoundException('Subscription not found');

    console.log(
      `[DEBUG] Current Subscription State: ServiceID=${subscription.serviceId}, Status=${subscription.subscriptionStatus}, Expire=${subscription.expirationDate}`,
    );

    // 2. Determine Service to Activate / Queue
    const serviceIdToActivate = targetServiceId || subscription.serviceId;
    console.log(
      `[DEBUG] Service ID resolved for activation: ${serviceIdToActivate}`,
    );
    // 3. Get Service Details (for name)
    const service =
      await this.subscriptionServiceRepository.findById(serviceIdToActivate);
    if (!service) throw new NotFoundException('Service not found');

    // Use duration from parameter (passed from transaction content)
    const DURATION_MONTHS = duration;

    const now = new Date();

    // Check if currently Active AND Not Expired
    const isActive =
      subscription.subscriptionStatus === RegistrationStatus.ACTIVE;
    const isNotExpired =
      subscription.expirationDate &&
      new Date(subscription.expirationDate) > now;

    if (isActive && isNotExpired) {
      // CASE: Renewal / Change Package while Active -> QUEUE
      console.log(
        `[Subscription] Queueing renewal/change for clinic ${subscription.clinicId}. Next Service: ${service.serviceName}`,
      );

      // Determine Current Expiration in VN Time
      // currentExpirationDate is already stored as Wall-Clock UTC (representing VN time)
      const currentExpirationDate = new Date(subscription.expirationDate);
      const targetStartDate = getStartOfDay(addToDate(currentExpirationDate, 60, 'second'));

      // Determine Next End Date
      // Inclusive full period: Start + Duration - 1 day
      const targetEndDate = getEndOfDay(addToDate(targetStartDate, DURATION_MONTHS, 'month'));
      targetEndDate.setUTCDate(targetEndDate.getUTCDate() - 1); // Make inclusive 23:59:59

      // Create or Update Queue Record
      let queueRecord =
        await this.clinicSubscriptionRenewalQueueRepository.findByClinicId(
          subscription.clinicId,
        );

      if (queueRecord) {
        // Update existing
        queueRecord.nextServiceId = serviceIdToActivate;
        queueRecord.targetStartDate = targetStartDate;
        queueRecord.targetEndDate = targetEndDate;
        await this.clinicSubscriptionRenewalQueueRepository.save(queueRecord);
      } else {
        // Create new
        await this.clinicSubscriptionRenewalQueueRepository.createQueueRecord({
          clinicId: subscription.clinicId,
          nextServiceId: serviceIdToActivate,
          targetStartDate,
          targetEndDate,
        });
      }

      // Create History Immediately for Queue Item (Future Activation)
      await this.clinicSubscriptionHistoryRepository.createHistoryRecord({
        clinicId: subscription.clinicId,
        serviceId: serviceIdToActivate,
        transactionId: transactionId, // Link Transaction
        subscriptionStatus: RegistrationStatus.ACTIVE, // Mark as Paid/Active for that future period
        subscriptionDate: targetStartDate,
        expirationDate: targetEndDate,
      });
    } else {
      // CASE: New or Expired -> ACTIVATE IMMEDIATELY
      console.log(
        `[Subscription] Activating subscription for clinic ${subscription.clinicId}. Service: ${service.serviceName}`,
      );

      // 1. Get Start Date (Today 00:00:00)
      const startDate = getStartOfDay();

      // 2. Get End Date (Start + Duration - 1 day at 23:59:59.999)
      const expirationDate = getEndOfDay(addToDate(startDate, DURATION_MONTHS, 'month'));
      expirationDate.setUTCDate(expirationDate.getUTCDate() - 1); // Make inclusive

      console.log(`[DEBUG] Date Calculation (VN Wall Clock stored as UTC):`);
      console.log(`   Now (UTC): ${now.toISOString()}`);
      console.log(
        `   Start Date (DB): ${startDate.toISOString()} (Expected 00:00:00Z)`,
      );
      console.log(
        `   End Date (DB): ${expirationDate.toISOString()} (Expected 23:59:59Z)`,
      );

      // Update Subscription
      subscription.serviceId = serviceIdToActivate;
      subscription.subscriptionStatus = RegistrationStatus.ACTIVE;
      subscription.subscriptionDate = startDate;
      subscription.expirationDate = expirationDate;

      await this.clinicSubscriptionRepository.save(subscription);

      console.log(
        `[DEBUG] Creating History Record. Transaction ID: ${transactionId}`,
      );

      // Create History
      await this.clinicSubscriptionHistoryRepository.createHistoryRecord({
        clinicId: subscription.clinicId,
        serviceId: serviceIdToActivate,
        transactionId: transactionId, // Link Transaction
        subscriptionStatus: RegistrationStatus.ACTIVE,
        subscriptionDate: startDate,
        expirationDate: expirationDate,
      });

      // Update Popular Services (NEW)
      await this.updatePopularServices();
    }
  }

  /**
   * Update Popular Services Based on Active Subscription Count
   *
   * Business Rules:
   * - Count ACTIVE subscriptions grouped by serviceId
   * - Service with highest count gets is_popular = true
   * - All other services get is_popular = false
   * - Only one service can be popular at a time
   *
   * Trigger Point:
   * - Called after successful payment when subscription becomes ACTIVE
   *
   * Implementation:
   * - Uses QueryBuilder for optimized counting
   * - Transaction ensures atomic update
   */
  async updatePopularServices(): Promise<void> {
    // 1. Count ACTIVE subscriptions grouped by serviceId
    const activeCountByService =
      await this.clinicSubscriptionRepository.getActiveCountByService();

    console.log(
      '[DEBUG] Active subscription counts by service:',
      activeCountByService,
    );

    // 2. Check if we have any active subscriptions
    if (!activeCountByService || activeCountByService.length === 0) {
      console.log(
        '[DEBUG] No active subscriptions found. Resetting all is_popular to false.',
      );
      await this.subscriptionServiceRepository.resetAllPopular();
      return;
    }

    // 3. Get the most popular service (highest count)
    const mostPopular = activeCountByService[0];
    const mostPopularServiceId = mostPopular.serviceId;

    console.log(
      `[DEBUG] Most popular service: ${mostPopularServiceId} with ${mostPopular.activeCount} active subscriptions`,
    );

    // 4. Reset all services to not popular
    await this.subscriptionServiceRepository.resetAllPopular();

    // 5. Set the most popular service
    await this.subscriptionServiceRepository.setPopular(mostPopularServiceId);

    console.log(
      `[DEBUG] Successfully updated is_popular flag. Service ${mostPopularServiceId} is now popular.`,
    );
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
   * @param {any} queuedRecord - Optional queued renewal record
   * @param {SubscriptionService} queuedService - Optional queued subscription service
   * @returns {SubscriptionResponseDto} Response DTO
   *
   * @private
   */
  private toSubscriptionResponseDto(
    subscription: any,
    service: SubscriptionService,
    queuedRecord?: any,
    queuedService?: SubscriptionService,
  ): SubscriptionResponseDto {
    const priceAfterDiscount =
      service.price - (service.price * service.discount) / 100;

    let remainingDays = 0;
    if (subscription.expirationDate) {
      const now = new Date();
      const expirationDate = new Date(subscription.expirationDate);
      const diffTime = expirationDate.getTime() - now.getTime();
      // Calculate remaining days (if expired, will be 0)
      remainingDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    const response: SubscriptionResponseDto = {
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
      remainingDays,
    };

    if (queuedRecord && queuedService) {
      response.queuedSubscription = {
        serviceId: queuedService._id,
        serviceName: queuedService.serviceName,
        targetStartDate: queuedRecord.targetStartDate,
        targetEndDate: queuedRecord.targetEndDate,
      };
    }

    return response;
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
