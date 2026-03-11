import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { AppointmentStatus } from '../enums';
import { formatToVietnamTime } from '../../../common/utils/date.util';

/**
 * Service Detail DTO for Appointment Response
 *
 * Contains service information for an appointment
 */
export class ServiceDetailDto {
  @ApiProperty({ description: 'Service ID' })
  id: string;

  @ApiProperty({ description: 'Service name' })
  serviceName: string;

  @ApiProperty({ description: 'Service description', required: false })
  description?: string;

  @ApiProperty({ description: 'Service price', example: 200000 })
  price: number;
}

/**
 * Clinic Room Detail DTO for Appointment Response
 *
 * Contains clinic room information
 */
export class ClinicRoomDto {
  @ApiProperty({ description: 'Room ID' })
  id: string;

  @ApiProperty({ description: 'Room name' })
  roomName: string;
}

/**
 * Appointment Response DTO
 *
 * Standardized response structure for appointment data
 */
export class AppointmentResponseDto {
  @ApiProperty({ description: 'Appointment ID' })
  id: string;

  @ApiProperty({ description: 'Patient ID' })
  patientId: string;

  @ApiProperty({ description: 'Patient full name' })
  patientFullName: string;

  @ApiProperty({ description: 'Patient email', required: false })
  patientEmail?: string;

  @ApiProperty({ description: 'Patient phone', required: false })
  patientPhone?: string;

  @ApiProperty({ description: 'Clinic ID' })
  clinicId: string;

  @ApiProperty({ description: 'Clinic name' })
  clinicName: string;

  @ApiProperty({ description: 'Doctor ID', required: false })
  doctorId?: string | null;

  @ApiProperty({ description: 'Doctor full name', required: false })
  doctorFullName?: string | null;

  @ApiProperty({ description: 'Clinic rooms', type: [ClinicRoomDto], required: false })
  clinicRooms?: ClinicRoomDto[];

  @ApiProperty({ description: 'Services', type: [ServiceDetailDto], required: false })
  services?: ServiceDetailDto[];

  @ApiProperty({ description: 'Appointment date' })
  @Transform(({ value }) => formatToVietnamTime(value))
  appointmentDate: Date;

  @ApiProperty({ description: 'Appointment hour' })
  @Transform(({ value }) => formatToVietnamTime(value))
  appointmentHour: Date;

  @ApiProperty({ description: 'Extra hour if applicable', required: false })
  @Transform(({ value }) => value ? formatToVietnamTime(value) : value)
  extraHour?: Date | null;

  @ApiProperty({ description: 'Total amount', example: 500000 })
  total: number;

  @ApiProperty({ description: 'Appointment status', enum: AppointmentStatus })
  status: AppointmentStatus;

  @ApiProperty({ description: 'Patient note', required: false })
  patientNote?: string | null;

  @ApiProperty({ description: 'Reject reason if cancelled', required: false })
  rejectReason?: string | null;

  @ApiProperty({ description: 'Creation timestamp' })
  @Transform(({ value }) => formatToVietnamTime(value))
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @Transform(({ value }) => formatToVietnamTime(value))
  updatedAt: Date;
}

/**
 * Paginated Appointment Response DTO
 *
 * Response structure with pagination metadata
 */
export class PaginatedAppointmentResponseDto {
  @ApiProperty({ type: [AppointmentResponseDto] })
  data: AppointmentResponseDto[];

  @ApiProperty({ description: 'Total number of appointments' })
  total: number;

  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Number of items per page' })
  limit: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;
}
