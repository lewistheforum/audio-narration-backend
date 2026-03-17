import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { join } from 'path';
import { TransactionHistorySeederService } from '../seeders/transaction-history-seeder.service';
import { ClinicSubscription } from '../../modules/subscriptions/entities/clinic-subscription.entity';
import { ClinicSubscriptionHistory } from '../../modules/subscriptions/entities/clinic-subscription-history.entity';
import { Transaction } from '../../modules/transactions/entities/transaction.entity';
import { TransactionType } from '../../modules/transactions/entities/transaction-type.entity';
import { SubscriptionService } from '../../modules/subscriptions/entities/subscription-service.entity';
import { ClinicAdminInformation } from '../../modules/accounts/entities/clinic-admin-information.entity';

async function runAndVerify() {
  console.log('Connecting to database...');
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    username: process.env.POSTGRES_USERNAME || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    database: process.env.POSTGRES_DATABASE || 'bonix_db',
    entities: [join(__dirname, '../../**/*.entity{.ts,.js}')],
    synchronize: false,
    logging: false,
  });

  try {
    await dataSource.initialize();
    console.log('✓ Connected successfully');

    // Instantiate Seeder Service
    const seeder = new TransactionHistorySeederService(
      dataSource.getRepository(ClinicSubscription),
      dataSource.getRepository(ClinicSubscriptionHistory),
      dataSource.getRepository(Transaction),
      dataSource.getRepository(TransactionType),
      dataSource.getRepository(SubscriptionService),
      dataSource.getRepository(ClinicAdminInformation),
    );

    console.log('Running TransactionHistorySeederService.seed()...');
    await seeder.seed();
    console.log('Seeding completed.');

    // Verification
    console.log('Verifying data...');

    // Check TransactionType
    const transactionCounts = await dataSource.query(`
      SELECT count(*) as count FROM transactions_type WHERE code = 'SUBSCRIPTION_PAYMENT'
    `);
    console.log(
      `TransactionType 'SUBSCRIPTION_PAYMENT' count: ${transactionCounts[0].count}`,
    );

    // Check ClinicSubscription
    const subscriptionCounts = await dataSource.query(`
      SELECT count(*) as count FROM clinic_subcriptions
    `);
    const subCount = parseInt(subscriptionCounts[0].count);
    console.log(`ClinicSubscription count: ${subCount}`);

    // Check ClinicSubscriptionHistory
    const historyCounts = await dataSource.query(`
      SELECT count(*) as count FROM clinic_subcriptions_history
    `);
    const histCount = parseInt(historyCounts[0].count);
    console.log(`ClinicSubscriptionHistory count: ${histCount}`);

    // Check Transactions
    const txCounts = await dataSource.query(`
        SELECT count(*) as count FROM transactions 
        WHERE description LIKE 'Payment for % subscription (Historical - Month %)'
    `);
    const txCount = parseInt(txCounts[0].count);
    console.log(`Historical Transactions count: ${txCount}`);

    if (subCount > 0) {
      // We added 10 history records per subscription.
      // Total history should be at least subCount * 10
      if (histCount >= subCount * 10) {
        console.log(
          '✅ PASS: History count is at least 10x subscription count',
        );
      } else {
        console.log(
          '❌ FAIL: History count is NOT at least 10x subscription count',
        );
      }

      if (txCount >= subCount * 10) {
        console.log(
          '✅ PASS: Transaction count is at least 10x subscription count',
        );
      } else {
        console.log(
          '❌ FAIL: Transaction count is NOT at least 10x subscription count',
        );
      }
    } else {
      console.log('⚠️  WARN: No subscriptions found to verify against.');
    }
  } catch (error) {
    console.error('❌ Error during run and verify:', error);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

runAndVerify();
