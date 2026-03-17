import { ApiProperty } from '@nestjs/swagger';
import { AppointmentStatus } from '../enums';
import { ServiceSummaryDto } from './service-summary.dto';

/**
 * Doctor Appointment Item DTO
 *
 * Represents a single appointment in the doctor's list
 */
export class DoctorAppointmentItemDto {
  @ApiProperty({
    description: 'Appointment ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  appointmentId: string;

  @ApiProperty({
    description: 'Patient ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  patientId: string;

  @ApiProperty({
    description: 'Patient full name',
    example: 'Nguyễn Văn A',
  })
  patientName: string;

  @ApiProperty({
    description: 'Appointment date',
    example: '2026-02-24',
  })
  appointmentDate: string;

  @ApiProperty({
    description: 'Appointment hour (timestamp)',
    example: '2026-02-24T09:00:00Z',
  })
  appointmentHour: Date;

  @ApiProperty({
    description: 'Clinic ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  clinicId: string;

  @ApiProperty({
    description: 'Doctor shift hour ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  doctorShiftHourId: string | null;

  @ApiProperty({
    description: 'List of services in this appointment',
    type: [ServiceSummaryDto],
  })
  services: ServiceSummaryDto[];

  @ApiProperty({
    description: 'Appointment status',
    enum: AppointmentStatus,
    example: AppointmentStatus.CHECKED_IN,
  })
  status: AppointmentStatus;

  @ApiProperty({
    description: 'Transaction ID if payment has been made',
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  transactionId: string | null;
}

/**
 * Doctor Appointment List Response DTO
 *
 * Response for GET /appointments/doctor/me
 */
export class DoctorAppointmentListResponseDto {
  @ApiProperty({
    description: 'List of appointments',
    type: [DoctorAppointmentItemDto],
  })
  appointments: DoctorAppointmentItemDto[];
}
