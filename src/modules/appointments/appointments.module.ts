import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment, AppointmentPackage, ServiceAppointment } from './entities';

/**
 * Appointments Module
 *
 * Manages patient appointment bookings and related services
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Appointment,
      AppointmentPackage,
      ServiceAppointment,
    ]),
  ],
  controllers: [],
  providers: [],
  exports: [TypeOrmModule],
})
export class AppointmentsModule {}
