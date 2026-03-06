import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from '../accounts/entities/accounts.entity';
import { ClinicAdminInformation } from '../accounts/entities/clinic-admin-information.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { AppointmentPackage } from '../appointments/entities/appointment-package.entity';
import { ClinicSubscription } from '../subscriptions/entities/clinic-subscription.entity';
import { SubscriptionService } from '../subscriptions/entities/subscription-service.entity';
import { Transaction, TransactionType } from './entities';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { ConfigModule } from '@nestjs/config';
import seepayConfig from '../../config/seepay.config';

import { TransactionRepository } from './repositories/transaction.repository';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

/**
 * Transactions Module
 *
 * Manages payment transactions for subscriptions
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transaction,
      TransactionType,
      ClinicAdminInformation,
      Appointment,
      AppointmentPackage,
      ClinicSubscription,
      SubscriptionService,
      Account,
    ]),
    ConfigModule.forFeature(seepayConfig),
    SubscriptionsModule,
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionRepository],
  exports: [TypeOrmModule, TransactionsService, TransactionRepository],
})
export class TransactionsModule { }
