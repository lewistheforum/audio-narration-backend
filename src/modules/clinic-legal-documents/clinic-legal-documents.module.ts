import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionsModule } from '../transactions/transactions.module';
import { ClinicsLegalDocuments } from '../accounts/entities/clinics_legal_documents.entity';
import { Account } from '../accounts/entities/accounts.entity';
import { ClinicLegalDocumentsController } from './clinic-legal-documents.controller';
import { ClinicLegalDocumentsService } from './clinic-legal-documents.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClinicsLegalDocuments, Account]),
    TransactionsModule,
  ],
  controllers: [ClinicLegalDocumentsController],
  providers: [ClinicLegalDocumentsService],
})
export class ClinicLegalDocumentsModule {}
