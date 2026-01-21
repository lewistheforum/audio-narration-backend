import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ClinicRoom,
  ClinicShift,
  ClinicShiftHour,
  EmployeeSchedule,
  EmployeeTimekeeping,
} from './entities';

import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';
import { Account } from '../accounts/entities/accounts.entity';

/**
 * Schedules Module
 *
 * Manages employee schedules and timekeeping
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClinicRoom,
      ClinicShift,
      ClinicShiftHour,
      EmployeeSchedule,
      EmployeeTimekeeping,
      Account,
    ]),
  ],
  controllers: [SchedulesController],
  providers: [SchedulesService],
  exports: [TypeOrmModule, SchedulesService],
})
export class SchedulesModule { }
