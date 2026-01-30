import { Injectable, Logger } from '@nestjs/common';
import { SubscriptionService } from '../../modules/subscriptions/entities/subscription-service.entity';
import { SubscriptionServiceRepository } from '../../modules/subscriptions/repositories/subscription-service.repository';
import { SUBSCRIPTION_SERVICES } from '../constants/subscription-terms';

/**
 * SubscriptionService Seeder Service
 *
 * Seeds subscription service records for clinics.
 *
 * Seeding Rules:
 * - Creates 4 subscription service records (BASIC, STANDARD, PREMIUM, ENTERPRISE)
 * - Must be idempotent (re-run safe)
 * - SubscriptionService has no clinicId field
 *
 * Idempotent: Uses check-then-insert pattern by count
 */
@Injectable()
export class SubscriptionServiceSeederService {
  private readonly logger = new Logger(SubscriptionServiceSeederService.name);

  constructor(
    private readonly subscriptionServiceRepository: SubscriptionServiceRepository,
  ) {}

  /**
   * Seed subscription services
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
   */
  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed subscription services...');

      // Check if subscription services already exist
      const existingCount = await this.subscriptionServiceRepository.findAll();
      if (existingCount.length >= 4) {
        this.logger.log(
          `Subscription services already exist (${existingCount.length}). Skipping seeding.`,
        );
        return;
      }

      this.logger.log('Seeding 4 subscription services...');

      // Create subscription service records
      const subscriptionServices: SubscriptionService[] = SUBSCRIPTION_SERVICES.map(
        (service) => this.subscriptionServiceRepository.create(service),
      );

      // Save all subscription services
      for (const service of subscriptionServices) {
        await this.subscriptionServiceRepository.save(service);
      }

      this.logger.log(`✅ Created ${subscriptionServices.length} subscription services`);
    } catch (error) {
      this.logger.error('Failed to seed subscription services', error.stack);
      throw error;
    }
  }
}
