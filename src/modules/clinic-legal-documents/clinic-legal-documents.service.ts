import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentResponseDto } from '../payments/dto/payment-response.dto';
import { PaymentsService } from '../payments/payments.service';
import { ClinicLegalDocument } from '../payments/entities/clinic-legal-document.entity';
import { CreateClinicLegalDocumentDto } from './dto/create-clinic-legal-document.dto';
import { GenerateVerificationQrDto } from './dto/generate-verification-qr.dto';

@Injectable()
export class ClinicLegalDocumentsService {
	constructor(
		@InjectRepository(ClinicLegalDocument)
		private readonly clinicRepo: Repository<ClinicLegalDocument>,
		private readonly paymentsService: PaymentsService,
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

	async generateVerificationQr(
		documentId: string,
		payload: GenerateVerificationQrDto,
	): Promise<PaymentResponseDto> {
		const doc = await this.findOne(documentId);
		const amount = payload.amount ?? 1000; // small test amount

		// Reuse payment QR flow; use documentId as reference to be picked up in callback
		return this.paymentsService.createDynamicQr({
			prescriptionId: doc.id,
			amount,
		});
	}
}
