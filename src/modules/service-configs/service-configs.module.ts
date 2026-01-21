import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicServiceConfig } from './entities';
import { ClinicServiceConfigRepository } from './repositories';

/**
 * Service Configs Module
 *
 * Manages clinic service configurations including pricing and duration
 */
@Module({
  imports: [TypeOrmModule.forFeature([ClinicServiceConfig])],
  controllers: [],
  providers: [ClinicServiceConfigRepository],
  exports: [TypeOrmModule, ClinicServiceConfigRepository],
})
export class ServiceConfigsModule {}
