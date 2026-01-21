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
import { SubscriptionServicesController } from './subscription-services.controller';
import { SubscriptionServicesService } from './subscription-services.service';

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
  controllers: [SubscriptionServicesController],
  providers: [
    ClinicSubscriptionRepository,
    SubscriptionServiceRepository,
    SubscriptionServicesService,
  ],
  exports: [
    TypeOrmModule,
    ClinicSubscriptionRepository,
    SubscriptionServiceRepository,
  ],
})
export class SubscriptionsModule {}
