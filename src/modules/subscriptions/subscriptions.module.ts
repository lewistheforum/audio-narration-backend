import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  SubscriptionService,
  ClinicSubscription,
  ClinicSubscriptionHistory,
} from './entities';
import {
  ClinicSubscriptionRepository,
  ClinicSubscriptionHistoryRepository,
  SubscriptionServiceRepository,
} from './repositories';
import { SubscriptionServicesController } from './subscription-services.controller';
import { SubscriptionServicesService } from './subscription-services.service';
import { AuthModule } from '../auth/auth.module';

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
    forwardRef(() => AuthModule),
  ],
  controllers: [SubscriptionServicesController],
  providers: [
    ClinicSubscriptionRepository,
    ClinicSubscriptionHistoryRepository,
    SubscriptionServiceRepository,
    SubscriptionServicesService,
  ],
  exports: [
    TypeOrmModule,
    ClinicSubscriptionRepository,
    ClinicSubscriptionHistoryRepository,
    SubscriptionServiceRepository,
  ],
})
export class SubscriptionsModule {}
