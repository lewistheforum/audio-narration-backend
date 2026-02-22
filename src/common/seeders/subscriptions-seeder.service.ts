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
        const staleDate = new Date();
        staleDate.setMonth(staleDate.getMonth() - staleMonthsAge);

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
        const subscriptionDate = new Date();
        subscriptionDate.setMonth(subscriptionDate.getMonth() - monthsAgo);

        const expirationDate = new Date(subscriptionDate);
        expirationDate.setFullYear(expirationDate.getFullYear() + 1);

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
