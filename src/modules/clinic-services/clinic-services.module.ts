import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicServiceCategory, ClinicService } from './entities';

/**
 * Clinic Services Module
 *
 * Manages clinic services and their categories
 */
@Module({
  imports: [TypeOrmModule.forFeature([ClinicServiceCategory, ClinicService])],
  controllers: [],
  providers: [],
  exports: [TypeOrmModule],
})
export class ClinicServicesModule {}
