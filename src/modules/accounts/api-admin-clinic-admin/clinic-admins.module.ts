import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicAdminsController } from './clinic-admins.controller';
import { ClinicAdminsService } from './clinic-admins.service';
import { Account } from '../entities/accounts.entity';
import { ClinicAdminInformation } from '../entities/clinic-admin-information.entity';
import { ClinicSubscription } from '../../subscriptions/entities/clinic-subscription.entity';
import { ClinicSubscriptionHistory } from '../../subscriptions/entities/clinic-subscription-history.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { ClinicServiceConfig } from '../../service-configs/entities/clinic-service-config.entity';
import { ClinicService } from '../../clinic-services/entities/clinic-service.entity';
import { ClinicServiceCategory } from '../../clinic-services/entities/clinic-service-category.entity';
import { BanHistory } from '../../accounts/entities/ban-history.entity';
import { MailerModule } from '../../mailer/mailer.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Account,
      ClinicAdminInformation,
      ClinicSubscription,
      ClinicSubscriptionHistory,
      Transaction,
      ClinicServiceConfig,
      ClinicService,
      ClinicServiceCategory,
      BanHistory,
    ]),
    MailerModule,
  ],
  controllers: [ClinicAdminsController],
  providers: [ClinicAdminsService],
})
export class ClinicAdminsModule {}
