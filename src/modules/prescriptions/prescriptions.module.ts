import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrescriptionsService } from './prescriptions.service';
import { PrescriptionsController } from './prescriptions.controller';
import { Medicine } from './entities/medicine.entity';

/**
 * Prescriptions Module
 * 
 * Manages medicines database for Electronic Medical Records (ERM)
 * and Electronic Prescriptions (E-Prescriptions)
 * 
 * Features:
 * - Medicine CRUD operations
 * - Search by name, therapeutic class
 * - Habit-forming medicines tracking
 * - Soft delete support
 * - Bulk import via script: src/common/scripts/bulk-import-medicines.ts
 */
@Module({
  imports: [TypeOrmModule.forFeature([Medicine])],
  controllers: [PrescriptionsController],
  providers: [PrescriptionsService],
  exports: [PrescriptionsService],
})
export class PrescriptionsModule {}
