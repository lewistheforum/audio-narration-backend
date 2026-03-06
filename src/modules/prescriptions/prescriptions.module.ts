import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrescriptionsService } from './prescriptions.service';
import { ErmsService } from './erms.service';
import { PrescriptionsController } from './prescriptions.controller';
import { ErmsController } from './erms.controller';
import {
  Medicine,
  ERM,
  EPrescription,
  DetailEPrescription,
  ERMConsultation,
  ERMXray,
  ERMUltrasound,
  ERMLab,
  ERMProcedure,
  ERMBoneDensity,
} from './entities';
import { MedicineRepository, ErmRepository } from './repositories';
import { ServiceAppointment } from '../appointments/entities/service-appointment.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { PdfGeneratorService } from './services';

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
      ERMLab,
      ERMProcedure,
      ERMBoneDensity,
      ServiceAppointment,
      Appointment,
    ]),
  ],
  controllers: [PrescriptionsController, ErmsController],
  providers: [PrescriptionsService, ErmsService, MedicineRepository, ErmRepository, PdfGeneratorService],
  exports: [PrescriptionsService, ErmsService, TypeOrmModule],
})
export class PrescriptionsModule {}
