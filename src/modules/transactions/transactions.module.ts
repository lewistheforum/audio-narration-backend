import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicAdminInformation } from '../accounts/entities/clinic-admin-information.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { ClinicSubscriptionHistory } from '../subscriptions/entities/clinic-subscription-history.entity';
import { SubscriptionService } from '../subscriptions/entities/subscription-service.entity';
import { Transaction, TransactionType } from './entities';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { ConfigModule } from '@nestjs/config';
import seepayConfig from '../../config/seepay.config';

import { TransactionRepository } from './repositories/transaction.repository';

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
      ClinicSubscriptionHistory,
      SubscriptionService,
    ]),
    ConfigModule.forFeature(seepayConfig),
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionRepository],
  exports: [TypeOrmModule, TransactionsService],
})
export class TransactionsModule { }
