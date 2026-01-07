import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  SubscriptionService,
  ClinicSubscription,
  ClinicSubscriptionHistory,
} from './entities';
import {
  ClinicSubscriptionRepository,
  SubscriptionServiceRepository,
} from './repositories';

/**
 * Subscriptions Module
 *
 * Manages subscription services and clinic subscriptions
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubscriptionService,
      ClinicSubscription,
      ClinicSubscriptionHistory,
    ]),
  ],
  controllers: [],
  providers: [
    ClinicSubscriptionRepository,
    SubscriptionServiceRepository,
  ],
  exports: [
    TypeOrmModule,
    ClinicSubscriptionRepository,
    SubscriptionServiceRepository,
  ],
})
export class SubscriptionsModule {}
