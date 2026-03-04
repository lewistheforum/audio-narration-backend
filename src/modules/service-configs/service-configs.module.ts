import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicServiceConfig } from './entities';
import { ClinicServiceConfigRepository } from './repositories';
import { ServiceConfigsService } from './service-configs.service';
import { ServiceConfigsController } from './service-configs.controller';

/**
 * Service Configs Module
 *
 * Manages clinic service configurations including pricing and duration
 */
@Module({
  imports: [TypeOrmModule.forFeature([ClinicServiceConfig])],
  controllers: [ServiceConfigsController],
  providers: [ClinicServiceConfigRepository, ServiceConfigsService],
  exports: [TypeOrmModule, ClinicServiceConfigRepository, ServiceConfigsService],
})
export class ServiceConfigsModule {}
