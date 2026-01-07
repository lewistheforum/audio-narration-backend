import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ClinicShift,
  ClinicShiftHour,
  DoctorSchedule,
  DoctorTimekeeping,
} from './entities';

/**
 * Schedules Module
 *
 * Manages doctor schedules and timekeeping
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClinicShift,
      ClinicShiftHour,
      DoctorSchedule,
      DoctorTimekeeping,
    ]),
  ],
  controllers: [],
  providers: [],
  exports: [TypeOrmModule],
})
export class SchedulesModule {}
