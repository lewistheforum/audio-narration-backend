import { ApiProperty } from '@nestjs/swagger';
import { AppointmentStatus } from '../enums';
import { AddressDto } from './appointment-response.dto';

/**
 * Doctor Patient Summary DTO
 *
 * Summary information about a patient for doctor's patient history list
 */
export class DoctorPatientSummaryDto {
  @ApiProperty({
    description: 'Patient ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  patientId: string;

  @ApiProperty({
    description: 'Patient full name',
    example: 'Nguyễn Văn A',
  })
  fullName: string;

  @ApiProperty({
    description: 'Date of birth',
    example: '1990-01-15',
    nullable: true,
  })
  dateOfBirth: string | null;

  @ApiProperty({
    description: 'Age',
    example: 36,
    nullable: true,
  })
  age: number | null;

  @ApiProperty({
    description: 'Gender',
    example: 'Male',
    nullable: true,
  })
  gender: string | null;

  @ApiProperty({
    description: 'Phone number',
    example: '0901234567',
    nullable: true,
  })
  phone: string | null;

  @ApiProperty({
    description: 'Email address',
    example: 'patient@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Profile image URL',
    example: 'https://example.com/profile.jpg',
    nullable: true,
  })
  profileImageUrl: string | null;

  @ApiProperty({
    description: 'Patient addresses',
    type: [AddressDto],
    required: false,
  })
  addresses?: AddressDto[];

  @ApiProperty({
    description: 'First visit date with this doctor',
    example: '2025-01-10',
  })
  firstVisitDate: string;

  @ApiProperty({
    description: 'Last visit date with this doctor',
    example: '2026-02-15',
  })
  lastVisitDate: string;

  @ApiProperty({
    description: 'Total number of visits with this doctor',
    example: 5,
  })
  totalVisits: number;

  @ApiProperty({
    description: 'Last diagnosis from most recent consultation',
    example: 'Chronic lower back pain',
    nullable: true,
  })
  lastDiagnosis: string | null;

  @ApiProperty({
    description: 'Status of last appointment',
    enum: AppointmentStatus,
    example: AppointmentStatus.COMPLETED,
  })
  lastAppointmentStatus: AppointmentStatus;
}

/**
 * Doctor Patient History Response DTO
 *
 * Response for GET /api/doctors/me/patients
 * Contains paginated list of patients with their visit summary
 */
export class DoctorPatientHistoryResponseDto {
  @ApiProperty({
    description: 'Total number of patients',
    example: 150,
  })
  total: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of records per page',
    example: 20,
  })
  limit: number;

  @ApiProperty({
    description: 'List of patients',
    type: [DoctorPatientSummaryDto],
  })
  patients: DoctorPatientSummaryDto[];
}
