import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { URLSearchParams } from 'url';
import { Repository } from 'typeorm';
import { CreatePaymentDto, PaymentResponseDto, SeepayCallbackDto } from './dto';
import { ClinicLegalDocument } from './entities/clinic-legal-document.entity';
import {
	PaymentDirection,
	PaymentStatus,
	PaymentTransaction,
} from './entities/payment-transaction.entity';

@Injectable()
export class PaymentsService {
	private readonly qrBaseUrl: string;
	private readonly seepayAccount: string;
	private readonly seepayBank: string;
	private readonly qrExpireMinutes: number;

	constructor(
		@InjectRepository(PaymentTransaction)
		private readonly paymentRepository: Repository<PaymentTransaction>,
		@InjectRepository(ClinicLegalDocument)
		private readonly clinicRepo: Repository<ClinicLegalDocument>,
		private readonly configService: ConfigService,
	) {
		this.qrBaseUrl =
			this.configService.get<string>('SEEPAY_QR_BASE') ||
			'https://qr.sepay.vn/img';
		this.seepayAccount = this.configService.get<string>('SEEPAY_ACC') || '';
		this.seepayBank = this.configService.get<string>('SEEPAY_BANK') || 'MBBank';
		this.qrExpireMinutes = Number(
			this.configService.get<number>('SEEPAY_QR_EXPIRE_MINUTES') || 15,
		);
	}

	async createDynamicQr(
		dto: CreatePaymentDto,
	): Promise<PaymentResponseDto> {
		if (!this.seepayAccount) {
			throw new BadRequestException('Seepay account is not configured');
		}

		const orderCode = this.generateOrderCode(dto.prescriptionId);
		const expiresAt = this.computeExpireTime();
		const qrCodeUrl = this.buildQrUrl(dto.amount, dto.prescriptionId);
		const qrPayload = this.buildQrPayload(dto.amount, dto.prescriptionId);

		return new PaymentResponseDto({
			id: null, // Chưa có ID vì chưa lưu DB
			orderCode,
			amount: dto.amount,
			currency: 'VND',
			status: PaymentStatus.PENDING,
			qrCodeUrl,
			qrPayload,
			expiresAt,
		});
	}

	async handleCallback(
		payload: SeepayCallbackDto,
	): Promise<PaymentResponseDto> {
		console.log('🔔 Callback received:', JSON.stringify(payload, null, 2));
		
		// Ưu tiên lấy prescriptionId từ trường prescriptionId, nếu không có thì parse từ content
		const prescriptionId = 
			payload.prescriptionId || 
			this.extractPrescriptionIdFromContent(payload.content);

		console.log('📋 Extracted prescriptionId:', prescriptionId);

		if (!prescriptionId) {
			throw new BadRequestException('Unable to detect prescription ID in callback');
		}

		// Tạo orderCode từ prescriptionId
		const orderCode = this.generateOrderCode(prescriptionId);
		console.log('🎫 Generated orderCode:', orderCode);

		// Kiểm tra xem transaction đã tồn tại chưa (tránh duplicate callback)
		let transaction = await this.paymentRepository.findOne({
			where: { prescriptionId },
		});
		
		console.log('🔍 Existing transaction:', transaction ? 'Found' : 'Not found');

		if (transaction) {
			// Nếu đã tồn tại, chỉ return thông tin (idempotent)
			return new PaymentResponseDto({
				id: transaction.id,
				orderCode: transaction.orderCode,
				amount: transaction.amount,
				currency: transaction.currency,
				status: transaction.status,
				qrCodeUrl: transaction.qrCodeUrl,
				qrPayload: transaction.qrPayload,
				expiresAt: transaction.expiresAt,
			});
		}

		// Lần đầu nhận callback → Tạo mới record trong DB
		const isIncoming = payload.transferType === PaymentDirection.IN;
		const status = isIncoming
			? PaymentStatus.SUCCESS
			: PaymentStatus.FAILED;

		transaction = this.paymentRepository.create({
			prescriptionId,
			amount: payload.transferAmount,
			currency: 'VND',
			orderCode,
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
			seepayTransactionId: payload.id.toString(),
			metadata: {
				callbackSignature: payload.signature ?? null,
			},
		});

		console.log('💾 Saving transaction to DB...');
		const savedTransaction = await this.paymentRepository.save(transaction);
		console.log('✅ Transaction saved with ID:', savedTransaction.id);

		if (status === PaymentStatus.SUCCESS && prescriptionId) {
			await this.markClinicDocumentVerified(prescriptionId);
		}

		return new PaymentResponseDto({
			id: transaction.id,
			orderCode: transaction.orderCode,
			amount: transaction.amount,
			currency: transaction.currency,
			status: transaction.status,
			qrCodeUrl: transaction.qrCodeUrl,
			qrPayload: transaction.qrPayload,
			expiresAt: transaction.expiresAt,
		});
	}

