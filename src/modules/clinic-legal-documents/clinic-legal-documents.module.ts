import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsModule } from '../payments/payments.module';
import { ClinicLegalDocument } from '../payments/entities/clinic-legal-document.entity';
import { ClinicLegalDocumentsController } from './clinic-legal-documents.controller';
import { ClinicLegalDocumentsService } from './clinic-legal-documents.service';

@Module({
	imports: [TypeOrmModule.forFeature([ClinicLegalDocument]), PaymentsModule],
	controllers: [ClinicLegalDocumentsController],
	providers: [ClinicLegalDocumentsService],
})
export class ClinicLegalDocumentsModule {}
