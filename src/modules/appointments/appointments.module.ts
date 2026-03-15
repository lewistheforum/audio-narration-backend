import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment, AppointmentPackage, ServiceAppointment } from './entities';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { BookingSessionService } from './booking-session.service';
import { AppointmentRepository, AppointmentPackageRepository } from './repositories';
import { ClinicStaffInformation, Account } from '../accounts/entities';
import { ClinicStaffInformationRepository, AccountRepository } from '../accounts/repositories';
import { EmployeeSchedule } from '../schedules/entities/employee-schedule.entity';
import { EmployeeScheduleRepository } from '../schedules/repositories/employee-schedule.repository';
import { ClinicServiceConfig } from '../service-configs/entities/clinic-service-config.entity';
import { ClinicShiftHour } from '../schedules/entities/clinic-shift-hour.entity';
import { RedisModule } from '../../config/redis.config';
import { MailerModule } from '../mailer/mailer.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { PrescriptionsModule } from '../prescriptions/prescriptions.module';

/**
 * Appointments Module
 *
 * Manages patient appointment bookings and related services
 *
 * Features:
 * - Staff viewing clinic appointments
 * - Patient booking flow (Option 1: Service-first)
 * - Redis-based booking session management
 * - Filtering and pagination support
 *
 * Consolidated Structure:
 * - All patient booking endpoints now in AppointmentsController
 * - All booking logic now in AppointmentsService
 * - BookingSessionService handles Redis operations exclusively
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
      ClinicServiceConfig,
      ClinicShiftHour,
    ]),
    RedisModule,
    MailerModule,
    forwardRef(() => TransactionsModule),
    PrescriptionsModule,
  ],
  controllers: [AppointmentsController],
  providers: [
    AppointmentsService,
    BookingSessionService,
    AppointmentRepository,
    AppointmentPackageRepository,
    ClinicStaffInformationRepository,
    EmployeeScheduleRepository,
    AccountRepository,
  ],
  exports: [TypeOrmModule, AppointmentsService, BookingSessionService],
})
export class AppointmentsModule { }
