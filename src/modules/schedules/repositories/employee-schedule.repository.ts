import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { EmployeeSchedule } from '../entities/employee-schedule.entity';

@Injectable()
export class EmployeeScheduleRepository extends Repository<EmployeeSchedule> {
  constructor(private dataSource: DataSource) {
    super(EmployeeSchedule, dataSource.createEntityManager());
  }
}
