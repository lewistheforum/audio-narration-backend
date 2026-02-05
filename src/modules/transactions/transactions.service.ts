import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { URLSearchParams } from 'url';
import { Repository, Like } from 'typeorm';
import { ClinicAdminInformation } from '../accounts/entities/clinic-admin-information.entity';
import { PaymentDirection, PaymentStatus, TransactionType } from './entities';
import { RegistrationStatus } from '../subscriptions/enums';
import { CreateTransactionDto, PaymentResponseDto, SeepayCallbackDto, CreateSubscriptionTransactionDto } from './dto';
import { Appointment } from '../appointments/entities/appointment.entity';
import { TransactionRepository } from './repositories/transaction.repository';
import { ClinicSubscriptionHistory } from '../subscriptions/entities/clinic-subscription-history.entity';
import { SubscriptionService } from '../subscriptions/entities/subscription-service.entity';

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
    @InjectRepository(TransactionType)
    private readonly transactionTypeRepo: Repository<TransactionType>,
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    @InjectRepository(ClinicSubscriptionHistory)
    private readonly clinicSubscriptionHistoryRepo: Repository<ClinicSubscriptionHistory>,
    @InjectRepository(SubscriptionService)
    private readonly subscriptionServiceRepo: Repository<SubscriptionService>,
    private readonly configService: ConfigService,
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
  async createSubscriptionQr(dto: CreateSubscriptionTransactionDto): Promise<PaymentResponseDto> {
    // 1. Get Subscription History
    const subscriptionHistory = await this.clinicSubscriptionHistoryRepo.findOne({
      where: { _id: dto.subscriptionId },
    });

    if (!subscriptionHistory) {
      throw new NotFoundException('Subscription history not found');
    }

    // 2. Get Service Price to Calculate/Verify Amount
    const service = await this.subscriptionServiceRepo.findOne({
      where: { _id: subscriptionHistory.serviceId },
    });

    if (!service) {
      throw new NotFoundException('Subscription service not found');
    }

    // Calculate amount: price * (1 - discount/100)
    const amount = Math.round(service.price * (1 - service.discount / 100));

    // 3. Get Clinic Admin to resolve Seepay Config
    // Subscription History stores clinicId (which is Account ID). 
    // We need ClinicAdmin's _id to link Transaction and to find Seepay Config.
    const clinicAdmin = await this.clinicAdminRepo.findOne({
      where: { accountId: subscriptionHistory.clinicId },
    });

    if (!clinicAdmin) {
      throw new NotFoundException('Clinic Admin Information not found');
    }

    const clinicAdminId = clinicAdmin._id;
    const { acc, bank } = await this.resolveSepayConfig(clinicAdminId);

    // 4. Create or Update Transaction
    // Check if a transaction already exists for this subscription history
    let transaction = await this.transactionRepository.findOne({
      where: { subscriptionId: dto.subscriptionId },
    });

    if (!transaction) {
      // Create new transaction
      const transactionType = await this.transactionTypeRepo.findOne({
        where: { name: Like('SUBSCRIPTION%') },
      });

      if (!transactionType) {
        throw new NotFoundException('Transaction Type SUBSCRIPTION not found');
      }

      transaction = this.transactionRepository.create({
        amount,
        currency: 'VND',
        status: PaymentStatus.PENDING,
        clinicId: clinicAdminId,
        subscriptionId: dto.subscriptionId,
        transactionTypeId: transactionType._id,
        description: `Payment for subscription ${service.serviceName}`,
      });
      transaction = await this.transactionRepository.save(transaction);
    } else {
      // Update existing transaction if amount changed or just to refresh
      if (Number(transaction.amount) !== amount) {
        transaction.amount = amount;
        transaction = await this.transactionRepository.save(transaction);
      }
    }

    // 5. Generate QR
    // Use Transaction ID as description for callback mapping
    const description = transaction.id;
    const expiresAt = this.computeExpireTime();

    const qrCodeUrl = this.buildQrUrl(amount, description, acc, bank);
    const qrPayload = this.buildQrPayload(amount, description, acc, bank);

    return new PaymentResponseDto({
      id: transaction.id,
      amount,
      currency: 'VND',
      status: transaction.status,
      qrCodeUrl,
      qrPayload,
      expiresAt,
    });
  }

  /**
   * Create a dynamic payment QR for a prescription
   */
  async createDynamicQr(
    dto: CreateTransactionDto,
  ): Promise<PaymentResponseDto> {

    // Verify appointment and get real amount & clinic
    const appointment = await this.appointmentRepository.findOne({
      where: { _id: dto.prescriptionId },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    let clinicAdminId: string | undefined;
    if (appointment?.clinicId) {
      const clinicAdmin = await this.clinicAdminRepo.findOne({ where: { accountId: appointment.clinicId } });
      clinicAdminId = clinicAdmin?._id;
    }

    const { acc, bank } = await this.resolveSepayConfig(clinicAdminId);

    const amount = Number(appointment.total);
    // Ignore dto.amount, use source of truth from DB

    const expiresAt = this.computeExpireTime();
    const qrCodeUrl = this.buildQrUrl(amount, dto.prescriptionId, acc, bank);
    const qrPayload = this.buildQrPayload(amount, dto.prescriptionId, acc, bank);

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
   * Create a small verification QR (10k) to verify clinic bank account
   */
  async createVerificationQr(clinicId: string): Promise<PaymentResponseDto> {
    // 1. Resolve Clinic Admin Info from Account ID
    console.log('DEBUG: createVerificationQr - Input clinicId (Account ID):', clinicId);

    const clinicAdmin = await this.clinicAdminRepo.findOne({
      where: { accountId: clinicId },
    });

    console.log('DEBUG: createVerificationQr - Found clinicAdmin:', clinicAdmin);

    if (!clinicAdmin) {
      console.error('DEBUG: createVerificationQr - Clinic Admin NOT FOUND for accountId:', clinicId);
      // Debug: Try to list all admins to see what is available
      const allAdmins = await this.clinicAdminRepo.find({ take: 5 });
      console.log('DEBUG: createVerificationQr - First 5 admins in DB:', JSON.stringify(allAdmins, null, 2));
      throw new NotFoundException('Clinic Admin Information not found');
    }

    const clinicAdminId = clinicAdmin._id;

    // 2. Get SePay Config
    const { acc, bank } = await this.resolveSepayConfig(clinicAdminId);

    // 3. Create Pending Transaction
    // Resolve Transaction Type (VERIFICATION)
    const transactionType = await this.transactionTypeRepo.findOne({
      where: { name: Like('VERIFICATION%') },
    });

    if (!transactionType) {
      throw new NotFoundException('Transaction Type VERIFICATION not found');
    }


    const pendingTransaction = this.transactionRepository.create({
      amount: 10_000,
      currency: 'VND',
      status: PaymentStatus.PENDING,
      clinicId: clinicAdminId,
      transactionTypeId: transactionType._id,
      description: 'Verification Payment',
    });

    const savedTransaction = await this.transactionRepository.save(pendingTransaction);

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
  async handleCallback(payload: SeepayCallbackDto): Promise<PaymentResponseDto> {
    const prescriptionId =
      payload.prescriptionId || this.extractPrescriptionIdFromContent(payload.content);

    if (!prescriptionId) {
      throw new BadRequestException('Unable to detect prescription ID in callback');
    }

    const isIncoming = payload.transferType === PaymentDirection.IN;
    const status = isIncoming ? PaymentStatus.SUCCESS : PaymentStatus.FAILED;

    // A. Strategy 1: Look for existing Pending Transaction (Verification Flow)
    const existingTransaction = await this.transactionRepository.findOne({
      where: { id: prescriptionId },
      relations: ['transactionType'],
    });

    if (existingTransaction) {
      existingTransaction.status = status;
      existingTransaction.gateway = payload.gateway;
      existingTransaction.transactionDate = new Date(payload.transactionDate);
      existingTransaction.accountNumber = payload.accountNumber;
      existingTransaction.code = payload.code;
      existingTransaction.content = payload.content;
      existingTransaction.transferType = payload.transferType;
      existingTransaction.transferAmount = payload.transferAmount;
      existingTransaction.accumulated = payload.accumulated;
      existingTransaction.subAccount = payload.subAccount ?? undefined;
      existingTransaction.referenceCode = payload.referenceCode;
      existingTransaction.seepayTransactionId = payload.id?.toString();


      console.log('handleCallback Debug - Found Existing Transaction:', existingTransaction.id);
      console.log('handleCallback Debug - Transaction Type:', existingTransaction.transactionType?.name);
      console.log('handleCallback Debug - Clinic ID:', existingTransaction.clinicId);

      const saved = await this.transactionRepository.save(existingTransaction);

      const isVerification = existingTransaction.transactionType?.name?.toUpperCase().startsWith('VERIFICATION');
      console.log('handleCallback Debug - Is Verification:', isVerification);

      if (status === PaymentStatus.SUCCESS && isVerification) {
        if (existingTransaction.clinicId) {
          console.log('handleCallback Debug - Updating Clinic Verify Status for:', existingTransaction.clinicId);
          await this.clinicAdminRepo.update({ _id: existingTransaction.clinicId }, { isVerify: true });
        } else {
          console.error('handleCallback Debug - No Clinic ID in verification transaction!');
        }
      }

      // Logic for Subscription Status Update (Existing Transaction)
      if (status === PaymentStatus.SUCCESS && existingTransaction.transactionType?.name?.toUpperCase().startsWith('SUBSCRIPTION')) {
        if (existingTransaction.subscriptionId) {
          console.log('handleCallback Debug - Updating Subscription Status for:', existingTransaction.subscriptionId);
          await this.clinicSubscriptionHistoryRepo.update(
            { _id: existingTransaction.subscriptionId },
            { subscriptionStatus: RegistrationStatus.ACTIVE, subscriptionDate: new Date() }
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
      where: { _id: prescriptionId },
    });

    if (!appointment) {
      // STRICT MODE: If neither Transaction nor Appointment is found, REJECT the callback.
      // We do not allow "blind" transactions based on amount/content guessing anymore.
      console.error(`handleCallback Error - Reference ID ${prescriptionId} not found in Transaction or Appointment tables.`);
      throw new NotFoundException('Transaction reference (Transaction ID or Appointment ID) not found');
    }

    let clinicAdminId: string | undefined;
    if (appointment?.clinicId) {
      const clinicAdmin = await this.clinicAdminRepo.findOne({ where: { accountId: appointment.clinicId } });
      clinicAdminId = clinicAdmin?._id;
    }

    // Resolve Transaction Type (ONLINE for appointments)
    let typeName = 'ONLINE';

    // Fallback logic for VERIFICATION based on amount/content is REMOVED.

    const transactionType = await this.transactionTypeRepo.findOne({
      where: { name: Like(typeName + '%') },
    });

    // Note: If appointment not found, we still save transaction but with null sender/clinic
    // to match user preference of capturing every callback.

    const transaction = this.transactionRepository.create({
      prescriptionId,
      amount: payload.transferAmount,
      currency: 'VND',
      status,
      gateway: payload.gateway,
      clinicId: clinicAdminId,
      senderAccountId: appointment?.patientId,
      transactionTypeId: transactionType?._id,
      transactionDate: new Date(payload.transactionDate),
      accountNumber: payload.accountNumber,
      code: payload.code,
      content: payload.content,
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
        // Verification payment: mark clinic verified by clinic-admin _id (stored in prescriptionId)
        await this.clinicAdminRepo.update({ _id: prescriptionId }, { isVerify: true });
      }

      // Check if this is a SUBSCRIPTION payment
      const transactionType = await this.transactionTypeRepo.findOne({
        where: { _id: savedTransaction.transactionTypeId },
      });

      console.log('handleCallback Debug - Transaction Type Name:', transactionType?.name);
      console.log('handleCallback Debug - Saved Transaction Subscription ID:', savedTransaction.subscriptionId);

      if (transactionType?.name?.toUpperCase().startsWith('SUBSCRIPTION')) {
        if (savedTransaction.subscriptionId) {
          console.log('handleCallback Debug - Updating Subscription Status for:', savedTransaction.subscriptionId);
          const updateResult = await this.clinicSubscriptionHistoryRepo.update(
            { _id: savedTransaction.subscriptionId },
            { subscriptionStatus: RegistrationStatus.ACTIVE, subscriptionDate: new Date() }
          );
          console.log('handleCallback Debug - Update Result:', updateResult);
        } else {
          console.warn('handleCallback Debug - Transaction has SUBSCRIPTION type but no subscriptionId');
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

  private buildQrUrl(amount: number, prescriptionId: string, acc: string, bank: string): string {
    const des = prescriptionId;
    const params = new URLSearchParams({
      acc,
      bank,
      amount: amount.toString(),
      des,
    });

    return `${this.qrBaseUrl}?${params.toString()}`;
  }

  buildQrPayload(amount: number, prescriptionId: string, acc: string, bank: string): string {
    const des = prescriptionId;
    return JSON.stringify({
      acc,
      bank,
      amount,
      des,
    });
  }

  private computeExpireTime(): Date {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.qrExpireMinutes);
    return expiresAt;
  }

  private extractPrescriptionIdFromContent(content?: string): string | undefined {
    if (!content) {
      return undefined;
    }

    // Updated Regex to match standard UUID (8-4-4-4-12) or flat 32 hex chars
    const standardUuidMatch = content.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
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

  private async resolveSepayConfig(
    clinicAdminId?: string,
  ): Promise<{ acc: string; bank: string }> {
    if (!clinicAdminId) {
      throw new BadRequestException('Clinic id is required for QR');
    }

    const clinicAdmin = await this.clinicAdminRepo.findOne({ where: { _id: clinicAdminId } });

    const acc = clinicAdmin?.sepayVa || this.seepayAccount;
    const bank = clinicAdmin?.bankName || this.seepayBank;

    if (!acc) {
      throw new BadRequestException('Seepay VA is not configured for this clinic');
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
      prescriptionId?: string;
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

    const raw = await this.transactionRepository.findAllPaymentHistory(limit, offset, filters);
    const total = await this.transactionRepository.countPaymentHistory(filters);

    const items = raw.map((row: any) => ({
      id: row._id,
      prescriptionId: row.prescription_id,
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
  async getTransactionDetail(id: string, clinicId?: string): Promise<{
    id: string;
    prescriptionId?: string;
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
  }> {
    const row = await this.transactionRepository.findDetailById(id, clinicId);

    if (!row) {
      throw new NotFoundException('Transaction not found');
    }

    return {
      id: row._id,
      prescriptionId: row.prescription_id,
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
}
