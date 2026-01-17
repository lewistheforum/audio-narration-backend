import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicServiceCategory, ClinicService } from './entities';
import { ClinicServicesController } from './clinic-services.controller';
import { ClinicServicesService } from './clinic-services.service';
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
  controllers: [ClinicServicesController],
  providers: [
    ClinicServiceCategoryRepository,
    ClinicServiceRepository,
    ClinicServicesService,
  ],
  exports: [
    TypeOrmModule,
    ClinicServiceCategoryRepository,
    ClinicServiceRepository,
  ],
})
export class ClinicServicesModule { }
