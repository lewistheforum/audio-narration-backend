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

      // Get all subscription services for random package changes
      const allServices = await this.subscriptionServiceRepository.find();

      if (allServices.length === 0) {
        this.logger.warn('No subscription services found. Skipping seeding.');
        return;
      }

      // Get all active clinic subscriptions (mỗi clinic chỉ có 1 subscription)
      const subscriptions = await this.clinicSubscriptionRepository.find();

      if (subscriptions.length === 0) {
        this.logger.warn(
          'No clinic subscriptions found. Skipping transaction history seeding.',
        );
        return;
      }

      let totalHistoryCreated = 0;
      let totalTransactionsCreated = 0;

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

        // Check if history already exists for this clinic
        const existingHistoryCount =
          await this.clinicSubscriptionHistoryRepository.count({
            where: { clinicId: sub.clinicId },
          });

        if (existingHistoryCount > 0) {
          this.logger.log(
            `Skipping transaction history for clinic ${sub.clinicId} (already has ${existingHistoryCount} history records)`,
          );
          continue;
        }

        // Get current service
        let currentService = await this.subscriptionServiceRepository.findOne({
          where: { _id: sub.serviceId },
        });

        if (!currentService) {
          this.logger.warn(`Service not found for subscription ${sub._id}`);
          continue;
        }

        // Generate 5-10 history records for each subscription (mô phỏng lịch sử thanh toán)
        const historyCount = Math.floor(Math.random() * 6) + 5; // 5-10 records

        for (let i = 1; i <= historyCount; i++) {
          // Calculate dates going back in time
          // i=1 => 1 month ago, i=2 => 2 months ago, etc.
          const subscriptionDate = new Date();
          subscriptionDate.setMonth(subscriptionDate.getMonth() - i);

          const expirationDate = new Date(subscriptionDate);
          expirationDate.setFullYear(expirationDate.getFullYear() + 1); // Valid for 1 year

          // Determine history status and service for this period
          let historyStatus: RegistrationStatus;
          let serviceForThisPeriod = currentService;

          // 70% chance of renewal (EXPIRED), 20% package change, 10% cancelled (NON_RENEWING)
          const rand = Math.random();
          
          if (rand < 0.7) {
            // Case 1: Normal renewal - same package
            historyStatus = RegistrationStatus.EXPIRED;
          } else if (rand < 0.9) {
            // Case 2: Package change - switch to different service
            historyStatus = RegistrationStatus.EXPIRED;
            // Pick a different service randomly
            const otherServices = allServices.filter(
              (s) => s._id !== currentService._id,
            );
            if (otherServices.length > 0) {
              serviceForThisPeriod =
                otherServices[Math.floor(Math.random() * otherServices.length)];
            }
          } else {
            // Case 3: Cancelled/Non-renewing
            historyStatus = RegistrationStatus.NON_RENEWING;
          }

          // Create History Record
          const history = this.clinicSubscriptionHistoryRepository.create({
            clinicId: sub.clinicId,
            serviceId: serviceForThisPeriod._id,
            subscriptionDate: subscriptionDate,
            expirationDate: expirationDate,
            subscriptionStatus: historyStatus,
          });

          const savedHistory =
            await this.clinicSubscriptionHistoryRepository.save(history);
          totalHistoryCreated++;

          // Create Transaction Record (1-1 mapping with history)
          const actionType =
            serviceForThisPeriod._id !== currentService._id
              ? 'Package Change'
              : historyStatus === RegistrationStatus.NON_RENEWING
                ? 'Cancelled Subscription'
                : 'Renewal';

          const transaction = this.transactionRepository.create({
            clinicId: sub.clinicId,
            subscriptionId: sub._id, // Link to main subscription
            transactionTypeId: transactionType._id,
            amount: Math.round(Number(serviceForThisPeriod.price)),
            currency: 'VND',
            status: PaymentStatus.SUCCESS,
            transactionDate: subscriptionDate,
            code: `TRANS-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            description: `${actionType} - ${serviceForThisPeriod.serviceName} (${new Date(subscriptionDate).toLocaleDateString('vi-VN')})`,
            transferType: PaymentDirection.OUT,
            gateway: 'SEPAY',
          });

          const savedTransaction =
            await this.transactionRepository.save(transaction);
          totalTransactionsCreated++;

          // Link transaction with history record (1-1 mapping)
          savedHistory.transactionId = savedTransaction.id;
          await this.clinicSubscriptionHistoryRepository.save(savedHistory);

          // Update current service for next iteration
          currentService = serviceForThisPeriod;
        }
      }

      this.logger.log(
        `✅ Transaction history seeding completed: ${totalHistoryCreated} history records, ${totalTransactionsCreated} transactions created`,
      );
    } catch (error) {
      this.logger.error('Failed to seed transaction history', error.stack);
      throw error;
    }
  }
}
