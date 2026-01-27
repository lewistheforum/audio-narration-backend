import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { URLSearchParams } from 'url';
import { Repository, Like } from 'typeorm';
import { ClinicAdminInformation } from '../accounts/entities/clinic-admin-information.entity';
import { PaymentDirection, PaymentStatus, TransactionType } from './entities';
import { CreateTransactionDto, PaymentResponseDto, SeepayCallbackDto } from './dto';
import { Appointment } from '../appointments/entities/appointment.entity';
import { TransactionRepository } from './repositories/transaction.repository';

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
    const clinicAdmin = await this.clinicAdminRepo.findOne({
      where: { accountId: clinicId },
    });

    if (!clinicAdmin) {
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
      existingTransaction.metadata = { callbackSignature: payload.signature ?? null };

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

    let clinicAdminId: string | undefined;
    if (appointment?.clinicId) {
      const clinicAdmin = await this.clinicAdminRepo.findOne({ where: { accountId: appointment.clinicId } });
      clinicAdminId = clinicAdmin?._id;
    } else {
      const clinicAdmin = await this.clinicAdminRepo.findOne({ where: { _id: prescriptionId } });
      if (clinicAdmin) clinicAdminId = clinicAdmin._id;
    }

    // Resolve Transaction Type
    let typeName = 'ONLINE';
    // Check if content explicitly signifies verification
    const isVerificationContent = payload.content?.toUpperCase().includes('VERIFICATION');

    if (isVerificationContent || (payload.transferAmount === 10_000 && !appointment)) {
      typeName = 'VERIFICATION';
    }

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
      metadata: {
        callbackSignature: payload.signature ?? null,
      },
    });

    const savedTransaction = await this.transactionRepository.save(transaction);

    if (status === PaymentStatus.SUCCESS && payload.transferAmount === 10_000) {
      // Verification payment: mark clinic verified by clinic-admin _id (stored in prescriptionId)
      await this.clinicAdminRepo.update({ _id: prescriptionId }, { isVerify: true });
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
    const uuidMatch = content.match(/([a-f0-9]{32})/i);

    if (!uuidMatch) {
      return undefined;
    }

    const raw = uuidMatch[1];

    return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
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
