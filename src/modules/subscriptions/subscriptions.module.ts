import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import {
  SubscriptionService,
  ClinicSubscription,
  ClinicSubscriptionHistory,
  ClinicSubscriptionRenewalQueue,
} from './entities';
import {
  ClinicSubscriptionRepository,
  ClinicSubscriptionHistoryRepository,
  SubscriptionServiceRepository,
  ClinicSubscriptionRenewalQueueRepository,
} from './repositories';
import { SubscriptionServicesController } from './subscription-services.controller';
import { SubscriptionInternalController } from './subscription-internal.controller';
import { SubscriptionServicesService } from './subscription-services.service';
import { SubscriptionCronService } from './subscription-cron.service';
import { AuthModule } from '../auth/auth.module';
import { MailerModule } from '../mailer/mailer.module';

/**
 * Subscriptions Module
 *
 * Manages subscription services, clinic subscriptions, and automated subscription processing
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubscriptionService,
      ClinicSubscription,
      ClinicSubscriptionHistory,
      ClinicSubscriptionRenewalQueue,
    ]),
    ScheduleModule.forRoot(),
    forwardRef(() => AuthModule),
    MailerModule,
  ],
  controllers: [SubscriptionServicesController, SubscriptionInternalController],
  providers: [
    ClinicSubscriptionRepository,
    ClinicSubscriptionHistoryRepository,
    SubscriptionServiceRepository,
    ClinicSubscriptionRenewalQueueRepository,
    SubscriptionServicesService,
    SubscriptionCronService,
  ],
  exports: [
    TypeOrmModule,
    ClinicSubscriptionRepository,
    ClinicSubscriptionHistoryRepository,
    SubscriptionServiceRepository,
    ClinicSubscriptionRenewalQueueRepository,
    SubscriptionServicesService,
    SubscriptionCronService,
  ],
})
export class SubscriptionsModule {}
