import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ClinicServiceConfig } from '../entities/clinic-service-config.entity';

@Injectable()
export class ClinicServiceConfigRepository extends Repository<ClinicServiceConfig> {
  constructor(private dataSource: DataSource) {
    super(ClinicServiceConfig, dataSource.createEntityManager());
  }
}
