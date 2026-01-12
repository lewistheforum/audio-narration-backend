import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { URLSearchParams } from 'url';
import { Repository } from 'typeorm';
import { PaymentDirection, PaymentStatus, Transaction } from './entities';
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
    const { acc, bank } = await this.resolveSepayConfig(dto.prescriptionId);

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

    let transaction = await this.paymentRepository.findOne({ where: { prescriptionId } });

    if (transaction) {
      return new PaymentResponseDto({
        id: transaction.id,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        qrCodeUrl: transaction.qrCodeUrl,
        qrPayload: transaction.qrPayload,
        expiresAt: transaction.expiresAt,
      });
    }

    const isIncoming = payload.transferType === PaymentDirection.IN;
    const status = isIncoming ? PaymentStatus.SUCCESS : PaymentStatus.FAILED;

    transaction = this.paymentRepository.create({
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
    prescriptionId: string,
  ): Promise<{ acc: string; bank: string }> {
    if (!prescriptionId) {
      throw new BadRequestException('Prescription/invoice id is required for QR');
    }

    if (!this.seepayAccount) {
      throw new BadRequestException('Seepay VA is not configured');
    }

    return { acc: this.seepayAccount, bank: this.seepayBank };
  }

  async getAllPaymentHistory(
    page: number = 1,
    limit: number = 10,
  ): Promise<{ items: Transaction[]; total: number }> {
    const [items, total] = await this.paymentRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total };
  }

}
