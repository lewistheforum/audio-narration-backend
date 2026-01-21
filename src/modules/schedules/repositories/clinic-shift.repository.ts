import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ClinicShift } from '../entities/clinic-shift.entity';

@Injectable()
export class ClinicShiftRepository extends Repository<ClinicShift> {
  constructor(private dataSource: DataSource) {
    super(ClinicShift, dataSource.createEntityManager());
  }
}
