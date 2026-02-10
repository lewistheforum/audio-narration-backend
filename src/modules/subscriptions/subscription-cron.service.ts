import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { ClinicSubscriptionRepository } from './repositories/clinic-subscription.repository';
import { ClinicSubscriptionRenewalQueueRepository } from './repositories/clinic-subscription-renewal-queue.repository';
import { MailerService } from '../mailer/mailer.service';
import { RegistrationStatus } from './enums/subscription-status.enum';
import { ClinicSubscription } from './entities/clinic-subscription.entity';
import { ClinicSubscriptionRenewalQueue } from './entities/clinic-subscription-renewal-queue.entity';

/**
 * Subscription Cron Service
 *
 * Automated daily process for subscription management:
 * - Phase 1: Send expiration reminder emails (7-day and 1-day warnings)
 * - Phase 2: Process expired subscriptions (renewals and expirations)
 *
 * Execution: Daily at midnight (00:00:00)
 */
@Injectable()
export class SubscriptionCronService {
  private readonly logger = new Logger(SubscriptionCronService.name);

  constructor(
    private readonly clinicSubscriptionRepository: ClinicSubscriptionRepository,
    private readonly renewalQueueRepository: ClinicSubscriptionRenewalQueueRepository,
    private readonly mailerService: MailerService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Main Cron Entry Point
   * Executes daily at midnight (00:00:00)
   *
   * Orchestrates:
   * 1. Phase 1: Notification engine (read-only)
   * 2. Phase 2: State transition engine (transactional)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailySweeper(): Promise<{
    phase1: { emailsSent: number; emailsFailed: number };
    phase2: { renewalsApplied: number; subscriptionsExpired: number; errors: number };
  }> {
    this.logger.log('🔄 Starting Daily Subscription Sweeper...');
    const startTime = Date.now();

    try {
      // Phase 1: Send expiration reminders (7-day and 1-day warnings)
      const phase1Stats = await this.sendExpirationReminders();
      this.logger.log(
        `✅ Phase 1 Complete: ${phase1Stats.emailsSent} emails sent, ${phase1Stats.emailsFailed} failed`,
      );

      // Phase 2: Process expired subscriptions (renewals and expirations)
      const phase2Stats = await this.processExpiredSubscriptions();
      this.logger.log(
        `✅ Phase 2 Complete: ${phase2Stats.renewalsApplied} renewals, ${phase2Stats.subscriptionsExpired} expired, ${phase2Stats.errors} errors`,
      );

      const duration = Date.now() - startTime;
      this.logger.log(`✅ Daily Subscription Sweeper completed in ${duration}ms`);

      return {
        phase1: phase1Stats,
        phase2: phase2Stats,
      };
    } catch (error) {
      this.logger.error('❌ Daily Subscription Sweeper failed', error.stack);
      throw error;
    }
  }

  /**
   * Phase 1: Notification Engine (Read-Only)
   *
   * Sends reminder emails for subscriptions expiring in:
   * - Exactly 7 days
   * - Exactly 1 day
   *
   * Business Rules:
   * - Only ACTIVE subscriptions receive reminders
   * - EXCLUDE NON_RENEWING subscriptions (silence policy)
   * - Email type varies based on renewal queue existence:
   *   * Queue exists: Reassurance email (renewal scheduled)
   *   * Queue empty: Warning email (action required)
   */
  private async sendExpirationReminders(): Promise<{
    emailsSent: number;
    emailsFailed: number;
  }> {
    this.logger.log('📧 Phase 1: Starting Notification Engine...');
    let emailsSent = 0;
    let emailsFailed = 0;

    try {
      // Find subscriptions expiring in exactly 7 days or 1 day
      const subscriptionsExpiring7Days = await this.findSubscriptionsExpiringInDays(7);
      const subscriptionsExpiring1Day = await this.findSubscriptionsExpiringInDays(1);

      this.logger.log(
        `Found ${subscriptionsExpiring7Days.length} subscriptions expiring in 7 days`,
      );
      this.logger.log(
        `Found ${subscriptionsExpiring1Day.length} subscriptions expiring in 1 day`,
      );

      // Process 7-day reminders
      for (const subscription of subscriptionsExpiring7Days) {
        try {
          await this.sendReminderEmail(subscription, 7);
          emailsSent++;
        } catch (error) {
          this.logger.error(
            `Failed to send 7-day reminder for clinic ${subscription.clinicId}:`,
            error.message,
          );
          emailsFailed++;
        }
      }

      // Process 1-day reminders
      for (const subscription of subscriptionsExpiring1Day) {
        try {
          await this.sendReminderEmail(subscription, 1);
          emailsSent++;
        } catch (error) {
          this.logger.error(
            `Failed to send 1-day reminder for clinic ${subscription.clinicId}:`,
            error.message,
          );
          emailsFailed++;
        }
      }
    } catch (error) {
      this.logger.error('Phase 1 encountered an error:', error.stack);
      throw error;
    }

    return { emailsSent, emailsFailed };
  }

  /**
   * Phase 2: State Transition Engine (Transactional)
   *
   * Process subscriptions that have passed their expiration date:
   * - Status: ACTIVE or NON_RENEWING
   * - Expiration date < NOW()
   *
   * For each expired subscription:
   * 1. Check if renewal queue exists
   * 2. Scenario A (Queue exists): Apply renewal + delete queue
   * 3. Scenario B (Queue empty): Mark as EXPIRED
   * 4. Send appropriate email notification
   *
   * All operations are atomic (QueryRunner transaction)
   */
  private async processExpiredSubscriptions(): Promise<{
    renewalsApplied: number;
    subscriptionsExpired: number;
    errors: number;
  }> {
    this.logger.log('🔄 Phase 2: Starting State Transition Engine...');
    let renewalsApplied = 0;
    let subscriptionsExpired = 0;
    let errors = 0;

    try {
      // Find all expired subscriptions (ACTIVE or NON_RENEWING)
      const expiredSubscriptions = await this.findExpiredSubscriptions();
      this.logger.log(`Found ${expiredSubscriptions.length} expired subscriptions to process`);

      // Process each subscription individually with atomic transaction
      for (const subscription of expiredSubscriptions) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          // Check if renewal queue exists for this clinic
          const renewalQueue = await this.renewalQueueRepository.findByClinicId(
            subscription.clinicId,
          );

          if (renewalQueue) {
            // Scenario A: Renewal (Queue exists)
            await this.applyRenewal(subscription, renewalQueue, queryRunner);
            await queryRunner.commitTransaction();
            renewalsApplied++;

            // Send notification AFTER successful commit
            await this.sendRenewalSuccessEmail(subscription, renewalQueue);
          } else {
            // Scenario B: Expiration (Queue empty)
            await this.applyExpiration(subscription, queryRunner);
            await queryRunner.commitTransaction();
            subscriptionsExpired++;

            // Send notification AFTER successful commit
            await this.sendExpirationEmail(subscription);
          }
        } catch (error) {
          // Rollback transaction on any error
          await queryRunner.rollbackTransaction();
          errors++;
          this.logger.error(
            `Failed to process subscription for clinic ${subscription.clinicId}:`,
            error.stack,
          );
        } finally {
          // Always release the query runner connection
          await queryRunner.release();
        }
      }
    } catch (error) {
      this.logger.error('Phase 2 encountered an error:', error.stack);
      throw error;
    }

