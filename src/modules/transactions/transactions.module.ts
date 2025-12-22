import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction, TransactionType } from './entities';

/**
 * Transactions Module
 *
 * Manages payment transactions for subscriptions
 */
@Module({
  imports: [TypeOrmModule.forFeature([Transaction, TransactionType])],
  controllers: [],
  providers: [],
  exports: [TypeOrmModule],
})
export class TransactionsModule {}