	private async markClinicDocumentVerified(documentId: string): Promise<void> {
		const doc = await this.clinicRepo.findOne({ where: { id: documentId } });
		if (!doc || doc.isSepayVerify) {
			return;
		}
		doc.isSepayVerify = true;
		await this.clinicRepo.save(doc);
	}

	private buildQrUrl(amount: number, prescriptionId: string): string {
		const des = prescriptionId;
		const params = new URLSearchParams({
			acc: this.seepayAccount,
			bank: this.seepayBank,
			amount: amount.toString(),
			des,
		});

		return `${this.qrBaseUrl}?${params.toString()}`;
	}

	buildQrPayload(amount: number, prescriptionId: string): string {
		const des = prescriptionId;
		return JSON.stringify({
			acc: this.seepayAccount,
			bank: this.seepayBank,
			amount,
			des,
		});
	}

	private generateOrderCode(prescriptionId: string): string {
		const shortId = prescriptionId.replace(/-/g, '').slice(0, 6).toUpperCase();
		const timestamp = Date.now().toString().slice(-6);
		const random = Math.random().toString(36).substring(2, 5).toUpperCase();
		return `DH${timestamp}${shortId}${random}`;
	}

	private computeExpireTime(): Date {
		const expiresAt = new Date();
		expiresAt.setMinutes(expiresAt.getMinutes() + this.qrExpireMinutes);
		return expiresAt;
	}

	private extractOrderCode(content?: string): string | undefined {
		if (!content) {
			return undefined;
		}
		const match = content.match(/(DH[\w-]+)/i);
		return match?.[1]?.toUpperCase();
	}

	private extractPrescriptionIdFromContent(content?: string): string | undefined {
		if (!content) {
			return undefined;
		}
		// Content format: "QAFHMW1685 SEPAY7676 1 f91af8b4391e4a41a8c91f08b4b6a690"
		const uuidMatch = content.match(/([a-f0-9]{32})/i);
		
		if (!uuidMatch) {
			return undefined;
		}
		
		const prescriptionIdRaw = uuidMatch[1];
		
		// Thêm lại dấu gạch ngang vào UUID
		// Format: f91af8b4391e4a41a8c91f08b4b6a690 -> f91af8b4-391e-4a41-a8c9-1f08b4b6a690
		return `${prescriptionIdRaw.slice(0, 8)}-${prescriptionIdRaw.slice(8, 12)}-${prescriptionIdRaw.slice(12, 16)}-${prescriptionIdRaw.slice(16, 20)}-${prescriptionIdRaw.slice(20)}`;
	}

	private parseDes(des: string): { uid?: string; pid?: string; order?: string } {
		// des giờ chỉ chứa prescriptionId
		return { pid: des };
	}

	async getAllPaymentHistory(
		page: number = 1,
		limit: number = 10,
	): Promise<{ items: PaymentTransaction[]; total: number }> {
		const [items, total] = await this.paymentRepository.findAndCount({
			order: { createdAt: 'DESC' },
			skip: (page - 1) * limit,
			take: limit,
		});

		return { items, total };
	}
}
