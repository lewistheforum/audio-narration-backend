import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment, AppointmentPackage, ServiceAppointment } from './entities';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { AppointmentRepository, AppointmentPackageRepository } from './repositories';
import { ClinicStaffInformation, Account } from '../accounts/entities';
import { ClinicStaffInformationRepository, AccountRepository } from '../accounts/repositories';
import { EmployeeSchedule } from '../schedules/entities/employee-schedule.entity';
import { EmployeeScheduleRepository } from '../schedules/repositories/employee-schedule.repository';

/**
 * Appointments Module
 *
 * Manages patient appointment bookings and related services
 *
 * Features:
 * - Staff viewing clinic appointments
 * - Filtering and pagination support
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Appointment,
      AppointmentPackage,
      ServiceAppointment,
      ClinicStaffInformation,
      EmployeeSchedule,
      Account,
    ]),
  ],
  controllers: [AppointmentsController],
  providers: [
    AppointmentsService,
    AppointmentRepository,
    AppointmentPackageRepository,
    ClinicStaffInformationRepository,
    EmployeeScheduleRepository,
    AccountRepository,
  ],
  exports: [TypeOrmModule, AppointmentsService],
})
export class AppointmentsModule {}
