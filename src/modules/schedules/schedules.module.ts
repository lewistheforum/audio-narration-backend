import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ClinicRoom,
  ClinicShift,
  ClinicShiftHour,
  EmployeeSchedule,
} from './entities';

import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';
import { Account } from '../accounts/entities/accounts.entity';
import { ClinicRoomRepository } from './repositories/clinic-room.repository';
import { ClinicShiftRepository } from './repositories/clinic-shift.repository';
import { ClinicShiftHourRepository } from './repositories/clinic-shift-hour.repository';
import { EmployeeScheduleRepository } from './repositories/employee-schedule.repository';

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
      Account,
    ]),
  ],
  controllers: [SchedulesController],
  providers: [
    SchedulesService,
    ClinicRoomRepository,
    ClinicShiftRepository,
    ClinicShiftHourRepository,
    EmployeeScheduleRepository,
  ],
  exports: [TypeOrmModule, SchedulesService],
})
export class SchedulesModule { }
