import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionsModule } from '../transactions/transactions.module';
import { ClinicLegalDocument } from '../transactions/entities/clinic-legal-document.entity';
import { ClinicLegalDocumentsController } from './clinic-legal-documents.controller';
import { ClinicLegalDocumentsService } from './clinic-legal-documents.service';

@Module({
	imports: [TypeOrmModule.forFeature([ClinicLegalDocument]), TransactionsModule],
	controllers: [ClinicLegalDocumentsController],
	providers: [ClinicLegalDocumentsService],
})
export class ClinicLegalDocumentsModule {}
