import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  getCurrentVietnamTime,
  subtractFromVietnamTime,
  getVietnamTimestamp,
  addToDate,
  getDateString,
} from '../utils/date.util';
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
import { TransactionTypeCode } from '../../modules/transactions/entities/transaction-type.entity';
import { Account } from '../../modules/accounts/entities/accounts.entity';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { AccountRole } from '../../modules/accounts/enums';

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
    private readonly accountRepository: AccountRepository,
  ) {}

  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed transaction history...');

      // Get or Create Transaction Type
      let transactionType = await this.transactionTypeRepository.findOne({
        where: { code: TransactionTypeCode.SUBSCRIPTION_PAYMENT },
      });

      if (!transactionType) {
        transactionType = this.transactionTypeRepository.create({
          name: 'Subscription Payment',
          code: TransactionTypeCode.SUBSCRIPTION_PAYMENT,
        });
        await this.transactionTypeRepository.save(transactionType);
      }

      // Get all subscription services for random package changes
      const allServices = await this.subscriptionServiceRepository.find();

      if (allServices.length === 0) {
        this.logger.warn('No subscription services found. Skipping seeding.');
        return;
      }

      // Get all clinic admins to determine admin group
      const allAccounts = await this.accountRepository.findAllAccounts();
      const clinicAdmins = allAccounts.filter(
        (acc) => acc.role === AccountRole.CLINIC_ADMIN,
      );
      const adminClinicMap = new Map<string, number>(); // clinicId -> adminIndex (1-based)

      // Get all clinic managers
      const clinicManagers = allAccounts.filter(
        (acc) => acc.role === AccountRole.CLINIC_MANAGER,
      );
      const managerAdminMap = new Map<string, number>(); // managerId -> adminIndex (1-based)

      for (const admin of clinicAdmins) {
        const adminIndex = clinicAdmins.indexOf(admin) + 1; // 1-10
        // Find managers belonging to this admin
        const adminManagers = clinicManagers.filter(
          (m) => m.parentId === admin._id,
        );
        for (const manager of adminManagers) {
          managerAdminMap.set(manager._id, adminIndex);
          adminClinicMap.set(manager._id, adminIndex);
        }
      }

      // Get all clinic subscriptions
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
        // Determine admin group for this subscription
        const adminIndex = adminClinicMap.get(sub.clinicId) || 0;

        // Group A (Admins 1-4): ACTIVE - create successful transactions
        // Group B (Admins 5-6): EXPIRED - create past successful transactions
        // Group C (Admins 7-8): PENDING - mixed status transactions
        // Group D (Admins 9-10): PENDING_MANAGER_SETUP - pending transactions

        const pendingStatuses = [
          RegistrationStatus.PENDING_SEPAY_SETUP,
          RegistrationStatus.PENDING_MANAGER_SETUP,
          RegistrationStatus.PENDING_LEGAL_SETUP,
          RegistrationStatus.PENDING_APPROVAL,
          RegistrationStatus.PENDING_PAYMENT,
        ];

        // For PENDING subscriptions (Group C/D), create PENDING transaction
        if (pendingStatuses.includes(sub.subscriptionStatus)) {
          const currentService =
            await this.subscriptionServiceRepository.findOne({
              where: { _id: sub.serviceId },
            });

          if (currentService) {
            // Check if transaction already exists for this subscription
            const existingTx = await this.transactionRepository.findOne({
              where: { subscriptionId: sub._id },
            });

            if (!existingTx) {
              const transaction = this.transactionRepository.create({
                clinicId: sub.clinicId,
                subscriptionId: sub._id,
                transactionTypeId: transactionType._id,
                amount: Math.round(Number(currentService.price)),
                currency: 'VND',
                status: PaymentStatus.PENDING,
                transactionDate: getCurrentVietnamTime(),
                code: `TRANS-${getVietnamTimestamp()}-${Math.floor(Math.random() * 10000)}`,
                description: `Subscription payment for ${currentService.serviceName} - Pending setup`,
                transferType: PaymentDirection.OUT,
                gateway: 'SEPAY',
              });

              await this.transactionRepository.save(transaction);
              totalTransactionsCreated++;

              this.logger.log(
                `Created PENDING transaction for subscription ${sub._id} (Admin Group ${adminIndex})`,
              );
            }
          }
          continue;
        }

        // For ACTIVE/EXPIRED subscriptions, create historical transactions
        // Find existing history records
        const existingHistories =
          await this.clinicSubscriptionHistoryRepository.find({
            where: { clinicId: sub.clinicId },
            order: { subscriptionDate: 'ASC' },
          });

        // If histories exist but they don't have transactions, we link transactions to them
        if (existingHistories.length > 0) {
          this.logger.log(
            `Found ${existingHistories.length} existing history records for clinic ${sub.clinicId}. Adding transactions if missing.`,
          );

          let lastServiceId = null;
          for (const history of existingHistories) {
            // Check if transaction already linked
            if (history.transactionId) {
              lastServiceId = history.serviceId;
              continue;
            }

            const currentService =
              await this.subscriptionServiceRepository.findOne({
                where: { _id: history.serviceId },
              });
            if (!currentService) continue;

            const actionType =
              lastServiceId && lastServiceId !== history.serviceId
                ? 'Package Change'
                : history.subscriptionStatus === RegistrationStatus.NON_RENEWING
                  ? 'Cancelled Subscription'
                  : 'Renewal';

            const transaction = this.transactionRepository.create({
              clinicId: sub.clinicId,
              subscriptionId: sub._id,
              transactionTypeId: transactionType._id,
              amount: Math.round(Number(currentService.price)),
              currency: 'VND',
              status: PaymentStatus.SUCCESS,
              transactionDate: history.subscriptionDate || history.createdAt,
              code: `TRANS-${getVietnamTimestamp()}-${Math.floor(Math.random() * 10000)}`,
              description: `${actionType} - ${currentService.serviceName} (${getDateString(history.subscriptionDate || history.createdAt)})`,
              transferType: PaymentDirection.OUT,
              gateway: adminIndex === 1 ? 'SEPAY' : 'BANK_TRANSFER',
            });

            const savedTransaction =
              await this.transactionRepository.save(transaction);
            totalTransactionsCreated++;

            history.transactionId = savedTransaction.id;
            await this.clinicSubscriptionHistoryRepository.save(history);

            lastServiceId = history.serviceId;
          }

          continue;
        }

        // Get current service (if no existing histories)
        let currentService = await this.subscriptionServiceRepository.findOne({
          where: { _id: sub.serviceId },
        });

        if (!currentService) {
          this.logger.warn(`Service not found for subscription ${sub._id}`);
          continue;
        }

        // Generate 15-30 history records for each subscription
        const historyCount = Math.floor(Math.random() * 16) + 15; // 15-30 records

        for (let i = 1; i <= historyCount; i++) {
          // Calculate dates going back in time
          const subscriptionDate = subtractFromVietnamTime(i, 'month');
          const expirationDate = addToDate(subscriptionDate, 1, 'year');

          // Determine history status and service for this period
          let historyStatus: RegistrationStatus;
          let serviceForThisPeriod = currentService;

          // 70% chance of renewal (EXPIRED), 20% package change, 10% cancelled
          const rand = Math.random();

          if (rand < 0.7) {
            historyStatus = RegistrationStatus.EXPIRED;
          } else if (rand < 0.9) {
            historyStatus = RegistrationStatus.EXPIRED;
            const otherServices = allServices.filter(
              (s) => s._id !== currentService._id,
            );
            if (otherServices.length > 0) {
              serviceForThisPeriod =
                otherServices[Math.floor(Math.random() * otherServices.length)];
            }
          } else {
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

          // Create Transaction Record
          const actionType =
            serviceForThisPeriod._id !== currentService._id
              ? 'Package Change'
              : historyStatus === RegistrationStatus.NON_RENEWING
                ? 'Cancelled Subscription'
                : 'Renewal';

          const transaction = this.transactionRepository.create({
            clinicId: sub.clinicId,
            subscriptionId: sub._id,
            transactionTypeId: transactionType._id,
            amount: Math.round(Number(serviceForThisPeriod.price)),
            currency: 'VND',
            status: PaymentStatus.SUCCESS,
            transactionDate: subscriptionDate,
            code: `TRANS-${getVietnamTimestamp()}-${Math.floor(Math.random() * 10000)}`,
            description: `${actionType} - ${serviceForThisPeriod.serviceName} (${subscriptionDate.toLocaleDateString('vi-VN')})`,
            transferType: PaymentDirection.OUT,
            gateway: adminIndex === 1 ? 'SEPAY' : 'BANK_TRANSFER',
          });

          const savedTransaction =
            await this.transactionRepository.save(transaction);
          totalTransactionsCreated++;

          savedHistory.transactionId = savedTransaction.id;
          await this.clinicSubscriptionHistoryRepository.save(savedHistory);

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
