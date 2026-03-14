import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { AppointmentStatus, PaymentType, AppointmentPackageStatus } from '../enums';
import { ERMRecordType, ERMStatus } from '../../prescriptions/enums/erm-enums';
import { formatToVietnamTime } from '../../../common/utils/date.util';

/**
 * Enhanced Clinic Summary DTO for Patient Appointment Detail
 */
export class ClinicDetailSummaryDto {
  @ApiProperty({ description: 'Clinic ID', example: 'c1a2b3c4-d5e6-7890-abcd-ef1234567890' })
  _id: string;

  @ApiProperty({ description: 'Clinic business name', example: 'ABC Clinic' })
  name: string;

  @ApiPropertyOptional({ description: 'Clinic address', example: '123 Main Street, District 1, Ho Chi Minh City' })
  address?: string;

  @ApiPropertyOptional({ description: 'Clinic phone number', example: '0901234567' })
  phone?: string;

  @ApiPropertyOptional({ description: 'Clinic profile picture URL' })
  profilePicture?: string;
}

/**
 * Enhanced Doctor Summary DTO for Patient Appointment Detail
 */
export class DoctorDetailSummaryDto {
  @ApiProperty({ description: 'Doctor ID', example: 'd1a2b3c4-d5e6-7890-abcd-ef1234567890' })
  _id: string;

  @ApiProperty({ description: 'Doctor full name', example: 'Dr. John Smith' })
  name: string;

  @ApiPropertyOptional({ description: 'Doctor profile picture URL' })
  profilePicture?: string;

  @ApiPropertyOptional({ description: 'Academic degree', example: 'Specialist Level I' })
  academicDegree?: string;

  @ApiPropertyOptional({ description: 'Position', example: 'Head of Orthopedics Department' })
  position?: string;
}

/**
 * ERM Summary DTO for Patient Appointment Detail
 */
export class ERMSummaryDto {
  @ApiProperty({ description: 'ERM ID', example: 'e1a2b3c4-d5e6-7890-abcd-ef1234567890' })
  _id: string;

  @ApiProperty({ 
    description: 'ERM record type', 
    enum: ERMRecordType,
    example: ERMRecordType.XRAY 
  })
  record_type: ERMRecordType;

  @ApiProperty({ 
    description: 'ERM status', 
    enum: ERMStatus,
    example: ERMStatus.COMPLETED 
  })
  status: ERMStatus;
}

/**
 * Clinic Service Summary for Service Appointment
 */
export class ClinicServiceSummaryDto {
  @ApiProperty({ description: 'Service ID', example: 's1a2b3c4-d5e6-7890-abcd-ef1234567890' })
  _id: string;

  @ApiProperty({ description: 'Service name', example: 'Orthopedic Consultation' })
  service_name: string;

  @ApiProperty({ description: 'Service price', example: 270000 })
  price: number;
}

/**
 * Service Appointment Summary DTO
 */
export class ServiceAppointmentSummaryDto {
  @ApiProperty({ description: 'Service appointment ID', example: 'sa1a2b3c4-d5e6-7890-abcd-ef1234567890' })
  _id: string;

  @ApiProperty({ description: 'Clinic service details', type: ClinicServiceSummaryDto })
  clinic_service: ClinicServiceSummaryDto;

  @ApiPropertyOptional({ 
    description: 'ERM summary (if available)', 
    type: ERMSummaryDto 
  })
  erm_summary?: ERMSummaryDto;
}

/**
 * Appointment Package Summary DTO
 */
export class AppointmentPackageSummaryDto {
  @ApiProperty({ description: 'Package ID', example: 'p1a2b3c4-d5e6-7890-abcd-ef1234567890' })
  _id: string;

  @ApiProperty({ description: 'Package amount', example: 270000 })
  amount: number;

  @ApiPropertyOptional({ description: 'Payment method', enum: PaymentType, example: PaymentType.COD })
  payment_type?: PaymentType;

  @ApiPropertyOptional({ 
    description: 'Payment status', 
    enum: AppointmentPackageStatus, 
    example: AppointmentPackageStatus.PENDING_PAYMENT 
  })
  payment_status?: AppointmentPackageStatus;

  @ApiProperty({ 
    description: 'Service appointments in this package', 
    type: [ServiceAppointmentSummaryDto] 
  })
  service_appointments: ServiceAppointmentSummaryDto[];
}

/**
 * E-Prescription Summary DTO
 */
export class EPrescriptionSummaryDto {
  @ApiProperty({ description: 'E-Prescription ID', example: 'ep1a2b3c4-d5e6-7890-abcd-ef1234567890' })
  _id: string;
}

/**
 * Patient Appointment Detail Response DTO
 *
 * Comprehensive appointment details for patient view including:
 * - Clinic and doctor information
 * - Appointment packages with services
 * - ERM summaries for each service
 * - E-prescription summary (if completed)
 * - Status-based conditional fields
 */
export class PatientAppointmentDetailResponseDto {
  @ApiProperty({ description: 'Appointment ID', example: 'a1a2b3c4-d5e6-7890-abcd-ef1234567890' })
  _id: string;

  @ApiProperty({ description: 'Clinic information', type: ClinicDetailSummaryDto })
  clinic: ClinicDetailSummaryDto;

  @ApiPropertyOptional({ 
    description: 'Doctor information (null if not assigned)', 
    type: DoctorDetailSummaryDto 
  })
  doctor?: DoctorDetailSummaryDto;

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

  @ApiPropertyOptional({ description: 'Clinic room name', example: 'Room 101', nullable: true })
  clinic_room?: string | null;

  @ApiProperty({ 
    description: 'Appointment status', 
    enum: AppointmentStatus, 
    example: AppointmentStatus.CONFIRMED 
  })
  status: AppointmentStatus;

  @ApiProperty({ description: 'Total amount for the appointment', example: 270000 })
  total: number;

  @ApiPropertyOptional({ description: 'Patient note for the appointment' })
  patient_note?: string;

  @ApiPropertyOptional({ 
    description: 'Reject reason (only available when status is CANCELLED)',
    example: 'Doctor suddenly unavailable' 
  })
  reject_reason?: string;

  @ApiPropertyOptional({ 
    description: 'E-prescription summary (only available when status is COMPLETED)', 
    type: EPrescriptionSummaryDto 
  })
  e_prescription_summary?: EPrescriptionSummaryDto;

  @ApiProperty({ 
    description: 'Appointment packages with services and ERM summaries', 
    type: [AppointmentPackageSummaryDto] 
  })
  appointment_packages: AppointmentPackageSummaryDto[];

  @ApiProperty({ description: 'Appointment creation timestamp', example: '2026-03-10T10:00:00.000Z' })
  @Transform(({ value }) => formatToVietnamTime(value))
  created_at: Date;

  @ApiProperty({ description: 'Appointment last update timestamp', example: '2026-03-10T10:00:00.000Z' })
  @Transform(({ value }) => formatToVietnamTime(value))
  updated_at: Date;
}
