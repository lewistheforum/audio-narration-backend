import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../../modules/accounts/entities/accounts.entity';
import { AccountRole } from '../../modules/accounts/enums';
import { LegalDocumentVerificationStatus } from '../../modules/accounts/enums/legal-document-verification-status.enum';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { ClinicsLegalDocumentsRepository } from '../../modules/accounts/repositories/clinics-legal-documents.repository';
import { ClinicSubscription } from '../../modules/subscriptions/entities/clinic-subscription.entity';
import { ClinicSubscriptionHistory } from '../../modules/subscriptions/entities/clinic-subscription-history.entity';
import { SubscriptionService } from '../../modules/subscriptions/entities/subscription-service.entity';
import { RegistrationStatus } from '../../modules/subscriptions/enums';
import { ClinicSubscriptionRepository } from '../../modules/subscriptions/repositories/clinic-subscription.repository';
import { SubscriptionServiceRepository } from '../../modules/subscriptions/repositories/subscription-service.repository';
import { subtractFromVietnamTime, addToVietnamTime } from '../utils/date.util';

/**
 * Subscriptions Seeder Service
 *
 * Seeds clinic subscriptions and subscription history for CLINIC_ADMIN accounts.
 *
 * Seeding Rules:
 * - clinicId must be taken from Account records where role = CLINIC_ADMIN
 * - Create 1 ClinicSubscription record per CLINIC_ADMIN account
 * - Subscription status is aligned with legal document verification status of CLINIC_MANAGER
 * - Create 0-2 ClinicSubscriptionHistory records per CLINIC_ADMIN account
 * - Distribute records across clinic admins evenly (round-robin)
 * - Must be idempotent (re-run safe)
 *
 * Status Alignment Logic:
 * - Legal Doc: NOT_SUBMITTED → Subscription: PENDING_LEGAL_SETUP
 * - Legal Doc: PENDING_REVIEW → Subscription: PENDING_APPROVAL
 * - Legal Doc: APPROVED → Subscription: PENDING_PAYMENT or ACTIVE
 * - Legal Doc: REJECTED → Subscription: PENDING_LEGAL_SETUP
 *
 * Idempotent: Uses check-then-insert pattern by clinicId
 */
