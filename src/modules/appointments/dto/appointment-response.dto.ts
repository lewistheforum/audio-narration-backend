import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { AppointmentStatus } from '../enums';
import { formatToVietnamTime } from '../../../common/utils/date.util';
import { AccountStatus } from 'src/modules/accounts/enums';

/**
 * Address DTO for Patient Information
 *
 * Contains address details
 */
export class AddressDto {
  @ApiProperty({ description: 'Address ID' })
  id: string;

  @ApiProperty({ description: 'Full address text' })
  address: string;

  @ApiProperty({ description: 'Ward code' })
  ward: string;

  @ApiProperty({ description: 'Ward name' })
  wardName: string;

  @ApiProperty({ description: 'District code' })
  district: string;

  @ApiProperty({ description: 'District name' })
  districtName: string;

  @ApiProperty({ description: 'Province code' })
  province: string;

  @ApiProperty({ description: 'Province name' })
  provinceName: string;
}

/**
 * Service Detail DTO for Appointment Response
 *
 * Contains service information for an appointment
 */
export class ServiceDetailDto {
  @ApiProperty({
    description: 'Service appointment ID',
    required: false,
  })
  serviceAppointmentId?: string;

  @ApiProperty({ description: 'Service ID' })
  id: string;

  @ApiProperty({ description: 'Service name' })
  serviceName: string;

  @ApiProperty({ description: 'Service description', required: false })
  description?: string;

  @ApiProperty({ description: 'Service price', example: 200000 })
  price: number;

  @ApiProperty({
    description: 'Service discount',
    example: 10000,
    required: false,
  })
  discount?: number;
}

/**
 * Feedback Synopsis DTO for Appointment Response
 *
 * Contains basic feedback information given for this appointment
 */
export class FeedbackSynopsisDto {
  @ApiProperty({ description: 'Feedback ID' })
  id: string;

  @ApiProperty({ description: 'Rating (1-5)' })
  rating: number;

  @ApiProperty({ description: 'Feedback description', required: false })
  description?: string;

  @ApiProperty({ description: 'Description labels (JSON)', required: false })
  descriptionLabel?: any;

  @ApiProperty({ description: 'Feedback images (JSON)', required: false })
  feedbackImages?: any;

  @ApiProperty({ description: 'Feedback type (DOCTOR or CLINIC)' })
  type: string;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;
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

  @ApiProperty({ description: 'Patient profile image URL', required: false })
  patientProfileImage?: string | null;

  @ApiProperty({
    description: 'Patient address',
    type: AddressDto,
    required: false,
  })
  patientAddress?: AddressDto;

  @ApiProperty({ description: 'Clinic ID' })
  clinicId: string;

  @ApiProperty({ description: 'Clinic name' })
  clinicName: string;

  @ApiProperty({ description: 'Doctor ID', required: false })
  doctorId?: string | null;

  @ApiProperty({ description: 'Doctor full name', required: false })
  doctorFullName?: string | null;

  @ApiProperty({ description: 'Doctor profile image URL', required: false })
  doctorProfileImage?: string | null;

  @ApiProperty({
    description: 'Doctor account status',
    enum: AccountStatus,
    required: false,
  })
  doctorStatus?: string | null;

  @ApiProperty({
    description: 'Clinic rooms',
    type: [ClinicRoomDto],
    required: false,
  })
  clinicRooms?: ClinicRoomDto[];

  @ApiProperty({
    description: 'Extra room for out-of-hours appointments',
    type: ClinicRoomDto,
    required: false,
  })
  extraRoom?: ClinicRoomDto | null;

  @ApiProperty({
    description: 'Services',
    type: [ServiceDetailDto],
    required: false,
  })
  services?: ServiceDetailDto[];

  @ApiProperty({
    description: 'Feedbacks associated with this appointment',
    type: [FeedbackSynopsisDto],
    required: false,
  })
  feedbacks?: FeedbackSynopsisDto[];

  @ApiProperty({
    description: 'Clinic feedback ID if exists',
    required: false,
    type: Object,
  })
  clinicFeedback?: { id: string | null };

  @ApiProperty({
    description: 'Doctor feedback ID if exists',
    required: false,
    type: Object,
  })
  doctorFeedback?: { id: string | null };

  @ApiProperty({ description: 'Appointment date' })
  @Transform(({ value }) => formatToVietnamTime(value))
  appointmentDate: Date;

  @ApiProperty({ description: 'Appointment hour' })
  @Transform(({ value }) => formatToVietnamTime(value))
  appointmentHour: Date;

  @ApiProperty({ description: 'Extra hour if applicable', required: false })
  @Transform(({ value }) => (value ? formatToVietnamTime(value) : value))
  extraHour?: Date | null;

  @ApiProperty({ description: 'Total amount', example: 500000 })
  total: number;

  @ApiProperty({ description: 'Appointment status', enum: AppointmentStatus })
  status: AppointmentStatus;

  @ApiProperty({ description: 'Patient note', required: false })
  patientNote?: string | null;

  @ApiProperty({ description: 'Reject reason if cancelled', required: false })
  rejectReason?: string | null;

  @ApiProperty({
    description: 'Final diagnosis from doctor (COMPLETED appointments only)',
    required: false,
  })
  diagnosis?: string | null;

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
