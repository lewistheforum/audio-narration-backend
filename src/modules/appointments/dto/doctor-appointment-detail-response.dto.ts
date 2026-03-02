import { ApiProperty } from '@nestjs/swagger';
import { AppointmentStatus } from '../enums';
import { PatientInfoDto } from './patient-info.dto';
import { ServiceSummaryDto } from './service-summary.dto';

/**
 * Doctor Appointment Detail Response DTO
 *
 * Response for GET /appointments/doctor/:id
 * Contains full appointment details including patient information
 */
export class DoctorAppointmentDetailResponseDto {
  @ApiProperty({
    description: 'Appointment ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  appointmentId: string;

  @ApiProperty({
    description: 'Patient information',
    type: PatientInfoDto,
  })
  patient: PatientInfoDto;

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
    description: 'List of services in this appointment',
    type: [ServiceSummaryDto],
  })
  services: ServiceSummaryDto[];

  @ApiProperty({
    description: 'Patient note or reason for visit',
    example: 'Đau lưng kéo dài 2 tuần',
    nullable: true,
  })
  patientNote: string | null;

  @ApiProperty({
    description: 'Appointment status',
    enum: AppointmentStatus,
    example: AppointmentStatus.IN_PROGRESS,
  })
  status: AppointmentStatus;

  @ApiProperty({
    description: 'Message about status change if applicable',
    example: 'Appointment status updated to IN_PROGRESS',
    required: false,
  })
  message?: string;
}
