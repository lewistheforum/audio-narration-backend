import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicServiceConfig } from './entities';

/**
 * Service Configs Module
 *
 * Manages clinic service configurations including pricing and duration
 */
@Module({
  imports: [TypeOrmModule.forFeature([ClinicServiceConfig])],
  controllers: [],
  providers: [],
  exports: [TypeOrmModule],
})
export class ServiceConfigsModule {}
