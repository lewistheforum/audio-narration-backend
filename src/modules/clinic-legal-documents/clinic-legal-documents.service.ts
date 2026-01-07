import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentResponseDto } from '../transactions/dto/payment-response.dto';
import { TransactionsService } from '../transactions/transactions.service';
import { ClinicLegalDocument } from '../transactions/entities/clinic-legal-document.entity';
import { CreateClinicLegalDocumentDto } from './dto/create-clinic-legal-document.dto';
import { GenerateVerificationQrDto } from './dto/generate-verification-qr.dto';

@Injectable()
export class ClinicLegalDocumentsService {
	constructor(
		@InjectRepository(ClinicLegalDocument)
		private readonly clinicRepo: Repository<ClinicLegalDocument>,
		private readonly transactionsService: TransactionsService,
	) {}

	async create(dto: CreateClinicLegalDocumentDto): Promise<ClinicLegalDocument> {
		const doc = this.clinicRepo.create(dto);
		return this.clinicRepo.save(doc);
	}

	async findOne(id: string): Promise<ClinicLegalDocument> {
		const doc = await this.clinicRepo.findOne({ where: { id } });
		if (!doc) {
			throw new NotFoundException('Clinic legal document not found');
		}
		return doc;
	}

	private async getSepayConfig(id: string): Promise<{ acc: string; bank?: string }> {
		const doc = await this.findOne(id);
		if (!doc.sepayVa) {
			throw new NotFoundException('Seepay VA is not configured for this clinic document');
		}
		return { acc: doc.sepayVa, bank: doc.bankName ?? undefined };
	}

	async generateVerificationQr(
		documentId: string,
		payload: GenerateVerificationQrDto,
	): Promise<PaymentResponseDto> {
		const doc = await this.findOne(documentId);
		await this.getSepayConfig(documentId); // ensure VA exists in DB
		const amount = payload.amount ?? 10000; // small test amount

		// Reuse transactions QR flow; pass documentId to fetch VA/bank from DB
		return this.transactionsService.createDynamicQr(
			{
				prescriptionId: doc.id,
				amount,
			},
			doc.id,
		);
	}
}
