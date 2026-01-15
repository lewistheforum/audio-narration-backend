import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ClinicRoom,
  ClinicShift,
  ClinicShiftHour,
  EmployeeSchedule,
  EmployeeTimekeeping,
} from './entities';

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
    ]),
  ],
  controllers: [],
  providers: [],
  exports: [TypeOrmModule],
})
export class SchedulesModule {}