    return { renewalsApplied, subscriptionsExpired, errors };
  }

  /**
   * Find subscriptions expiring in exactly N days
   *
   * Criteria:
   * - Status = ACTIVE (EXCLUDE NON_RENEWING per silence policy)
   * - Expiration date is exactly N days from now (date-only comparison)
   */
  private async findSubscriptionsExpiringInDays(
    days: number,
  ): Promise<ClinicSubscription[]> {
    const query = this.dataSource
      .getRepository(ClinicSubscription)
      .createQueryBuilder('subscription')
      .leftJoinAndSelect('subscription.clinic', 'clinic')
      .leftJoinAndSelect('clinic.clinicAdminInformation', 'clinicAdminInformation')
      .leftJoinAndSelect('subscription.service', 'service')
      .where('subscription.subscriptionStatus = :status', {
        status: RegistrationStatus.ACTIVE,
      })
      .andWhere(
        `DATE(subscription.expiration_date) = DATE(NOW() + INTERVAL '${days} days')`,
      );

    return query.getMany();
  }

  /**
   * Find subscriptions that have expired
   *
   * Criteria:
   * - Status IN (ACTIVE, NON_RENEWING)
   * - Expiration date < NOW()
   * - EXCLUDE EXPIRED status (idempotency)
   */
  private async findExpiredSubscriptions(): Promise<ClinicSubscription[]> {
    const query = this.dataSource
      .getRepository(ClinicSubscription)
      .createQueryBuilder('subscription')
      .leftJoinAndSelect('subscription.clinic', 'clinic')
      .leftJoinAndSelect('clinic.clinicAdminInformation', 'clinicAdminInformation')
      .leftJoinAndSelect('subscription.service', 'service')
      .where('subscription.subscriptionStatus IN (:...statuses)', {
        statuses: [RegistrationStatus.ACTIVE, RegistrationStatus.NON_RENEWING],
      })
      .andWhere('subscription.expiration_date < NOW()');

    return query.getMany();
  }

  /**
   * Send reminder email based on days remaining and queue status
   *
   * Email Logic:
   * - 7 days + queue exists: REASSURANCE_7_DAYS
   * - 7 days + no queue: WARNING_7_DAYS
   * - 1 day + queue exists: REASSURANCE_1_DAY
   * - 1 day + no queue: WARNING_1_DAY
   */
  private async sendReminderEmail(
    subscription: ClinicSubscription,
    daysRemaining: number,
  ): Promise<void> {
    // Check if renewal queue exists
    const renewalQueue = await this.renewalQueueRepository.findByClinicId(
      subscription.clinicId,
    );

    const clinicEmail = subscription.clinic?.email;
    const clinicName =
      subscription.clinic?.clinicAdminInformation?.clinicName || 'Clinic';
    const currentPlan = subscription.service?.serviceName || 'Current Plan';

    if (!clinicEmail) {
      this.logger.warn(
        `Cannot send reminder: No email found for clinic ${subscription.clinicId}`,
      );
      return;
    }

    if (renewalQueue) {
      // Reassurance email: Renewal already scheduled
      const upcomingPlan = renewalQueue.nextService?.serviceName || 'New Plan';
      const emailType =
        daysRemaining === 7 ? 'reassurance_7_days' : 'reassurance_1_day';

      this.logger.log(
        `Sending ${emailType} email to ${clinicEmail} (Clinic: ${clinicName})`,
      );

      // TODO: Implement actual email sending with template
      // For now, log the intent
      this.logger.debug(
        `Email Data: Clinic=${clinicName}, CurrentPlan=${currentPlan}, UpcomingPlan=${upcomingPlan}, Days=${daysRemaining}`,
      );
    } else {
      // Warning email: Action required
      const emailType = daysRemaining === 7 ? 'warning_7_days' : 'warning_1_day';

      this.logger.log(
        `Sending ${emailType} email to ${clinicEmail} (Clinic: ${clinicName})`,
      );

      // TODO: Implement actual email sending with template
      // For now, log the intent
      this.logger.debug(
        `Email Data: Clinic=${clinicName}, CurrentPlan=${currentPlan}, ExpirationDate=${subscription.expirationDate}, Days=${daysRemaining}`,
      );
    }
  }

  /**
   * Apply renewal from queue to subscription
   *
   * Atomic Operation:
   * 1. Update ClinicSubscription with new service and dates
   * 2. Delete ClinicSubscriptionRenewalQueue record (cleanup)
   */
  private async applyRenewal(
    subscription: ClinicSubscription,
    renewalQueue: ClinicSubscriptionRenewalQueue,
    queryRunner: any,
  ): Promise<void> {
    this.logger.log(
      `Applying renewal for clinic ${subscription.clinicId}: ${subscription.serviceId} -> ${renewalQueue.nextServiceId}`,
    );

    // Update subscription with renewal data
    await queryRunner.manager.update(
      ClinicSubscription,
      { clinicId: subscription.clinicId },
      {
        serviceId: renewalQueue.nextServiceId,
        subscriptionDate: renewalQueue.targetStartDate,
        expirationDate: renewalQueue.targetEndDate,
        subscriptionStatus: RegistrationStatus.ACTIVE,
      },
    );

    // Delete renewal queue (single-use cleanup)
    await queryRunner.manager.delete(ClinicSubscriptionRenewalQueue, {
      clinicId: subscription.clinicId,
    });

    this.logger.log(`✅ Renewal applied successfully for clinic ${subscription.clinicId}`);
  }

  /**
   * Mark subscription as expired
   *
   * Atomic Operation:
   * - Update ClinicSubscription status to EXPIRED
   * - Keep all other fields unchanged
   */
  private async applyExpiration(
    subscription: ClinicSubscription,
    queryRunner: any,
  ): Promise<void> {
    this.logger.log(`Marking subscription as EXPIRED for clinic ${subscription.clinicId}`);

    await queryRunner.manager.update(
      ClinicSubscription,
      { clinicId: subscription.clinicId },
      {
        subscriptionStatus: RegistrationStatus.EXPIRED,
      },
    );

    this.logger.log(`✅ Subscription expired for clinic ${subscription.clinicId}`);
  }

  /**
   * Send renewal success email
   *
   * Email Type:
   * - RENEWAL_SUCCESS: Same service (simple renewal)
   * - PLAN_CHANGE_SUCCESS: Different service (upgrade/downgrade)
   */
  private async sendRenewalSuccessEmail(
    subscription: ClinicSubscription,
    renewalQueue: ClinicSubscriptionRenewalQueue,
  ): Promise<void> {
    const clinicEmail = subscription.clinic?.email;
    const clinicName =
      subscription.clinic?.clinicAdminInformation?.clinicName || 'Clinic';

    if (!clinicEmail) {
      this.logger.warn(
        `Cannot send renewal email: No email found for clinic ${subscription.clinicId}`,
      );
      return;
    }

    const isPlanChange = subscription.serviceId !== renewalQueue.nextServiceId;
    const emailType = isPlanChange ? 'plan_change_success' : 'renewal_success';

    this.logger.log(
      `Sending ${emailType} email to ${clinicEmail} (Clinic: ${clinicName})`,
    );

    // TODO: Implement actual email sending with template
    // For now, log the intent
    this.logger.debug(
      `Email Data: Clinic=${clinicName}, OldPlan=${subscription.service?.serviceName}, NewPlan=${renewalQueue.nextService?.serviceName}`,
    );
  }

  /**
   * Send subscription expired email
   */
  private async sendExpirationEmail(subscription: ClinicSubscription): Promise<void> {
    const clinicEmail = subscription.clinic?.email;
    const clinicName =
      subscription.clinic?.clinicAdminInformation?.clinicName || 'Clinic';
    const expiredPlan = subscription.service?.serviceName || 'Subscription Plan';

    if (!clinicEmail) {
      this.logger.warn(
        `Cannot send expiration email: No email found for clinic ${subscription.clinicId}`,
      );
      return;
    }

    this.logger.log(
      `Sending subscription_expired email to ${clinicEmail} (Clinic: ${clinicName})`,
    );

    // TODO: Implement actual email sending with template
    // For now, log the intent
    this.logger.debug(
      `Email Data: Clinic=${clinicName}, ExpiredPlan=${expiredPlan}, ExpirationDate=${subscription.expirationDate}`,
    );
  }
}
