import { ApiProperty } from '@nestjs/swagger';
import { PaymentType } from '../enums/payment-type.enum';
import { AppointmentPackageStatus } from '../enums/appointment-package-status.enum';

/**
 * Patient Detail DTO
 *
 * Patient information for appointment detail
 */
export class PatientDetailDto {
  @ApiProperty({ description: 'Patient account ID' })
  id: string;

  @ApiProperty({ description: 'Patient username' })
  username: string;

  @ApiProperty({ description: 'Patient email' })
  email: string;

  @ApiProperty({ description: 'Patient phone number', required: false })
  phone?: string;

  @ApiProperty({ description: 'Patient full name', required: false })
  fullName?: string;

  @ApiProperty({ description: 'Patient gender', required: false })
  gender?: string;

  @ApiProperty({ description: 'Patient date of birth', required: false })
  dob?: Date;

  @ApiProperty({ description: 'Patient profile picture URL', required: false })
  profilePicture?: string;
}

/**
 * Doctor Detail DTO
 *
 * Doctor information for appointment detail
 */
export class DoctorDetailDto {
  @ApiProperty({ description: 'Doctor account ID' })
  id: string;

  @ApiProperty({ description: 'Doctor username' })
  username: string;

  @ApiProperty({ description: 'Doctor email' })
  email: string;

  @ApiProperty({ description: 'Doctor phone number', required: false })
  phone?: string;

  @ApiProperty({ description: 'Doctor full name', required: false })
  fullName?: string;

  @ApiProperty({ description: 'Doctor gender', required: false })
  gender?: string;

  @ApiProperty({ description: 'Doctor date of birth', required: false })
  dob?: Date;

  @ApiProperty({ description: 'Doctor profile picture URL', required: false })
  profilePicture?: string;

  @ApiProperty({ description: 'Doctor academic degree', required: false })
  academicDegree?: string;

  @ApiProperty({ description: 'Doctor experience', required: false })
  experience?: string;

  @ApiProperty({ description: 'Doctor position', required: false })
  position?: string;
}

/**
 * Clinic Service Detail DTO
 *
 * Service information for appointment
 */
export class ClinicServiceDetailDto {
  @ApiProperty({ description: 'Service ID' })
  id: string;

  @ApiProperty({ description: 'Service name' })
  serviceName: string;

  @ApiProperty({ description: 'Service description', required: false })
  description?: string;

  @ApiProperty({ description: 'Service price' })
  price: number;

  @ApiProperty({ description: 'Service duration in minutes', required: false })
  duration?: number;
}

/**
 * Appointment Package Detail DTO
 *
 * Payment package information
 */
export class AppointmentPackageDetailDto {
  @ApiProperty({ description: 'Package ID' })
  id: string;

  @ApiProperty({ description: 'Transaction ID' })
  transactionId: string;

  @ApiProperty({ description: 'Payment amount' })
  amount: number;

  @ApiProperty({ description: 'Payment status', enum: AppointmentPackageStatus, required: false })
  status?: AppointmentPackageStatus;

  @ApiProperty({
    description: 'Payment type (online or cod)',
    required: false,
    enum: PaymentType,
  })
  paymentType?: PaymentType;

  @ApiProperty({ description: 'Services in this package', type: [ClinicServiceDetailDto] })
  services: ClinicServiceDetailDto[];
}

/**
 * Clinic Room Detail DTO
 *
 * Clinic room information where doctor works
 */
export class ClinicRoomDetailDto {
  @ApiProperty({ description: 'Room ID' })
  id: string;

  @ApiProperty({ description: 'Room name', example: 'Room 101' })
  roomName: string;
}

/**
 * Shift Hour Detail DTO
 *
 * Doctor shift hour information
 */
export class ShiftHourDetailDto {
  @ApiProperty({ description: 'Shift hour ID' })
  id: string;

  @ApiProperty({ description: 'Start time of shift', example: '08:00:00' })
  startHour: string;

  @ApiProperty({ description: 'End time of shift', example: '12:00:00' })
  endHour: string;

  @ApiProperty({ description: 'Patient limit for this shift' })
  limit: number;

  @ApiProperty({ description: 'Shift type', example: 'MORNING', required: false })
  shiftType?: string;
}

/**
 * Appointment Detail Response DTO
 *
 * Complete appointment information for clinic staff view
 */
export class AppointmentDetailResponseDto {
  @ApiProperty({ description: 'Appointment ID' })
  id: string;

  // Patient Information
  @ApiProperty({ description: 'Patient details', type: PatientDetailDto })
  patient: PatientDetailDto;

  // Doctor Information
  @ApiProperty({
    description: 'Doctor details (null if no doctor assigned)',
    type: DoctorDetailDto,
    required: false,
  })
  doctor?: DoctorDetailDto | null;

  // Clinic Information
  @ApiProperty({ description: 'Clinic ID' })
  clinicId: string;

  @ApiProperty({ description: 'Clinic name' })
  clinicName: string;

  // Appointment Details
  @ApiProperty({ description: 'Appointment date' })
  appointmentDate: Date;

  @ApiProperty({ description: 'Appointment hour' })
  appointmentHour: Date;

  @ApiProperty({ description: 'Extra hour', required: false })
  extraHour?: Date | null;

  @ApiProperty({ description: 'Shift hour details', type: ShiftHourDetailDto, required: false })
  shiftHour?: ShiftHourDetailDto | null;

  @ApiProperty({
    description: 'Clinic rooms where doctor works on this date',
    type: [ClinicRoomDetailDto],
    required: false,
  })
  clinicRooms?: ClinicRoomDetailDto[];

  @ApiProperty({ description: 'Total amount' })
  total: number;

  @ApiProperty({ description: 'Appointment status', enum: ['AWAITING_PAYMENT', 'PAYMENT_FAILED', 'PAYMENT_CANCELLED', 'PAYMENT_EXPIRED', 'PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ABSENT'] })
  status: string;

  @ApiProperty({ description: 'Reminder sent', default: false })
  isReminder: boolean;

  @ApiProperty({ description: 'Patient note', required: false })
  patientNote?: string | null;

  @ApiProperty({ description: 'Reject/Cancel reason', required: false })
  rejectReason?: string | null;

  // Package & Services
  @ApiProperty({
    description: 'Payment package with services',
    type: AppointmentPackageDetailDto,
    required: false,
  })
  package?: AppointmentPackageDetailDto | null;

  // Metadata
  @ApiProperty({ description: 'Created at' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at' })
  updatedAt: Date;
}
