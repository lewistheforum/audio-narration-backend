import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ClinicShiftHour } from '../entities/clinic-shift-hour.entity';

@Injectable()
export class ClinicShiftHourRepository extends Repository<ClinicShiftHour> {
  constructor(private dataSource: DataSource) {
    super(ClinicShiftHour, dataSource.createEntityManager());
  }
}
