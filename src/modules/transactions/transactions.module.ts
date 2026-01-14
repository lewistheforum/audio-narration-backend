import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicAdminInformation } from '../accounts/entities/clinic-admin-information.entity';
import { Transaction, TransactionType } from './entities';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';

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
    ]),
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TypeOrmModule, TransactionsService],
})
export class TransactionsModule {}
