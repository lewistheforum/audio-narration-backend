import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClinicsLegalDocuments } from '../accounts/entities/clinics_legal_documents.entity';
import { CreateClinicLegalDocumentDto } from './dto/create-clinic-legal-document.dto';

@Injectable()
export class ClinicLegalDocumentsService {
	constructor(
		@InjectRepository(ClinicsLegalDocuments)
		private readonly clinicRepo: Repository<ClinicsLegalDocuments>,
	) {}

	async create(dto: CreateClinicLegalDocumentDto): Promise<ClinicsLegalDocuments> {
		const doc = this.clinicRepo.create(dto);
		return this.clinicRepo.save(doc);
	}

	async findOne(_id: string): Promise<ClinicsLegalDocuments> {
		const doc = await this.clinicRepo.findOne({ where: { _id } });
		if (!doc) {
			throw new NotFoundException('Clinic legal document not found');
		}
		return doc;
	}
}
