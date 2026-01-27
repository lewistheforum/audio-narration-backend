import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../../modules/accounts/entities/accounts.entity';
import { AccountRole } from '../../modules/accounts/enums';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
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
 * - Create 1-2 ClinicSubscription records per CLINIC_ADMIN account
 * - Create 0-2 ClinicSubscriptionHistory records per CLINIC_ADMIN account
 * - Distribute records across clinic admins evenly (round-robin)
 * - Must be idempotent (re-run safe)
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
   * Creates 1-2 ClinicSubscription records per CLINIC_ADMIN account
   */
  private async seedClinicSubscriptions(
    clinicAdmins: Account[],
    subscriptionServices: SubscriptionService[],
  ): Promise<void> {
    let createdCount = 0;
    let skippedCount = 0;

    for (const clinicAdmin of clinicAdmins) {
      // Check if subscription already exists for this clinic
      const existing =
        await this.clinicSubscriptionRepository.existsByClinicId(clinicAdmin._id);

      if (existing) {
        skippedCount++;
        continue;
      }

      // Get random subscription service (round-robin distribution)
      const serviceIndex = createdCount % subscriptionServices.length;
      const service = subscriptionServices[serviceIndex];

      // Calculate subscription and expiration dates
      const subscriptionDate = new Date();
      const expirationDate = new Date();
      expirationDate.setFullYear(expirationDate.getFullYear() + 1);

      // Create clinic subscription
      const clinicSubscription = this.clinicSubscriptionRepository.create({
        clinicId: clinicAdmin._id,
        serviceId: service._id,
        subscriptionDate,
        expirationDate,
        subscriptionStatus: RegistrationStatus.ACTIVE,
      });

      await this.clinicSubscriptionRepository.save(clinicSubscription);
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
        const serviceIndex = this.getRandomInt(0, subscriptionServices.length - 1);
        const service = subscriptionServices[serviceIndex];

        // Calculate subscription and expiration dates (historical)
        const monthsAgo = this.getRandomInt(1, 12);
        const subscriptionDate = new Date();
        subscriptionDate.setMonth(subscriptionDate.getMonth() - monthsAgo);

        const expirationDate = new Date(subscriptionDate);
        expirationDate.setFullYear(expirationDate.getFullYear() + 1);

        // Randomly select a status for history (expired or cancelled)
        const status = Math.random() > 0.5 ? RegistrationStatus.EXPIRED : RegistrationStatus.CANCELLED;

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
}
