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
import { DoctorInformation } from '../accounts/entities/doctor_information.entity';
import { ClinicRoomRepository } from './repositories/clinic-room.repository';
import { ClinicShiftRepository } from './repositories/clinic-shift.repository';
import { ClinicShiftHourRepository } from './repositories/clinic-shift-hour.repository';
import { EmployeeScheduleRepository } from './repositories/employee-schedule.repository';
import { ClinicShiftHoursService } from './clinic-shift-hours.service';
import { ClinicShiftHoursController } from './clinic-shift-hours.controller';

import { ClinicShiftsService } from './clinic-shifts.service';
import { ClinicShiftsController } from './clinic-shifts.controller';

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
      DoctorInformation,
    ]),
  ],
  controllers: [
    SchedulesController,
    ClinicShiftHoursController,
    ClinicShiftsController
  ],
  providers: [
    SchedulesService,
    ClinicRoomRepository,
    ClinicShiftRepository,
    ClinicShiftHourRepository,
    EmployeeScheduleRepository,
    ClinicShiftHoursService,
    ClinicShiftsService,
  ],
  exports: [
    TypeOrmModule,
    SchedulesService,
    ClinicShiftHoursService,
    ClinicShiftsService
  ],
})
export class SchedulesModule { }