@Injectable()
export class SubscriptionsSeederService {
  private readonly logger = new Logger(SubscriptionsSeederService.name);

  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly subscriptionServiceRepository: SubscriptionServiceRepository,
    private readonly clinicSubscriptionRepository: ClinicSubscriptionRepository,
    private readonly clinicsLegalDocumentsRepository: ClinicsLegalDocumentsRepository,
    @InjectRepository(ClinicSubscriptionHistory)
    private readonly clinicSubscriptionHistoryRepository: Repository<ClinicSubscriptionHistory>,
  ) {}

  /**
   * Seed clinic subscriptions and subscription history
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
   */
  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed clinic subscriptions...');

      // Get all CLINIC_ADMIN accounts
      const allAccounts = await this.accountRepository.findAllAccounts();
      const clinicAdmins = allAccounts.filter(
        (acc) => acc.role === AccountRole.CLINIC_ADMIN,
      );

      if (clinicAdmins.length === 0) {
        this.logger.warn('No CLINIC_ADMIN accounts found. Skipping seeding.');
        return;
      }

      // Get all subscription services
      const subscriptionServices =
        await this.subscriptionServiceRepository.findAll();

      if (subscriptionServices.length === 0) {
        this.logger.warn('No subscription services found. Skipping seeding.');
        return;
      }

      this.logger.log(
        `Found ${clinicAdmins.length} CLINIC_ADMIN accounts and ${subscriptionServices.length} subscription services`,
      );

      // Seed ClinicSubscription records
      await this.seedClinicSubscriptions(clinicAdmins, subscriptionServices);

      // Seed ClinicSubscriptionHistory records
      await this.seedClinicSubscriptionHistory(
        clinicAdmins,
        subscriptionServices,
      );

      // Seed Hanging (Pending) ClinicSubscription records (backdated 6-12 months)
      await this.seedHangingSubscriptions(clinicAdmins, subscriptionServices);

      // Seed Hanging SubscriptionHistory records
      await this.seedHangingSubscriptionHistory(
        clinicAdmins,
        subscriptionServices,
      );

      this.logger.log('✅ Clinic subscriptions seeding completed');
    } catch (error) {
      this.logger.error('Failed to seed clinic subscriptions', error.stack);
      throw error;
    }
  }

  /**
   * Seed ClinicSubscription records
   *
   * Creates 1 ClinicSubscription record per CLINIC_ADMIN account
   * Subscription status is aligned with legal document verification status
   */
  private async seedClinicSubscriptions(
    clinicAdmins: Account[],
    subscriptionServices: SubscriptionService[],
  ): Promise<void> {
    let createdCount = 0;
    let skippedCount = 0;
    let activeCount = 0; // Track how many clinics got ACTIVE status

    for (const clinicAdmin of clinicAdmins) {
      // Check if subscription already exists for this clinic
      const existing = await this.clinicSubscriptionRepository.existsByClinicId(
        clinicAdmin._id,
      );

      if (existing) {
        skippedCount++;
        continue;
      }

      // Get random subscription service (round-robin distribution)
      const serviceIndex = createdCount % subscriptionServices.length;
      const service = subscriptionServices[serviceIndex];

      // Get the first CLINIC_MANAGER for this CLINIC_ADMIN
      const clinicManagers = await this.accountRepository
        .findAllAccounts()
        .then((accounts) =>
          accounts.filter(
            (acc) =>
              acc.role === AccountRole.CLINIC_MANAGER &&
              acc.parentId === clinicAdmin._id,
          ),
        );

      // Determine subscription status based on index (first 5 are ACTIVE, rest are PENDING)
      const isPending = createdCount >= 5;
      let subscriptionStatus: RegistrationStatus;

      if (!isPending && clinicManagers.length > 0) {
        // Force first 5 clinics to ACTIVE status
        subscriptionStatus = RegistrationStatus.ACTIVE;

        // Also update their legal docs to APPROVED for consistency
        const legalDoc =
          await this.clinicsLegalDocumentsRepository.findByAccountId(
            clinicManagers[0]._id,
          );
        if (legalDoc) {
          legalDoc.verificationStatus =
            LegalDocumentVerificationStatus.APPROVED;
          await this.clinicsLegalDocumentsRepository.save(legalDoc);
        }
      } else {
        // Assign a random pending status for testing cleanup
        const pendingStatuses = [
          RegistrationStatus.PENDING_SEPAY_SETUP,
          RegistrationStatus.PENDING_MANAGER_SETUP,
          RegistrationStatus.PENDING_LEGAL_SETUP,
          RegistrationStatus.PENDING_APPROVAL,
          RegistrationStatus.PENDING_PAYMENT,
        ];
        subscriptionStatus =
          pendingStatuses[Math.floor(Math.random() * pendingStatuses.length)];
      }

      // Calculate subscription and expiration dates
      const subscriptionDate = new Date();
      const expirationDate = new Date();
      expirationDate.setFullYear(expirationDate.getFullYear() + 1);

      // Create clinic subscription with aligned status
      const clinicSubscription = this.clinicSubscriptionRepository.create({
        clinicId: clinicAdmin._id,
        serviceId: service._id,
        subscriptionDate,
        expirationDate,
        subscriptionStatus,
      });

      const savedSubscription =
        await this.clinicSubscriptionRepository.save(clinicSubscription);

      // If this is a pending subscription (not ACTIVE), backdate its createdAt
      // so it becomes "stale" (> 6 months) to facilitate testing the cleanup API
      if (subscriptionStatus !== RegistrationStatus.ACTIVE) {
        // Generate a date 7-10 months in the past
        const staleMonthsAge = Math.floor(Math.random() * 4) + 7;
        const staleDate = subtractFromVietnamTime(staleMonthsAge, 'month');

        // Use update() to bypass TypeORM's @CreateDateColumn behavior
        await this.clinicSubscriptionRepository.update(
          savedSubscription._id,
          {
            createdAt: staleDate,
            updatedAt: staleDate,
            subscriptionDate: staleDate,
          } as any, // Cast to any to bypass entity readonly properties if needed
        );
      }

      createdCount++;
    }

    this.logger.log(
      `✅ ClinicSubscription seeding completed: ${createdCount} created, ${skippedCount} skipped`,
    );
  }

  /**
   * Seed ClinicSubscriptionHistory records
   *
   * Creates 0-2 ClinicSubscriptionHistory records per CLINIC_ADMIN account
   */
  private async seedClinicSubscriptionHistory(
    clinicAdmins: Account[],
    subscriptionServices: SubscriptionService[],
  ): Promise<void> {
    let createdCount = 0;
    let skippedCount = 0;

    for (const clinicAdmin of clinicAdmins) {
      // Check current subscription status - skip if in pending statuses
      const currentSubscription =
        await this.clinicSubscriptionRepository.findByClinicId(clinicAdmin._id);
      const pendingStatuses = [
        RegistrationStatus.PENDING_SEPAY_SETUP,
        RegistrationStatus.PENDING_MANAGER_SETUP,
        RegistrationStatus.PENDING_LEGAL_SETUP,
        RegistrationStatus.PENDING_APPROVAL,
        RegistrationStatus.PENDING_PAYMENT,
      ];
      if (
        currentSubscription &&
        pendingStatuses.includes(currentSubscription.subscriptionStatus)
      ) {
        this.logger.log(
          `Skipping history for ${clinicAdmin._id} (status: ${currentSubscription.subscriptionStatus})`,
        );
        skippedCount++;
        continue;
      }

      // Check if history records already exist for this clinic
      const existingHistoryCount =
        await this.clinicSubscriptionHistoryRepository.count({
          where: { clinicId: clinicAdmin._id },
        });

      if (existingHistoryCount > 0) {
        skippedCount++;
        continue;
      }

      // Randomly decide if this clinic should have history records (0-2 records)
      const historyCount = this.getRandomInt(0, 2);

      for (let i = 0; i < historyCount; i++) {
        // Get random subscription service
        const serviceIndex = this.getRandomInt(
          0,
          subscriptionServices.length - 1,
        );
        const service = subscriptionServices[serviceIndex];

        // Calculate subscription and expiration dates (historical)
        const monthsAgo = this.getRandomInt(1, 12);
        const subscriptionDate = subtractFromVietnamTime(monthsAgo, 'month');

        const expirationDate = addToVietnamTime(12, 'month');

        // Randomly select between EXPIRED and NON_RENEWING for historical records
        // NON_RENEWING: User explicitly cancelled (churn)
        // EXPIRED: Natural expiration (no cancellation)
        const status =
          Math.random() > 0.7
            ? RegistrationStatus.NON_RENEWING
            : RegistrationStatus.EXPIRED;

        // Create clinic subscription history
        const historyRecord = this.clinicSubscriptionHistoryRepository.create({
          clinicId: clinicAdmin._id,
          serviceId: service._id,
          subscriptionDate,
          expirationDate,
          subscriptionStatus: status,
        });

        await this.clinicSubscriptionHistoryRepository.save(historyRecord);
        createdCount++;
      }
    }

    this.logger.log(
      `✅ ClinicSubscriptionHistory seeding completed: ${createdCount} created, ${skippedCount} skipped`,
    );
  }

  /**
   * Seed Hanging (Pending) ClinicSubscription records
   *
   * Creates 15 subscription records with PENDING statuses, backdated 6-12 months ago.
   * These records simulate abandoned/incomplete registrations from the past.
   *
   * Rules:
   * - Status: Randomly selected from PENDING_PAYMENT, PENDING_APPROVAL, PENDING_LEGAL_SETUP,
   *           PENDING_MANAGER_SETUP, PENDING_SEPAY_SETUP
   * - created_at/updated_at: Backdated 6-12 months ago
   * - subscription_date: Set based on status progression (earlier statuses = no date)
   * - expirationDate: null for pending statuses (not activated yet)
   * - Distribute across available clinic admins
   */
  private async seedHangingSubscriptions(
    clinicAdmins: Account[],
    subscriptionServices: SubscriptionService[],
  ): Promise<void> {
    const hangingCount = 15;
    let createdCount = 0;

    // Pending statuses to randomly assign
    const pendingStatuses = [
      RegistrationStatus.PENDING_SEPAY_SETUP,
      RegistrationStatus.PENDING_MANAGER_SETUP,
      RegistrationStatus.PENDING_LEGAL_SETUP,
      RegistrationStatus.PENDING_APPROVAL,
      RegistrationStatus.PENDING_PAYMENT,
    ];

    this.logger.log(`Seeding ${hangingCount} hanging clinic subscriptions...`);

    for (let i = 0; i < hangingCount; i++) {
      // Round-robin clinic selection
      const clinicAdmin = clinicAdmins[i % clinicAdmins.length];

      // Check if this clinic already has a subscription
      const existing = await this.clinicSubscriptionRepository.existsByClinicId(
        clinicAdmin._id,
      );

      if (existing) {
        continue; // Skip this clinic to avoid unique constraint error
      }

      // Random service selection
      const serviceIndex = this.getRandomInt(
        0,
        subscriptionServices.length - 1,
      );
      const service = subscriptionServices[serviceIndex];

      // Random pending status
      const statusIndex = this.getRandomInt(0, pendingStatuses.length - 1);
      const subscriptionStatus = pendingStatuses[statusIndex];

      // Backdate created_at/updated_at: 6-12 months ago
      const monthsAgo = this.getRandomInt(6, 12);
      const backdatedDate = subtractFromVietnamTime(monthsAgo, 'month');

      // subscription_date logic based on status progression:
      // - PENDING_SEPAY_SETUP, PENDING_MANAGER_SETUP: null (registration not complete)
      // - PENDING_LEGAL_SETUP, PENDING_APPROVAL, PENDING_PAYMENT: set to backdated date
      let subscriptionDate: Date | null = null;
      if (
        subscriptionStatus === RegistrationStatus.PENDING_LEGAL_SETUP ||
        subscriptionStatus === RegistrationStatus.PENDING_APPROVAL ||
        subscriptionStatus === RegistrationStatus.PENDING_PAYMENT
      ) {
        subscriptionDate = new Date(backdatedDate);
      }

      // expirationDate: null for all pending statuses (not activated)
      const expirationDate = null;

      // Create hanging clinic subscription
      const hangingSubscription = this.clinicSubscriptionRepository.create({
        clinicId: clinicAdmin._id,
        serviceId: service._id,
        subscriptionDate,
        expirationDate,
        subscriptionStatus,
      });

      // Manually set created_at and updated_at to backdated date
      hangingSubscription.createdAt = backdatedDate;
      hangingSubscription.updatedAt = backdatedDate;

      await this.clinicSubscriptionRepository.save(hangingSubscription);
      createdCount++;
    }

    this.logger.log(
      `✅ Hanging ClinicSubscription seeding completed: ${createdCount} created`,
    );
  }

  /**
   * Seed Hanging SubscriptionHistory records
   *
   * Creates historical records for the hanging subscriptions to reflect past state changes.
   * Each hanging subscription gets 0-2 history records showing previous attempts or status changes.
   */
  private async seedHangingSubscriptionHistory(
    clinicAdmins: Account[],
    subscriptionServices: SubscriptionService[],
  ): Promise<void> {
    const hangingCount = 15;
    let createdCount = 0;

    // Possible historical statuses for abandoned registrations
    const historicalStatuses = [
      RegistrationStatus.PENDING_SEPAY_SETUP,
      RegistrationStatus.PENDING_MANAGER_SETUP,
      RegistrationStatus.PENDING_LEGAL_SETUP,
      RegistrationStatus.EXPIRED, // Previous subscription expired
    ];

    this.logger.log('Seeding hanging subscription history records...');

    for (let i = 0; i < hangingCount; i++) {
      // Match the same clinic admin distribution
      const clinicAdmin = clinicAdmins[i % clinicAdmins.length];

      // Randomly decide how many historical records (0-2)
      const historyCount = this.getRandomInt(0, 2);

      for (let j = 0; j < historyCount; j++) {
        // Random service selection
        const serviceIndex = this.getRandomInt(
          0,
          subscriptionServices.length - 1,
        );
        const service = subscriptionServices[serviceIndex];

        // Random historical status
        const statusIndex = this.getRandomInt(0, historicalStatuses.length - 1);
        const status = historicalStatuses[statusIndex];

        // Backdate further into the past: 12-24 months ago
        const monthsAgo = this.getRandomInt(12, 24);
        const historicalDate = subtractFromVietnamTime(monthsAgo, 'month');

        // subscription_date for historical records
        let subscriptionDate: Date | null = null;
        if (
          status === RegistrationStatus.PENDING_LEGAL_SETUP ||
          status === RegistrationStatus.EXPIRED
        ) {
          subscriptionDate = new Date(historicalDate);
        }

        // expirationDate only for EXPIRED status
        let expirationDate: Date | null = null;
        if (status === RegistrationStatus.EXPIRED && subscriptionDate) {
          expirationDate = new Date(subscriptionDate);
          expirationDate.setFullYear(expirationDate.getFullYear() + 1);
        }

        // Create hanging history record
        const historyRecord = this.clinicSubscriptionHistoryRepository.create({
          clinicId: clinicAdmin._id,
          serviceId: service._id,
          subscriptionDate,
          expirationDate,
          subscriptionStatus: status,
        });

        // Manually set created_at to historical date
        historyRecord.createdAt = historicalDate;
        historyRecord.updatedAt = historicalDate;

        await this.clinicSubscriptionHistoryRepository.save(historyRecord);
        createdCount++;
      }
    }

    this.logger.log(
      `✅ Hanging SubscriptionHistory seeding completed: ${createdCount} created`,
    );
  }

  /**
   * Get random integer between min and max (inclusive)
   */
  private getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Map legal document verification status to subscription registration status
   *
   * Alignment Logic:
   * - NOT_SUBMITTED → PENDING_LEGAL_SETUP (user needs to upload documents)
   * - PENDING_REVIEW → PENDING_APPROVAL (waiting for admin to review)
   * - APPROVED → PENDING_PAYMENT (70%) or ACTIVE (30%) (documents approved, needs payment or already paid)
   * - REJECTED → PENDING_LEGAL_SETUP (needs to resubmit documents)
   */
  private mapLegalStatusToSubscriptionStatus(
    legalStatus: LegalDocumentVerificationStatus,
  ): RegistrationStatus {
    switch (legalStatus) {
      case LegalDocumentVerificationStatus.NOT_SUBMITTED:
        return RegistrationStatus.PENDING_LEGAL_SETUP;

      case LegalDocumentVerificationStatus.PENDING_REVIEW:
        return RegistrationStatus.PENDING_APPROVAL;

      case LegalDocumentVerificationStatus.APPROVED:
        // 70% PENDING_PAYMENT, 30% ACTIVE
        return Math.random() < 0.7
          ? RegistrationStatus.PENDING_PAYMENT
          : RegistrationStatus.ACTIVE;

      case LegalDocumentVerificationStatus.REJECTED:
        return RegistrationStatus.PENDING_LEGAL_SETUP;

      default:
        return RegistrationStatus.PENDING_LEGAL_SETUP;
    }
  }
}
