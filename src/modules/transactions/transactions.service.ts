import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { AppointmentsService } from '../appointments/appointments.service';
import { AppointmentWebhookService } from '../appointments/appointment-webhook.service';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { URLSearchParams } from 'url';
import { Repository, Like } from 'typeorm';
import {
  getCurrentVietnamTime,
  addToVietnamTime,
  formatToVietnamTime,
  getStartOfDay,
  parseVietnamTime,
  getVietnamTimestamp,
} from 'src/common/utils/date.util';
import { ClinicAdminInformation } from '../accounts/entities/clinic-admin-information.entity';
import { PaymentDirection, PaymentStatus, TransactionType, TransactionTypeCode } from './entities';
import { RegistrationStatus } from '../subscriptions/enums';
import {
  CreateTransactionDto,
  PaymentResponseDto,
  SeepayCallbackDto,
  CreateSubscriptionTransactionDto,
} from './dto';
import { Appointment } from '../appointments/entities/appointment.entity';
import { TransactionRepository } from './repositories/transaction.repository';
import { AppointmentPackage } from '../appointments/entities/appointment-package.entity';
import { AppointmentStatus, AppointmentPackageStatus, PaymentType } from '../appointments/enums';
import { ClinicSubscription } from '../subscriptions/entities/clinic-subscription.entity';
import { SubscriptionService } from '../subscriptions/entities/subscription-service.entity';
import { SubscriptionServicesService } from '../subscriptions/subscription-services.service';
import { Account } from '../accounts/entities/accounts.entity';
import { BookingSessionService } from '../appointments/booking-session.service';
import { ManagerRevenueReportDto, RevenuePeriod } from './dto/manager-revenue-report.dto';
import * as XLSX from 'xlsx';
import { CreateTransactionAtClinicDto } from './dto/create-transaction-at-clinic.dto';

/**
 * Transactions Service
 *
 * Handles business logic for payments, QR generation, and Seepay webhooks.
 */
@Injectable()
export class TransactionsService {
  private readonly qrBaseUrl: string;
  private readonly seepayAccount: string;
  private readonly seepayBank: string;
  private readonly qrExpireMinutes: number;

  constructor(
    private readonly transactionRepository: TransactionRepository,
    @InjectRepository(ClinicAdminInformation)
    private readonly clinicAdminRepo: Repository<ClinicAdminInformation>,
    @InjectRepository(AppointmentPackage)
    private readonly packageRepo: Repository<AppointmentPackage>,
    @InjectRepository(TransactionType)
    private readonly transactionTypeRepo: Repository<TransactionType>,
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    @InjectRepository(ClinicSubscription)
    private readonly clinicSubscriptionRepo: Repository<ClinicSubscription>,
    @InjectRepository(SubscriptionService)
    private readonly subscriptionServiceRepo: Repository<SubscriptionService>,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    private readonly configService: ConfigService,
    private readonly subscriptionServicesService: SubscriptionServicesService,
    private readonly bookingSessionService: BookingSessionService,
    @Inject(forwardRef(() => AppointmentsService))
    private readonly appointmentsService: AppointmentsService,
    private readonly appointmentWebhookService: AppointmentWebhookService,
  ) {
    this.qrBaseUrl = this.configService.get<string>('SEEPAY_QR_BASE') || '';
    this.seepayAccount = this.configService.get<string>('SEEPAY_ACC') || '';
    this.seepayBank = this.configService.get<string>('SEEPAY_BANK') || '';
    this.qrExpireMinutes = Number(
      this.configService.get<number>('SEEPAY_QR_EXPIRE_MINUTES') || 15,
    );
  }

