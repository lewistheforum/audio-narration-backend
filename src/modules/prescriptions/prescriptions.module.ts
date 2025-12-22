import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrescriptionsService } from './prescriptions.service';
import { PrescriptionsController } from './prescriptions.controller';
import {
  Medicine,
  ERM,
  EPrescription,
  DetailEPrescription,
  ERMConsultation,
  ERMXray,
  ERMUltrasound,
  ERMProcedure,
  ERMBoneDensity,
} from './entities';
import { MedicineRepository } from './repositories';

/**
 * Prescriptions Module
 * 
 * Manages medicines database for Electronic Medical Records (ERM)
 * and Electronic Prescriptions (E-Prescriptions)
 * 
 * Features:
 * - Medicine CRUD operations
 * - Electronic Medical Records (ERM) for various service types
 * - Electronic Prescriptions and detailed prescriptions
 * - Medical consultation records
 * - Diagnostic imaging records (X-ray, Ultrasound)
 * - Medical procedures records
 * - Bone density scan records
 * - Lab test panels
 * - Search by name, therapeutic class
 * - Habit-forming medicines tracking
 * - Soft delete support
 * - Bulk import via script: src/common/scripts/bulk-import-medicines.ts
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Medicine,
      ERM,
      EPrescription,
      DetailEPrescription,
      ERMConsultation,
      ERMXray,
      ERMUltrasound,
      ERMProcedure,
      ERMBoneDensity,
    ]),
  ],
  controllers: [PrescriptionsController],
  providers: [PrescriptionsService, MedicineRepository],
  exports: [PrescriptionsService, TypeOrmModule],
})
export class PrescriptionsModule {}
