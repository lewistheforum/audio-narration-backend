import { ApiProperty } from '@nestjs/swagger';
import { AddressDto, AppointmentResponseDto } from './appointment-response.dto';

/**
 * Patient Detail for Doctor View DTO
 *
 * Patient information for doctor's patient history view
 */
export class DoctorViewPatientDetailDto {
  @ApiProperty({
    description: 'Patient account UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  patient_id: string;

  @ApiProperty({
    description: 'Patient full name',
    example: 'Nguyễn Văn A',
  })
  full_name: string;

  @ApiProperty({
    description: 'Phone number',
    example: '0901234567',
  })
  phone: string;

  @ApiProperty({
    description: 'Email address',
    example: 'patient@example.com',
    nullable: true,
  })
  email: string | null;

  @ApiProperty({
    description: 'Gender',
    example: 'male',
    nullable: true,
  })
  gender: string | null;

  @ApiProperty({
    description: 'Date of birth',
    example: '1990-05-15',
    nullable: true,
  })
  date_of_birth: string | null;

  @ApiProperty({
    description: 'Age calculated from date of birth',
    example: 34,
    nullable: true,
  })
  age: number | null;

  @ApiProperty({
    description: 'Full address string',
    example: '123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM',
    nullable: true,
  })
  address: string | null;

  @ApiProperty({
    description: 'Patient addresses with full details',
    type: [AddressDto],
    required: false,
  })
  addresses?: AddressDto[];
}

/**
 * Patient Visit Statistics DTO
 *
 * Statistics about patient visits with the doctor
 */
export class PatientVisitStatisticsDto {
  @ApiProperty({
    description: 'First visit date',
    example: '2023-06-15',
    nullable: true,
  })
  first_visit: string | null;

  @ApiProperty({
    description: 'Last visit date',
    example: '2024-01-20',
    nullable: true,
  })
  last_visit: string | null;

  @ApiProperty({
    description: 'Total number of COMPLETED visits',
    example: 5,
  })
  total_visits: number;

  @ApiProperty({
    description: 'Number of unique services used',
    example: 3,
  })
  services_used: number;
}

/**
 * Service Summary in Appointment DTO
 */
export class AppointmentServiceSummaryDto {
  @ApiProperty({
    description: 'Service name',
    example: 'Khám tổng quát',
  })
  service_name: string;

  @ApiProperty({
    description: 'Service type/category',
    example: 'general',
  })
  service_type: string;
}

/**
 * Patient Appointment History Item DTO
 *
 * Single appointment in patient's history
 */
export class PatientAppointmentHistoryItemDto {
  @ApiProperty({
    description: 'Appointment UUID',
    example: '456e4567-e89b-12d3-a456-426614174000',
  })
  appointment_id: string;

  @ApiProperty({
    description: 'Appointment date',
    example: '2024-01-20',
  })
  appointment_date: string;

  @ApiProperty({
    description: 'Appointment hour timestamp',
    example: '2024-01-20T09:00:00Z',
  })
  appointment_hour: Date;

  @ApiProperty({
    description: 'Appointment status',
    example: 'COMPLETED',
  })
  status: string;

  @ApiProperty({
    description: 'List of services in this appointment',
    type: [AppointmentServiceSummaryDto],
  })
  services: AppointmentServiceSummaryDto[];
}

/**
 * Paginated Appointments Response DTO
 */
export class PaginatedAppointmentsDto {
  @ApiProperty({
    description: 'Total number of appointments matching filters',
    example: 5,
  })
  total: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10,
  })
  limit: number;

  @ApiProperty({
    description: 'List of appointments with comprehensive details (patient, doctor, services, clinic rooms, pricing)',
    type: [AppointmentResponseDto],
  })
  appointments: AppointmentResponseDto[];
}

/**
 * Doctor Patient Detail Response DTO
 *
 * Complete response for patient detail view
 */
export class DoctorPatientDetailResponseDto {
  @ApiProperty({
    description: 'Patient personal information',
    type: DoctorViewPatientDetailDto,
  })
  patient: DoctorViewPatientDetailDto;

  @ApiProperty({
    description: 'Visit statistics with this doctor',
    type: PatientVisitStatisticsDto,
  })
  statistics: PatientVisitStatisticsDto;

  @ApiProperty({
    description: 'Paginated appointment history',
    type: PaginatedAppointmentsDto,
  })
  appointment_history: PaginatedAppointmentsDto;
}
