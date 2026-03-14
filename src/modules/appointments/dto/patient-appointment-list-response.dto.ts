import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { AppointmentStatus, PaymentType, AppointmentPackageStatus } from '../enums';
import { formatToVietnamTime } from '../../../common/utils/date.util';

/**
 * Clinic Summary DTO for Patient Appointment List
 */
export class ClinicSummaryDto {
  @ApiProperty({ description: 'Clinic ID' })
  _id: string;

  @ApiProperty({ description: 'Clinic business name', example: 'ABC Clinic' })
  name: string;

  @ApiPropertyOptional({ description: 'Clinic address', example: '123 Main Street, District 1, Ho Chi Minh City' })
  address?: string;
}

/**
 * Doctor Summary DTO for Patient Appointment List
 */
export class DoctorSummaryDto {
  @ApiProperty({ description: 'Doctor ID' })
  _id: string;

  @ApiProperty({ description: 'Doctor full name', example: 'Dr. John Smith' })
  name: string;

  @ApiPropertyOptional({ description: 'Doctor profile picture URL' })
  profilePicture?: string;
}

/**
 * Service Detail DTO for Patient Appointment List
 */
export class PatientServiceDto {
  @ApiProperty({ description: 'Service ID' })
  service_id: string;

  @ApiProperty({ description: 'Service name', example: 'General Checkup' })
  service_name: string;

  @ApiProperty({ description: 'Original service price', example: 200000 })
  price: number;

  @ApiProperty({ description: 'Discount percentage', example: 10 })
  discount: number;

  @ApiProperty({ description: 'Final price after discount', example: 180000 })
  final_price: number;
}

/**
 * Patient Appointment List Item DTO
 *
 * Represents a single appointment in the patient's appointment list
 */
export class PatientAppointmentListItemDto {
  @ApiProperty({ description: 'Appointment ID' })
  _id: string;

  @ApiProperty({ description: 'Clinic information', type: ClinicSummaryDto })
  clinic: ClinicSummaryDto;

  @ApiPropertyOptional({ description: 'Doctor information (null if not assigned)', type: DoctorSummaryDto })
  doctor?: DoctorSummaryDto;

  @ApiProperty({ description: 'Appointment date', example: '2026-03-15' })
  @Transform(({ value }) => formatToVietnamTime(value))
  appointment_date: Date;

  @ApiProperty({ description: 'Appointment hour (ISO timestamp)', example: '2026-03-15T08:00:00.000Z' })
  @Transform(({ value }) => formatToVietnamTime(value))
  appointment_hour: Date;

  @ApiPropertyOptional({ description: 'Shift start hour', example: '08:00:00' })
  start_hour?: string;

  @ApiPropertyOptional({ description: 'Shift end hour', example: '09:00:00' })
  end_hour?: string;

  @ApiProperty({ description: 'Appointment status', enum: AppointmentStatus, example: AppointmentStatus.PENDING })
  status: AppointmentStatus;

  @ApiProperty({ description: 'Total amount for the appointment', example: 270000 })
  total: number;

  @ApiPropertyOptional({ description: 'Payment method', enum: PaymentType, example: PaymentType.COD })
  payment_type?: PaymentType;

  @ApiPropertyOptional({ 
    description: 'Payment status from appointment package', 
    enum: AppointmentPackageStatus, 
    example: AppointmentPackageStatus.PENDING_PAYMENT 
  })
  payment_status?: AppointmentPackageStatus;

  @ApiProperty({ description: 'List of services in this appointment', type: [PatientServiceDto] })
  services: PatientServiceDto[];
}

/**
 * Pagination Metadata DTO
 */
export class PaginationMetaDto {
  @ApiProperty({ description: 'Total number of items', example: 25 })
  total: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page: number;

  @ApiProperty({ description: 'Number of items per page', example: 10 })
  limit: number;

  @ApiProperty({ description: 'Total number of pages', example: 3 })
  total_pages: number;
}

/**
 * Patient Appointment List Response DTO
 *
 * Paginated response for patient's appointment list
 */
export class PatientAppointmentListResponseDto {
  @ApiProperty({ description: 'Array of appointments', type: [PatientAppointmentListItemDto] })
  data: PatientAppointmentListItemDto[];

  @ApiProperty({ description: 'Pagination metadata', type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