  /**
   * Create payment QR for a subscription
   */
  async createSubscriptionQr(
    dto: CreateSubscriptionTransactionDto,
  ): Promise<PaymentResponseDto> {
    // 1. Get Subscription (Source of Truth)
    const subscription = await this.clinicSubscriptionRepo.findOne({
      where: { _id: dto.subscriptionId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    let transaction: any;

    // 2. Delegate to Specific Handlers (SOLID Principle)
    if (dto.serviceId && dto.serviceId !== subscription.serviceId) {
      // Case A: Package Change (Upgrade/Downgrade)
      transaction = await this.handlePackageChangeTransaction(
        subscription,
        dto.serviceId,
      );
    } else {
      // Case B: Renewal (Same Package)
      transaction = await this.handleRenewalTransaction(subscription);
    }

    // 3. Generate QR for the Created/Found Transaction (Use SYSTEM CONFIG for Subscriptions)
    const { acc, bank } = { acc: this.seepayAccount, bank: this.seepayBank };

    if (!acc || !bank) {
      throw new BadRequestException(
        'System SePay configuration is missing (SEEPAY_ACC, SEEPAY_BANK)',
      );
    }

    const description = transaction.id;
    const expiresAt = this.computeExpireTime();

    const qrCodeUrl = this.buildQrUrl(
      transaction.amount,
      description,
      acc,
      bank,
    );
    const qrPayload = this.buildQrPayload(
      transaction.amount,
      description,
      acc,
      bank,
    );

    return new PaymentResponseDto({
      id: transaction.id,
      amount: transaction.amount,
      currency: 'VND',
      status: transaction.status,
      qrCodeUrl,
      qrPayload,
      expiresAt,
    });
  }

  /**
   * Create Renewal QR
   * Wrapper for handleRenewalTransaction to be used by Controller
   * Renewal always uses 1 month duration by default
   * @param clinicId Clinic ID
   */
  async createRenewalQr(
    clinicId: string,
    duration?: number,
  ): Promise<PaymentResponseDto> {
    const subscription = await this.clinicSubscriptionRepo.findOne({
      where: { clinicId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found for this clinic');
    }

    // Check if there's already a renewal in the queue
    const hasQueue =
      await this.subscriptionServicesService.getRenewalQueueByClinicId(clinicId);
    if (hasQueue) {
      throw new BadRequestException(
        'A renewal or package change is already queued for this clinic. Please wait for the current queued package to be activated.',
      );
    }

    const now = getCurrentVietnamTime();
    const isActive =
      subscription.subscriptionStatus === RegistrationStatus.ACTIVE;
    const isNotExpired =
      subscription.expirationDate &&
      subscription.expirationDate > now;

    if (isActive && isNotExpired) {
      // throw new BadRequestException('Subscription is still active. Renewal is only allowed after expiration.');
      console.log(
        'Allowing renewal for active subscription: Queueing logic will apply on payment success.',
      );
    }

    const transaction = await this.handleRenewalTransaction(
      subscription,
      duration,
    );
    return this.generateQrResponse(subscription, transaction);
  }

  /**
   * Create New Subscription QR (Onboarding)
   * Intended for "Buy New" flow (e.g., first payment)
   * @param clinicId Clinic ID
   * @param serviceId Target service ID
   * @param duration Duration in months (default 1, max 12)
   */
  async createNewSubscriptionQr(
    clinicId: string,
    serviceId: string,
    duration: number = 1,
  ): Promise<PaymentResponseDto> {
    // 1. Get or Create Subscription (Source of Truth)
    let subscription = await this.clinicSubscriptionRepo.findOne({
      where: { clinicId },
    });

    // Case A: Subscription does not exist (New Clinic) -> Create PENDING
    if (!subscription) {
      console.log(
        `[createNewSubscriptionQr] Creating new subscription record for clinic ${clinicId}`,
      );
      subscription = this.clinicSubscriptionRepo.create({
        clinicId,
        serviceId, // Set initial service intent
        subscriptionStatus: RegistrationStatus.PENDING_SEPAY_SETUP, // Default status
        subscriptionDate: getCurrentVietnamTime(),
        expirationDate: getCurrentVietnamTime(), // Expired by default until paid
      });
      subscription = await this.clinicSubscriptionRepo.save(subscription);
    }

    // Case B: Exist but Active & Valid (User mistake?)
    const now = getCurrentVietnamTime();

    // Check if there's already a renewal in the queue
    const hasQueue =
      await this.subscriptionServicesService.getRenewalQueueByClinicId(clinicId);
    if (hasQueue) {
      throw new BadRequestException(
        'A renewal or package change is already queued for this clinic. Please wait for the current queued package to be activated.',
      );
    }

    const isActive =
      subscription.subscriptionStatus === RegistrationStatus.ACTIVE;
    const isNotExpired =
      subscription.expirationDate &&
      subscription.expirationDate > now;

    if (isActive && isNotExpired) {
      throw new BadRequestException(
        'Current subscription is still active. Please use "Renew" or "Change Package" features.',
      );
    }

    // Case C: Exist but Expired/Pending -> Allow "New" Subscription logic
    const transaction = await this.handlePackageChangeTransaction(
      subscription,
      serviceId,
      duration,
    );

    return this.generateQrResponse(subscription, transaction);
  }

  /**
   * Create Package Change QR
   * Wrapper for handlePackageChangeTransaction to be used by Controller
   * @param clinicId Clinic ID
   * @param targetServiceId Target service ID
   * @param duration Duration in months (default 1, max 12)
   */
  async createPackageChangeQr(
    clinicId: string,
    targetServiceId: string,
    duration: number = 1,
  ): Promise<PaymentResponseDto> {
    const subscription = await this.clinicSubscriptionRepo.findOne({
      where: { clinicId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found for this clinic');
    }

    // Check if there's already a renewal in the queue
    const hasQueue =
      await this.subscriptionServicesService.getRenewalQueueByClinicId(clinicId);
    if (hasQueue) {
      throw new BadRequestException(
        'A renewal or package change is already queued for this clinic. Please wait for the current queued package to be activated.',
      );
    }

    const transaction = await this.handlePackageChangeTransaction(
      subscription,
      targetServiceId,
      duration,
    );
    return this.generateQrResponse(subscription, transaction);
  }

  /**
   * Helper to generate QR Response from Transaction
   */
  async generateQrResponse(
    subscription: ClinicSubscription,
    transaction: any,
  ): Promise<PaymentResponseDto> {
    // USE SYSTEM CONFIG FOR SUBSCRIPTIONS (Company Account)
    const { acc, bank } = { acc: this.seepayAccount, bank: this.seepayBank };

    if (!acc || !bank) {
      throw new BadRequestException(
        'System SePay configuration is missing (SEEPAY_ACC, SEEPAY_BANK)',
      );
    }

    const description = transaction.id;
    const expiresAt = this.computeExpireTime();

    const qrCodeUrl = this.buildQrUrl(
      transaction.amount,
      description,
      acc,
      bank,
    );
    const qrPayload = this.buildQrPayload(
      transaction.amount,
      description,
      acc,
      bank,
    );

    return new PaymentResponseDto({
      id: transaction.id,
      amount: transaction.amount,
      currency: 'VND',
      status: transaction.status,
      qrCodeUrl,
      qrPayload,
      expiresAt,
    });
  }

  /**
   * Handle Package Change Transaction Logic
   * @param subscription Current subscription
   * @param targetServiceId Target service ID
   * @param duration Duration in months (default 1)
   */
  async handlePackageChangeTransaction(
    subscription: ClinicSubscription,
    targetServiceId: string,
    duration: number = 1,
  ): Promise<any> {
    // 1. Get Target Service
    const service = await this.subscriptionServiceRepo.findOne({
      where: { _id: targetServiceId },
    });
    if (!service) throw new NotFoundException('Target service not found');

    // 2. Calculate Amount: price * duration (Apply discount)
    const discount = service.discount ? parseFloat(service.discount.toString()) : 0;
    const finalPrice = service.price - (service.price * discount) / 100;
    const amount = finalPrice * duration;

    // 3. Create Transaction Content (store targetServiceId AND duration for later processing)
    const content = JSON.stringify({ targetServiceId, duration });

    // 4. Create or Update Transaction
    return this.createOrUpdateTransaction(
      subscription,
      amount,
      content,
      `Upgrade/Downgrade to ${service.serviceName} (${duration} tháng)`,
    );
  }

  /**
   * Handle Renewal Transaction Logic
   * Renewal always uses 1 month duration
   * @param subscription Current subscription
   */
  async handleRenewalTransaction(
    subscription: ClinicSubscription,
    duration?: number,
  ): Promise<any> {
    // 1. Get Current Service
    const service = await this.subscriptionServiceRepo.findOne({
      where: { _id: subscription.serviceId },
    });
    if (!service) throw new NotFoundException('Current service not found');

    // 3. Calculate/Set Duration
    if (!duration) {
      // If no duration provided, calculate from current subscription dates
      const startDate = subscription.subscriptionDate;
      const expirationDate = subscription.expirationDate;

      // Calculate months difference
      duration = (expirationDate.getFullYear() - startDate.getFullYear()) * 12;
      duration -= startDate.getMonth();
      duration += expirationDate.getMonth();

      // Ensure duration is at least 1
      duration = duration <= 0 ? 1 : duration;

      console.log(
        `[DEBUG] Calculated base renewal duration: ${duration} months (Start: ${formatToVietnamTime(startDate)}, End: ${formatToVietnamTime(expirationDate)})`,
      );
    } else {
      duration = Math.max(1, duration);
      console.log(`[DEBUG] Using provided renewal duration: ${duration} months`);
    }

    // 2. Calculate Amount: price * duration (Apply discount)
    const discount = service.discount ? parseFloat(service.discount.toString()) : 0;
    const finalPrice = service.price - (service.price * discount) / 100;
    const amount = finalPrice * duration;

    // 3. Content
    const content = JSON.stringify({ duration });

    // 4. Create or Update Transaction
    return this.createOrUpdateTransaction(
      subscription,
      amount,
      content,
      `Renewal for ${service.serviceName} (${duration} months)`,
    );
  }

  /**
   * Universal Helper to Create/Update Payment Transaction
   */
  async createOrUpdateTransaction(
    subscription: ClinicSubscription,
    amount: number,
    content: string,
    description: string,
  ): Promise<any> {
    // Ensure amount is integer (remove decimals like .00)
    const safeAmount = Math.round(Number(amount));

    // Get Clinic Admin ID
    const clinicAdmin = await this.clinicAdminRepo.findOne({
      where: { accountId: subscription.clinicId },
    });
    if (!clinicAdmin) throw new NotFoundException('Clinic Admin not found');

    // Check for pending transaction
    let transaction = await this.transactionRepository.findOne({
      where: {
        subscriptionId: subscription._id,
        status: PaymentStatus.PENDING,
      },
    });

    if (!transaction) {
      const transactionType = await this.transactionTypeRepo.findOne({
        where: { code: TransactionTypeCode.SUBSCRIPTION_PAYMENT },
      });
      if (!transactionType) {
        throw new NotFoundException('Transaction Type SUBSCRIPTION PAYMENT not found');
      }

      transaction = this.transactionRepository.create({
        amount: safeAmount,
        currency: 'VND',
        status: PaymentStatus.PENDING,
        clinicId: clinicAdmin.accountId, // <-- FIX: Use accountId mapped to accounts table
        subscriptionId: subscription._id,
        content,
        transactionTypeId: transactionType._id,
        description,
      });
      transaction = await this.transactionRepository.save(transaction);
    } else {
      // Update existing
      transaction.amount = safeAmount;
      transaction.content = content;
      transaction.description = description;
      transaction = await this.transactionRepository.save(transaction);
    }
    return transaction;
  }

  /**
   * Create a dynamic payment QR for a prescription
   */
  async createDynamicQr(
    dto: CreateTransactionDto,
  ): Promise<PaymentResponseDto> {
    // Verify appointment and get real amount & clinic
    const appointment = await this.appointmentRepository.findOne({
      where: { _id: dto.appointmentId },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    let clinicAdminId: string | undefined;
    if (appointment?.clinicId) {
      // Find the CLINIC_MANAGER account
      const managerAccount = await this.accountRepository.findOne({
        where: { _id: appointment.clinicId },
      });

      if (managerAccount && managerAccount.parentId) {
        // Resolve CLINIC_ADMIN info using the parentId
        const clinicAdmin = await this.clinicAdminRepo.findOne({
          where: { accountId: managerAccount.parentId },
        });
        clinicAdminId = clinicAdmin?._id;
      }
    }

    const { acc, bank } = await this.resolveSepayConfig(clinicAdminId);

    // Calculate sum of all pending packages for this appointment
    const pendingPackages = await this.packageRepo.find({
      where: {
        appointmentId: dto.appointmentId,
        status: AppointmentPackageStatus.PENDING_PAYMENT
      }
    });

    if (pendingPackages.length === 0) {
      throw new BadRequestException('No pending payments for this appointment');
    }

    const amount = pendingPackages.reduce((sum, pkg) => sum + Number(pkg.amount), 0);
    // Calculated from the source of truth in DB packages

    const expiresAt = this.computeExpireTime();
    const qrCodeUrl = this.buildQrUrl(amount, dto.appointmentId, acc, bank);
    const qrPayload = this.buildQrPayload(
      amount,
      dto.appointmentId,
      acc,
      bank,
    );

    return new PaymentResponseDto({
      id: null,
      amount: amount,
      currency: 'VND',
      status: PaymentStatus.PENDING,
      qrCodeUrl,
      qrPayload,
      expiresAt,
    });
  }

  /**
   * Create a dynamic payment QR for a prescription
   */
  async createDynamicQrAtClinic(
    dto: CreateTransactionAtClinicDto,
  ): Promise<PaymentResponseDto> {
    // Verify appointment and get real amount & clinic
    const appointment = await this.appointmentRepository.findOne({
      where: { _id: dto.appointmentId },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    let clinicAdminId: string | undefined;
    if (appointment?.clinicId) {
      // Find the CLINIC_MANAGER account
      const managerAccount = await this.accountRepository.findOne({
        where: { _id: appointment.clinicId },
      });

      if (managerAccount && managerAccount.parentId) {
        // Resolve CLINIC_ADMIN info using the parentId
        const clinicAdmin = await this.clinicAdminRepo.findOne({
          where: { accountId: managerAccount.parentId },
        });
        clinicAdminId = clinicAdmin?._id;
      }
    }

    const { acc, bank } = await this.resolveSepayConfig(clinicAdminId);

    // Calculate sum of all pending packages for this appointment
    const pendingPackages = await this.packageRepo.find({
      where: {
        appointmentId: dto.appointmentId,
        status: AppointmentPackageStatus.PENDING_PAYMENT
      }
    });

    if (pendingPackages.length === 0) {
      throw new BadRequestException('No pending payments for this appointment');
    }

    const amount = pendingPackages.reduce((sum, pkg) => sum + Number(pkg.amount), 0);
    // Calculated from the source of truth in DB packages

    // Expire any existing pending transactions for this appointment to prevent spam
    await this.transactionRepository.update(
      {
        appointmentId: dto.appointmentId,
        status: PaymentStatus.PENDING,
      },
      {
        status: PaymentStatus.EXPIRED,
      }
    );

    const expiresAt = this.computeExpireTime();
    const qrCodeUrl = this.buildQrUrl(amount, dto.appointmentId, acc, bank);
    const qrPayload = JSON.stringify({
      amount: amount,
      description: dto.note || `Payment for appointment ${dto.appointmentId}`,
      appointmentId: dto.appointmentId,
      clinicId: dto.clinicId || appointment.clinicId,
    });

    let transaction = this.transactionRepository.create({
      appointmentId: dto.appointmentId,
      clinicId: dto.clinicId || appointment.clinicId,
      amount,
      currency: 'VND',
      status: PaymentStatus.PENDING,
    });
    transaction = await this.transactionRepository.save(transaction);

    // Map the new transaction ID back to the pending packages
    for (const pkg of pendingPackages) {
      pkg.transactionId = transaction.id;
      await this.packageRepo.save(pkg);
    }

    return new PaymentResponseDto({
      id: transaction.id,
      amount: amount,
      currency: 'VND',
      status: PaymentStatus.PENDING,
      qrCodeUrl,
      qrPayload,
      expiresAt,
    });
  }

  /**
   * Create a small verification QR (10k) to verify clinic bank account
   */
  async createVerificationQr(clinicId: string): Promise<PaymentResponseDto> {
    // 1. Resolve Clinic Admin Info from Account ID
    console.log(
      'DEBUG: createVerificationQr - Input clinicId (Account ID):',
      clinicId,
    );

    const clinicAdmin = await this.clinicAdminRepo.findOne({
      where: { accountId: clinicId },
    });

    console.log(
      'DEBUG: createVerificationQr - Found clinicAdmin:',
      clinicAdmin,
    );

    if (!clinicAdmin) {
      console.error(
        'DEBUG: createVerificationQr - Clinic Admin NOT FOUND for accountId:',
        clinicId,
      );
      // Debug: Try to list all admins to see what is available
      const allAdmins = await this.clinicAdminRepo.find({ take: 5 });
      console.log(
        'DEBUG: createVerificationQr - First 5 admins in DB:',
        JSON.stringify(allAdmins, null, 2),
      );
      throw new NotFoundException('Clinic Admin Information not found');
    }

    const clinicAdminId = clinicAdmin._id;

    // 2. Get SePay Config
    const { acc, bank } = await this.resolveSepayConfig(clinicAdminId);

    // 3. Create Pending Transaction
    // Resolve Transaction Type (VERIFICATION)
    const transactionType = await this.transactionTypeRepo.findOne({
      where: { code: TransactionTypeCode.VERIFICATION },
    });

    if (!transactionType) {
      throw new NotFoundException('Transaction Type VERIFICATION not found');
    }

    const pendingTransaction = this.transactionRepository.create({
      amount: 10_000,
      currency: 'VND',
      status: PaymentStatus.PENDING,
      clinicId: clinicId, // FIX: Use accountId (from accounts table), NOT clinicAdminId (from clinic_admin_information table)
      transactionTypeId: transactionType._id,
      description: 'Verification Payment',
    });

    const savedTransaction =
      await this.transactionRepository.save(pendingTransaction);

    // 4. Generate QR with Transaction ID as content
    // Use the Transaction ID (savedTransaction.id) as the description
    const description = savedTransaction.id;

    const amount = 10_000;
    const expiresAt = this.computeExpireTime();

    // Pass transaction ID as the description
    const qrCodeUrl = this.buildQrUrl(amount, description, acc, bank);
    const qrPayload = this.buildQrPayload(amount, description, acc, bank);

    return new PaymentResponseDto({
      id: savedTransaction.id,
      amount,
      currency: 'VND',
      status: PaymentStatus.PENDING,
      qrCodeUrl,
      qrPayload,
      expiresAt,
    });
  }

  /**
   * Handle webhook callback from Seepay
   */
  async handleCallback(
    payload: SeepayCallbackDto,
  ): Promise<PaymentResponseDto> {
    const appointmentId =
      payload.appointmentId ||
      this.extractAppointmentIdFromContent(payload.content);

    if (!appointmentId) {
      throw new BadRequestException(
        'Unable to detect appointment ID in callback',
      );
    }

    const isIncoming = payload.transferType === PaymentDirection.IN;
    const status = isIncoming ? PaymentStatus.SUCCESS : PaymentStatus.FAILED;

    // A. Strategy 1: Look for existing Pending Transaction (Verification Flow)
    const existingTransaction = await this.transactionRepository.findOne({
      where: { id: appointmentId },
      relations: ['transactionType'],
    });

    if (existingTransaction) {
      existingTransaction.status = status;
      existingTransaction.gateway = payload.gateway;
      existingTransaction.transactionDate = parseVietnamTime(payload.transactionDate);
      existingTransaction.accountNumber = payload.accountNumber;
      existingTransaction.code = payload.code;
      // existingTransaction.content = payload.content; // FIX: Don't overwrite metadata
      existingTransaction.transferType = payload.transferType;
      existingTransaction.transferAmount = payload.transferAmount;
      existingTransaction.accumulated = payload.accumulated;
      existingTransaction.subAccount = payload.subAccount ?? undefined;
      existingTransaction.referenceCode = payload.referenceCode;
      existingTransaction.seepayTransactionId = payload.id?.toString();

      console.log(
        'handleCallback Debug - Found Existing Transaction:',
        existingTransaction.id,
      );
      console.log(
        'handleCallback Debug - Transaction Type:',
        existingTransaction.transactionType?.name,
      );
      console.log(
        'handleCallback Debug - Clinic ID:',
        existingTransaction.clinicId,
      );

      const saved = await this.transactionRepository.save(existingTransaction);

      const isVerification = existingTransaction.transactionType?.code === TransactionTypeCode.VERIFICATION;
      console.log('handleCallback Debug - Is Verification:', isVerification);

      if (status === PaymentStatus.SUCCESS && isVerification) {
        if (existingTransaction.clinicId) {
          console.log(
            'handleCallback Debug - Updating Clinic Verify Status for:',
            existingTransaction.clinicId,
          );
          await this.clinicAdminRepo.update(
            { accountId: existingTransaction.clinicId },
            { isVerify: true },
          );

          // FIX: Also advance subscription status PENDING_SEPAY_SETUP → PENDING_MANAGER_SETUP
          // so that check-registration-status endpoint reflects the change and frontend polling detects success.
          const subscription = await this.clinicSubscriptionRepo.findOne({
            where: {
              clinicId: existingTransaction.clinicId,
              subscriptionStatus: RegistrationStatus.PENDING_SEPAY_SETUP,
            },
          });

          if (subscription) {
            subscription.subscriptionStatus =
              RegistrationStatus.PENDING_MANAGER_SETUP;
            await this.clinicSubscriptionRepo.save(subscription);
            console.log(
              'handleCallback Debug - Subscription status advanced to PENDING_MANAGER_SETUP for clinic:',
              existingTransaction.clinicId,
            );
          } else {
            console.warn(
              'handleCallback Debug - No PENDING_SEPAY_SETUP subscription found for clinic:',
              existingTransaction.clinicId,
            );
          }
        } else {
          console.error(
            'handleCallback Debug - No Clinic ID in verification transaction!',
          );
        }
      }

      // Logic for Subscription Status Update (Existing Transaction)
      if (
        status === PaymentStatus.SUCCESS &&
        (existingTransaction.transactionType?.code === TransactionTypeCode.SUBSCRIPTION_PAYMENT ||
          existingTransaction.transactionType?.code === TransactionTypeCode.SUBSCRIPTION)
      ) {
        if (existingTransaction.subscriptionId) {
          console.log(
            'handleCallback Debug - Updating Subscription Status for:',
            existingTransaction.subscriptionId,
          );

          // Extract targetServiceId and duration from content if available
          let targetServiceId: string | undefined;
          let duration: number = 1;
          if (saved.content) {
            try {
              const contentObj = JSON.parse(saved.content);
              targetServiceId = contentObj.targetServiceId;
              duration = contentObj.duration || 1;
            } catch (e) {
              console.warn('Failed to parse transaction content:', e);
            }
          }

          // Delegate to SubscriptionServicesService to handle renewal/activation logic
          await this.subscriptionServicesService.handleSubscriptionPaymentSuccess(
            existingTransaction.subscriptionId,
            targetServiceId,
            saved.id, // PASS TRANSACTION ID HERE
            duration, // PASS DURATION HERE
          );
        }
      }

      // NEW: Update Appointment Packages and Status for Existing Transaction (Strategy A)
      if (status === PaymentStatus.SUCCESS && appointmentId) {
        await this.packageRepo.update(
          {
            appointmentId: appointmentId,
            status: AppointmentPackageStatus.PENDING_PAYMENT
          },
          {
            status: AppointmentPackageStatus.PAID,
            transactionId: saved.id,
            paymentType: PaymentType.ONLINE
          }
        );

        // Advance Appointment Status if it was NEED_FINAL_PAYMENT
        const appointment = await this.appointmentRepository.findOne({
          where: { _id: appointmentId }
        });
        if (appointment && appointment.status === AppointmentStatus.NEED_FINAL_PAYMENT) {
          // Note: Slot increment logic will be handled within AppointmentsService.updateStatus 
          // but here we can call a dedicated method or update directly.
          // For now, update directly and we'll ensure slot logic is central in AppointmentsService.
          await this.appointmentsService.updateAppointmentStatusDirectly(
            appointmentId,
            AppointmentStatus.COMPLETED
          );
        }
      }

      return new PaymentResponseDto({
        id: saved.id,
        amount: saved.amount,
        currency: saved.currency,
        status: saved.status,
        qrCodeUrl: undefined,
        qrPayload: undefined,
        expiresAt: saved.expiresAt,
      });
    }

    // B. Strategy 2: Standard Appointment Flow (New Transaction)
    // Resolve sender (patient) and clinic from appointment
    const appointment = await this.appointmentRepository.findOne({
      where: { _id: appointmentId },
    });

    if (!appointment) {
      // C. Strategy 3: Online Booking Session (appointment chưa tồn tại trong DB)
      // appointmentId ở đây chính là sessionId từ Redis
      const session = await this.bookingSessionService.getSession(appointmentId);
      if (session && session.paymentMethod === 'online') {
        console.log(
          'handleCallback Debug - Found Online Booking Session:',
          appointmentId,
        );

        // Gọi AppointmentsService để tạo appointment thật từ session này
        const appointmentResult = await this.appointmentsService.createAppointmentOnlineFromCallback(
          appointmentId,
          payload,
        );

        if (!appointmentResult) {
          throw new BadRequestException(
            'Failed to create appointment from online session',
          );
        }

        // Kích hoạt Webhook xác nhận lịch hẹn gửi thông tin sang n8n
        if (appointmentResult.appointment_id) {
          await this.appointmentWebhookService.sendConfirmation(
            appointmentResult.appointment_id,
          );
        }

        return new PaymentResponseDto({
          id: appointmentResult.transaction_id,
          amount: payload.transferAmount,
          currency: 'VND',
          status: PaymentStatus.SUCCESS,
          qrCodeUrl: undefined,
          qrPayload: undefined,
          expiresAt: getCurrentVietnamTime(),
        });
      }

      // STRICT MODE: If neither Transaction nor Appointment nor Session is found, REJECT the callback.
      console.error(
        `handleCallback Error - Reference ID ${appointmentId} not found in Transaction, Appointment, or Session tables.`,
      );
      throw new NotFoundException(
        'Transaction reference (Transaction ID, Appointment ID, or Session ID) not found',
      );
    }

    let clinicAdminId: string | undefined;
    if (appointment?.clinicId) {
      const clinicAdmin = await this.clinicAdminRepo.findOne({
        where: { accountId: appointment.clinicId },
      });
      clinicAdminId = clinicAdmin?._id;
    }

    const transactionType = await this.transactionTypeRepo.findOne({
      where: { code: TransactionTypeCode.ONLINE },
    });

    // Note: If appointment not found, we still save transaction but with null sender/clinic
    // to match user preference of capturing every callback.

    const transaction = this.transactionRepository.create({
      appointmentId,
      amount: payload.transferAmount,
      currency: 'VND',
      status,
      gateway: payload.gateway,
      clinicId: appointment?.clinicId,
      senderAccountId: appointment?.patientId,
      transactionTypeId: transactionType?._id,
      transactionDate: parseVietnamTime(payload.transactionDate),
      accountNumber: payload.accountNumber,
      code: payload.code,
      // content: payload.content, // EXISTING BUG: This overwrites our JSON metadata (targetServiceId) with the raw bank transfer message.
      transferType: payload.transferType,
      transferAmount: payload.transferAmount,
      accumulated: payload.accumulated,
      subAccount: payload.subAccount ?? undefined,
      referenceCode: payload.referenceCode,
      description: payload.description,
      seepayTransactionId: payload.id?.toString(),
    });

    const savedTransaction = await this.transactionRepository.save(transaction);

    if (status === PaymentStatus.SUCCESS) {
      if (payload.transferAmount === 10_000) {
        // Verification payment fallback: assume appointmentId received (if any) holds the account ID
        console.warn(
          'handleCallback Debug - Verification fallback strategy reached. appointmentId received:',
          appointmentId,
        );
        await this.clinicAdminRepo.update(
          { accountId: appointmentId },
          { isVerify: true },
        );
      }

      // Check if this is a SUBSCRIPTION payment
      const transactionType = await this.transactionTypeRepo.findOne({
        where: { _id: savedTransaction.transactionTypeId },
      });

      console.log(
        'handleCallback Debug - Transaction Type Name:',
        transactionType?.name,
      );
      console.log(
        'handleCallback Debug - Saved Transaction Subscription ID:',
        savedTransaction.subscriptionId,
      );

      if (
        transactionType?.code === TransactionTypeCode.SUBSCRIPTION_PAYMENT ||
        transactionType?.code === TransactionTypeCode.SUBSCRIPTION
      ) {
        if (savedTransaction.subscriptionId) {
          console.log(
            'handleCallback Debug - Updating Subscription Status for:',
            savedTransaction.subscriptionId,
          );

          // Extract targetServiceId and duration from content if available
          let targetServiceId: string | undefined;
          let duration: number = 1;
          if (savedTransaction.content) {
            console.log(
              '[DEBUG] Processing content for Target Service ID and Duration:',
              savedTransaction.content,
            );
            try {
              const contentObj = JSON.parse(savedTransaction.content);
              targetServiceId = contentObj.targetServiceId;
              duration = contentObj.duration || 1;
              console.log(
                '[DEBUG] Found targetServiceId:',
                targetServiceId,
                'duration:',
                duration,
              );
            } catch (e) {
              console.warn('[DEBUG] Failed to parse transaction content:', e);
            }
          } else {
            console.log('[DEBUG] No content found in transaction');
          }

          console.log(
            `[DEBUG] Delegating to SubscriptionService. handleSubscriptionPaymentSuccess(subId=${savedTransaction.subscriptionId}, targetId=${targetServiceId}, duration=${duration})`,
          );

          // Delegate to SubscriptionServicesService to handle renewal/activation logic
          await this.subscriptionServicesService.handleSubscriptionPaymentSuccess(
            savedTransaction.subscriptionId,
            targetServiceId,
            savedTransaction.id, // Pass Transaction ID to link history
            duration, // Pass Duration for end date calculation
          );
        } else {
          console.warn(
            'handleCallback Debug - Transaction has SUBSCRIPTION type but no subscriptionId',
          );
        }
      }

      // NEW: Update Appointment Packages and Status for New Transaction (Strategy B)
      if (status === PaymentStatus.SUCCESS && appointmentId) {
        await this.packageRepo.update(
          {
            appointmentId: appointmentId,
            status: AppointmentPackageStatus.PENDING_PAYMENT
          },
          {
            status: AppointmentPackageStatus.PAID,
            transactionId: savedTransaction.id,
            paymentType: PaymentType.ONLINE
          }
        );

        // Advance Appointment Status if it was NEED_FINAL_PAYMENT
        const appointment = await this.appointmentRepository.findOne({
          where: { _id: appointmentId }
        });
        if (appointment && appointment.status === AppointmentStatus.NEED_FINAL_PAYMENT) {
          await this.appointmentsService.updateAppointmentStatusDirectly(
            appointmentId,
            AppointmentStatus.COMPLETED
          );
        }
      }
    }

    return new PaymentResponseDto({
      id: savedTransaction.id,
      amount: savedTransaction.amount,
      currency: savedTransaction.currency,
      status: savedTransaction.status,
      qrCodeUrl: undefined,
      qrPayload: undefined,
      expiresAt: savedTransaction.expiresAt,
    });
  }

  buildQrUrl(
    amount: number,
    appointmentId: string,
    acc: string,
    bank: string,
  ): string {
    const des = appointmentId;
    const params = new URLSearchParams({
      acc,
      bank,
      amount: amount.toString(),
      des,
    });

    return `${this.qrBaseUrl}?${params.toString()}`;
  }

  buildQrPayload(
    amount: number,
    appointmentId: string,
    acc: string,
    bank: string,
  ): string {
    const des = appointmentId;
    return JSON.stringify({
      acc,
      bank,
      amount,
      des,
    });
  }

  private computeExpireTime(): Date {
    return addToVietnamTime(this.qrExpireMinutes, 'minute');
  }

  private extractAppointmentIdFromContent(
    content?: string,
  ): string | undefined {
    if (!content) {
      return undefined;
    }

    // Updated Regex to match standard UUID (8-4-4-4-12) or flat 32 hex chars
    const standardUuidMatch = content.match(
      /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i,
    );
    if (standardUuidMatch) {
      return standardUuidMatch[1];
    }

    const simpleUuidMatch = content.match(/([a-f0-9]{32})/i);
    if (simpleUuidMatch) {
      const raw = simpleUuidMatch[1];
      return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
    }

    return undefined;
  }

  async resolveSepayConfig(
    clinicAdminId?: string,
  ): Promise<{ acc: string; bank: string }> {
    if (!clinicAdminId) {
      throw new BadRequestException('Clinic id is required for QR');
    }

    const clinicAdmin = await this.clinicAdminRepo.findOne({
      where: { _id: clinicAdminId },
    });

    const acc = clinicAdmin?.sepayVa || this.seepayAccount;
    const bank = clinicAdmin?.bankName || this.seepayBank;

    if (!acc) {
      throw new BadRequestException(
        'Seepay VA is not configured for this clinic',
      );
    }

    return { acc, bank };
  }

  /**
   * Get all payment history via repository
   */
  async getAllPaymentHistory(
    page: number = 1,
    limit: number = 10,
    filters?: {
      clinicId?: string;
      senderAccountId?: string;
      fromDate?: string;
      toDate?: string;
    },
  ): Promise<{
    items: Array<{
      id: string;
      appointmentId?: string;
      amount: number;
      currency: string;
      status: string;
      gateway?: string;
      referenceCode?: string;
      transactionDate?: Date;
      createdAt: Date;
      clinicName?: string;
      senderFullName?: string;
      senderGender?: string;
      senderDob?: Date;
    }>;
    total: number;
  }> {
    const offset = (page - 1) * limit;

    const raw = await this.transactionRepository.findAllPaymentHistory(
      limit,
      offset,
      filters,
    );
    const total = await this.transactionRepository.countPaymentHistory(filters);

    const items = raw.map((row: any) => ({
      id: row._id,
      appointmentId: row.appointment_id,
      amount: Number(row.amount),
      currency: row.currency,
      status: row.status,
      gateway: row.gateway,
      referenceCode: row.reference_code,
      transactionDate: row.transaction_date,
      createdAt: row.created_at,
      clinicName: row.clinic_name,
      senderFullName: row.sender_full_name,
      senderDob: row.sender_dob,
    }));

    return { items, total };
  }

  /**
   * Get transaction detail by ID via repository
   */
  async getTransactionDetail(
    id: string,
    clinicId?: string,
  ): Promise<{
    id: string;
    appointmentId?: string;
    amount: number;
    currency: string;
    status: string;
    gateway?: string;
    referenceCode?: string;
    transactionDate?: Date;
    createdAt: Date;
    clinicName?: string;
    senderFullName?: string;
    senderGender?: string;
    senderDob?: Date;
    content?: string;
    accountNumber?: string;
    transferType?: string;
    transferAmount?: number;
    accumulated?: number;
  }> {
    const row = await this.transactionRepository.findDetailById(id, clinicId);

    if (!row) {
      throw new NotFoundException('Transaction not found');
    }

    return {
      id: row._id,
      appointmentId: row.appointment_id,
      amount: Number(row.amount),
      currency: row.currency,
      status: row.status,
      gateway: row.gateway,
      referenceCode: row.reference_code,
      transactionDate: row.transaction_date,
      createdAt: row.created_at,
      clinicName: row.clinic_name,
      senderFullName: row.sender_full_name,
      senderGender: row.sender_gender,
      senderDob: row.sender_dob,
      content: row.content,
      accountNumber: row.account_number,
      transferType: row.transfer_type,
      transferAmount: row.transfer_amount,
      accumulated: row.accumulated, // Added missing property assignment from original raw query used in other methods but relying on findDetailById returning it
      // Actually findDetailById returns IGetTransactionDetailResult which has accumulated? Let's check if I missed it in my manual re-write.
      // previous implementation had accumulated.
      // Checking interface...
    };
  }

  /**
   * Helper to find clinic admin ID by account ID
   */
  async getClinicAdminIdByAccountId(accountId: string): Promise<string | null> {
    const clinicAdmin = await this.clinicAdminRepo.findOne({
      where: { accountId },
      select: ['_id'],
    });
    return clinicAdmin ? clinicAdmin._id : null;
  }

  /**
   * Get revenue statistics for a clinic manager's branch
   */
  async getManagerRevenueStats(
    clinicId: string,
    dto: ManagerRevenueReportDto,
  ): Promise<any> {
    const startDate = dto.startDate ? getStartOfDay(dto.startDate) : new Date(0);
    const endDate = dto.endDate ? getStartOfDay(dto.endDate) : getCurrentVietnamTime();

    // Default to day if not specified
    const periodMap = {
      [RevenuePeriod.DAILY]: 'day',
      [RevenuePeriod.MONTHLY]: 'month',
      [RevenuePeriod.YEARLY]: 'year',
    };
    const period = periodMap[dto.period || RevenuePeriod.DAILY];

    const stats = await this.transactionRepository.getRevenueStats(
      clinicId,
      startDate,
      endDate,
      period,
    );

    const totalRevenue = stats.reduce(
      (sum, s) => sum + Number(s.total_revenue),
      0,
    );
    const totalTransactions = stats.reduce(
      (sum, s) => sum + Number(s.transaction_count),
      0,
    );

    return {
      period: dto.period || RevenuePeriod.DAILY,
      startDate,
      endDate,
      totalRevenue,
      totalTransactions,
      data: stats,
    };
  }

  /**
   * Export revenue report to Buffer (XLSX)
   */
  async exportManagerRevenueReport(
    clinicId: string,
    dto: ManagerRevenueReportDto,
  ): Promise<Buffer> {
    const startDate = dto.startDate ? getStartOfDay(dto.startDate) : new Date(0);
    const endDate = dto.endDate ? getStartOfDay(dto.endDate) : getCurrentVietnamTime();

    const transactions = await this.transactionRepository.getTransactionsForExport(
      clinicId,
      startDate,
      endDate,
    );

    const worksheetData = transactions.map((t) => ({
      'Ngày giao dịch': formatToVietnamTime(t.date),
      'Mã giao dịch': t.transaction_id,
      'Số tiền': Number(t.amount),
      'Trạng thái': t.status,
      'Cổng thanh toán': t.gateway || 'N/A',
      'Mô tả': t.description || 'N/A',
      'Bệnh nhân': t.patient_name || 'Hệ thống',
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Doanh thu');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }
}
