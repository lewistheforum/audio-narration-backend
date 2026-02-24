import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClinicSubscription } from '../../modules/subscriptions/entities/clinic-subscription.entity';
import { ClinicSubscriptionHistory } from '../../modules/subscriptions/entities/clinic-subscription-history.entity';
import { Transaction } from '../../modules/transactions/entities/transaction.entity';
import { TransactionType } from '../../modules/transactions/entities/transaction-type.entity';
import { SubscriptionService } from '../../modules/subscriptions/entities/subscription-service.entity';
import { ClinicAdminInformation } from '../../modules/accounts/entities/clinic-admin-information.entity';
import { RegistrationStatus } from '../../modules/subscriptions/enums';
import {
  PaymentStatus,
  PaymentDirection,
} from '../../modules/transactions/entities/transaction.entity';

@Injectable()
export class TransactionHistorySeederService {
  private readonly logger = new Logger(TransactionHistorySeederService.name);

  constructor(
    @InjectRepository(ClinicSubscription)
    private readonly clinicSubscriptionRepository: Repository<ClinicSubscription>,
    @InjectRepository(ClinicSubscriptionHistory)
    private readonly clinicSubscriptionHistoryRepository: Repository<ClinicSubscriptionHistory>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(TransactionType)
    private readonly transactionTypeRepository: Repository<TransactionType>,
    @InjectRepository(SubscriptionService)
    private readonly subscriptionServiceRepository: Repository<SubscriptionService>,
    @InjectRepository(ClinicAdminInformation)
    private readonly clinicAdminInformationRepository: Repository<ClinicAdminInformation>,
  ) {}

  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed transaction history...');

      // Get or Create Transaction Type
      let transactionType = await this.transactionTypeRepository.findOne({
        where: { code: 'SUBSCRIPTION_PAYMENT' },
      });

      if (!transactionType) {
        transactionType = this.transactionTypeRepository.create({
          name: 'Subscription Payment',
          code: 'SUBSCRIPTION_PAYMENT',
        });
        await this.transactionTypeRepository.save(transactionType);
      }

      // Get all active clinic subscriptions
      const subscriptions = await this.clinicSubscriptionRepository.find();

      if (subscriptions.length === 0) {
        this.logger.warn(
          'No clinic subscriptions found. Skipping transaction history seeding.',
        );
        return;
      }

      for (const sub of subscriptions) {
        // Skip subscriptions with pending statuses (no payment was made)
        const pendingStatuses = [
          RegistrationStatus.PENDING_SEPAY_SETUP,
          RegistrationStatus.PENDING_MANAGER_SETUP,
          RegistrationStatus.PENDING_LEGAL_SETUP,
          RegistrationStatus.PENDING_APPROVAL,
          RegistrationStatus.PENDING_PAYMENT,
        ];
        if (pendingStatuses.includes(sub.subscriptionStatus)) {
          this.logger.log(
            `Skipping transaction history for subscription ${sub._id} (status: ${sub.subscriptionStatus})`,
          );
          continue;
        }

        // Find the service to get the price
        const service = await this.subscriptionServiceRepository.findOne({
          where: { _id: sub.serviceId },
        });

        if (!service) {
          this.logger.warn(`Service not found for subscription ${sub._id}`);
          continue;
        }

        // Generate 10 history records for each subscription
        for (let i = 1; i <= 10; i++) {
          // Calculate dates going back in time
          // e.g. i=1 => 1 month ago, i=2 => 2 months ago, etc.
          // Assuming monthly subscriptions for simplicity or just spacing them out
          const subscriptionDate = new Date();
          subscriptionDate.setMonth(subscriptionDate.getMonth() - i);

          const expirationDate = new Date(subscriptionDate);
          expirationDate.setMonth(expirationDate.getMonth() + 1); // Valid for 1 month

          // Create History Record
          const history = this.clinicSubscriptionHistoryRepository.create({
            clinicId: sub.clinicId,
            serviceId: sub.serviceId,
            subscriptionDate: subscriptionDate,
            expirationDate: expirationDate,
            subscriptionStatus: RegistrationStatus.EXPIRED, // Past subscriptions are expired
          });

          const savedHistory =
            await this.clinicSubscriptionHistoryRepository.save(history);

          // Create Transaction Record
          const transaction = this.transactionRepository.create({
            clinicId: sub.clinicId, // Use Account ID from subscription
            subscriptionId: savedHistory._id, // Link to the History record
            transactionTypeId: transactionType._id,
            amount: Math.round(Number(service.price)),
            currency: 'VND',
            status: PaymentStatus.SUCCESS,
            transactionDate: subscriptionDate, // Transaction happened at subscription start
            code: `TRANS-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            description: `Payment for ${service.serviceName} subscription (Historical - Month ${i})`,
            transferType: PaymentDirection.OUT,
            gateway: 'SEPAY', // Assuming generic gateway
          });

          const savedTransaction =
            await this.transactionRepository.save(transaction);

          // Update History with Transaction ID
          savedHistory.transactionId = savedTransaction.id;
          await this.clinicSubscriptionHistoryRepository.save(savedHistory);
        }
      }

      this.logger.log('✅ Transaction history seeding completed');
    } catch (error) {
      this.logger.error('Failed to seed transaction history', error.stack);
      throw error;
    }
  }
}
