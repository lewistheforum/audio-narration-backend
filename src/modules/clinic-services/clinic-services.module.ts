import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicServiceCategory, ClinicService } from './entities';
import {
  ClinicServiceCategoryRepository,
  ClinicServiceRepository,
} from './repositories';

/**
 * Clinic Services Module
 *
 * Manages clinic services and their categories
 */
@Module({
  imports: [TypeOrmModule.forFeature([ClinicServiceCategory, ClinicService])],
  controllers: [],
  providers: [
    ClinicServiceCategoryRepository,
    ClinicServiceRepository,
  ],
  exports: [
    TypeOrmModule,
    ClinicServiceCategoryRepository,
    ClinicServiceRepository,
  ],
})
export class ClinicServicesModule {}
