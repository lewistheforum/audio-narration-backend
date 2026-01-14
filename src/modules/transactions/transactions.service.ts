import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { URLSearchParams } from 'url';
import { Repository } from 'typeorm';
import { ClinicAdminInformation } from '../accounts/entities/clinic-admin-information.entity';
import { PaymentDirection, PaymentStatus,Transaction } from './entities';
import { CreateTransactionDto, PaymentResponseDto, SeepayCallbackDto } from './dto';

@Injectable()
export class TransactionsService {
  private readonly qrBaseUrl: string;
  private readonly seepayAccount: string;
  private readonly seepayBank: string;
  private readonly qrExpireMinutes: number;

  constructor(
    @InjectRepository(Transaction)
    private readonly paymentRepository: Repository<Transaction>,
    @InjectRepository(ClinicAdminInformation)
    private readonly clinicAdminRepo: Repository<ClinicAdminInformation>,
    private readonly configService: ConfigService,
  ) {
    this.qrBaseUrl =
      this.configService.get<string>('SEEPAY_QR_BASE') || 'https://qr.sepay.vn/img';
    this.seepayAccount = this.configService.get<string>('SEEPAY_ACC') || '';
    this.seepayBank = this.configService.get<string>('SEEPAY_BANK') || 'MBBank';
    this.qrExpireMinutes = Number(
      this.configService.get<number>('SEEPAY_QR_EXPIRE_MINUTES') || 15,
    );
  }

  async createDynamicQr(
    dto: CreateTransactionDto,
  ): Promise<PaymentResponseDto> {
    const { acc, bank } = await this.resolveSepayConfig(dto.clinicId);

    const expiresAt = this.computeExpireTime();
    const qrCodeUrl = this.buildQrUrl(dto.amount, dto.prescriptionId, acc, bank);
    const qrPayload = this.buildQrPayload(dto.amount, dto.prescriptionId, acc, bank);

    return new PaymentResponseDto({
      id: null,
      amount: dto.amount,
      currency: 'VND',
      status: PaymentStatus.PENDING,
      qrCodeUrl,
      qrPayload,
      expiresAt,
    });
  }

  async handleCallback(payload: SeepayCallbackDto): Promise<PaymentResponseDto> {
    const prescriptionId =
      payload.prescriptionId || this.extractPrescriptionIdFromContent(payload.content);

    if (!prescriptionId) {
      throw new BadRequestException('Unable to detect prescription ID in callback');
    }

    const isIncoming = payload.transferType === PaymentDirection.IN;
    const status = isIncoming ? PaymentStatus.SUCCESS : PaymentStatus.FAILED;

    const transaction = this.paymentRepository.create({
      prescriptionId,
      amount: payload.transferAmount,
      currency: 'VND',
      status,
      gateway: payload.gateway,
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

    const savedTransaction = await this.paymentRepository.save(transaction);

    return new PaymentResponseDto({
      id: savedTransaction.id,
      amount: savedTransaction.amount,
      currency: savedTransaction.currency,
      status: savedTransaction.status,
      qrCodeUrl: savedTransaction.qrCodeUrl,
      qrPayload: savedTransaction.qrPayload,
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
    clinicId?: string,
  ): Promise<{ acc: string; bank: string }> {
    if (!clinicId) {
      throw new BadRequestException('Clinic id is required for QR');
    }

    const clinicAdmin = await this.clinicAdminRepo.findOne({ where: { _id: clinicId } });

    const acc = clinicAdmin?.sepayVa || this.seepayAccount;
    const bank = clinicAdmin?.bankName || this.seepayBank;

    if (!acc) {
      throw new BadRequestException('Seepay VA is not configured for this clinic');
    }

    return { acc, bank };
  }

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

    const conditions: string[] = ['t.deleted_at IS NULL'];
    const params: Array<string | number | Date> = [];

    if (filters?.clinicId) {
      params.push(filters.clinicId);
      conditions.push(`t.clinic_id = $${params.length}`);
    }

    if (filters?.senderAccountId) {
      params.push(filters.senderAccountId);
      conditions.push(`t.sender_account_id = $${params.length}`);
    }

    if (filters?.fromDate) {
      params.push(new Date(filters.fromDate));
      conditions.push(`t.transaction_date >= $${params.length}`);
    }

    if (filters?.toDate) {
      params.push(new Date(filters.toDate));
      conditions.push(`t.transaction_date <= $${params.length}`);
    }

    const whereClause = conditions.join(' AND ');

    const raw = await this.paymentRepository.query(
      `SELECT t.*,
              ci.clinic_name AS clinic_name,
              ga.full_name  AS sender_full_name,
              ga.gender     AS sender_gender,
              ga.dob        AS sender_dob
       FROM transactions t
       LEFT JOIN clinic_information ci ON ci._id = t.clinic_id
       LEFT JOIN general_accounts ga ON ga.general_acc_id = t.sender_account_id
       WHERE ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );

    const countResult = await this.paymentRepository.query(
      `SELECT COUNT(*)::int AS cnt
       FROM transactions t
       WHERE ${whereClause}`,
      params,
    );
    const total = Number(countResult?.[0]?.cnt || 0);

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
      senderGender: row.sender_gender,
      senderDob: row.sender_dob,
    }));

    return { items, total };
  }

  async getTransactionDetail(id: string): Promise<{
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
    const rows = await this.paymentRepository.query(
      `SELECT t.*,
              ci.clinic_name AS clinic_name,
              ga.full_name  AS sender_full_name,
              ga.gender     AS sender_gender,
              ga.dob        AS sender_dob
       FROM transactions t
       LEFT JOIN clinic_information ci ON ci._id = t.clinic_id
       LEFT JOIN general_accounts ga ON ga.general_acc_id = t.sender_account_id
       WHERE t.deleted_at IS NULL AND t._id = $1
       LIMIT 1`,
      [id],
    );

    const row = rows?.[0];
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

}
