import { ApiProperty } from '@nestjs/swagger';
import { PaymentType } from '../enums/payment-type.enum';
import { AppointmentPackageStatus } from '../enums/appointment-package-status.enum';
import { PatientAddressDto } from './patient-info.dto';

/**
 * Patient Info for Appointment Detail DTO
 */
export class AppointmentPatientInfoDto {
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
    description: 'Date of birth',
    example: '1990-05-15',
    nullable: true,
  })
  date_of_birth: string | null;

  @ApiProperty({
    description: 'Age',
    example: 34,
    nullable: true,
  })
  age: number | null;

  @ApiProperty({
    description: 'Gender',
    example: 'male',
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
  profile_image_url: string | null;

  @ApiProperty({
    description: 'Patient address',
    type: PatientAddressDto,
    required: false,
  })
  address?: PatientAddressDto;
}

/**
 * Doctor Info for Appointment Detail DTO
 */
export class AppointmentDoctorInfoDto {
  @ApiProperty({
    description: 'Doctor account UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  doctor_id: string;

  @ApiProperty({
    description: 'Doctor full name',
    example: 'BS. Nguyễn Văn B',
  })
  full_name: string;

  @ApiProperty({
    description: 'Specialization',
    example: 'Cơ xương khớp',
    nullable: true,
  })
  specialization: string | null;

  @ApiProperty({
    description: 'License number',
    example: 'BYT-12345',
    nullable: true,
  })
  license_number: string | null;

  @ApiProperty({
    description: 'Profile image URL',
    example: 'https://example.com/doctor.jpg',
    nullable: true,
  })
  profile_image_url: string | null;
}

/**
 * Clinic Info for Appointment Detail DTO
 */
export class AppointmentClinicInfoDto {
  @ApiProperty({
    description: 'Clinic account UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  clinic_id: string;

  @ApiProperty({
    description: 'Clinic name',
    example: 'ABC Orthopedic Clinic',
  })
  clinic_name: string;

  @ApiProperty({
    description: 'Clinic address',
    example: '123 Nguyen Hue, District 1, Ho Chi Minh City',
  })
  address: string;

  @ApiProperty({
    description: 'Clinic phone',
    example: '0281234567',
    nullable: true,
  })
  phone: string | null;
}

/**
 * Shift Hour Info DTO
 */
export class AppointmentShiftHourInfoDto {
  @ApiProperty({
    description: 'Doctor shift hour UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  doctor_shift_hour_id: string | null;

  @ApiProperty({
    description: 'Shift date',
    example: '2026-03-08',
    nullable: true,
  })
  shift_date: string | null;

  @ApiProperty({
    description: 'Start time',
    example: '08:00:00',
    nullable: true,
  })
  start_time: string | null;

  @ApiProperty({
    description: 'End time',
    example: '12:00:00',
    nullable: true,
  })
  end_time: string | null;

  @ApiProperty({
    description: 'Patient limit for this shift',
    nullable: true,
  })
  limit: number | null;

  @ApiProperty({
    description: 'Room number',
    example: 'P101',
    nullable: true,
  })
  room_number: string | null;

  @ApiProperty({
    description: 'Room name',
    example: 'Consultation Room 1',
    nullable: true,
  })
  room_name: string | null;
}

/**
 * Service in Appointment Detail DTO
 */
export class AppointmentServiceDetailDto {
  @ApiProperty({
    description: 'Service appointment UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  service_appointment_id: string;

  @ApiProperty({
    description: 'Clinic service UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  clinic_service_id: string;

  @ApiProperty({
    description: 'Service code',
    example: 'CONSULT001',
  })
  service_code: string;

  @ApiProperty({
    description: 'Service name',
    example: 'Orthopedic Consultation',
  })
  service_name: string;

  @ApiProperty({
    description: 'Service type',
    example: 'CONSULTATION',
  })
  service_type: string;

  @ApiProperty({
    description: 'Service price',
    example: 200000,
  })
  price: number;

  @ApiProperty({
    description: 'Service discount percentage',
    example: 10,
    nullable: true,
  })
  discount: number | null;

  @ApiProperty({
    description: 'Added during examination',
    example: false,
  })
  added_during_examination: boolean;

  @ApiProperty({
    description: 'ERM UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  erm_id: string | null;

  @ApiProperty({
    description: 'ERM status',
    example: 'COMPLETED',
    nullable: true,
  })
  erm_status: string | null;
}

/**
 * Service in Payment Package DTO
 */
export class PackageServiceDto {
  @ApiProperty({
    description: 'Service ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Service name',
    example: 'Orthopedic Consultation',
  })
  serviceName: string;

  @ApiProperty({
    description: 'Service price',
    example: 200000,
  })
  price: number;

  @ApiProperty({
    description: 'Service discount percentage',
    example: 10,
    nullable: true,
  })
  discount: number | null;
}

/**
 * Payment Package DTO
 */
export class PaymentPackageDto {
  @ApiProperty({
    description: 'Package ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Transaction ID',
    example: 'TXN2026030812345',
  })
  transactionId: string;

  @ApiProperty({
    description: 'Payment amount',
    example: 450000,
  })
  amount: number;

  @ApiProperty({
    description: 'Payment status',
    enum: AppointmentPackageStatus,
    nullable: true,
  })
  status: AppointmentPackageStatus | null;

  @ApiProperty({
    description: 'Payment type',
    enum: PaymentType,
    nullable: true,
  })
  paymentType: PaymentType | null;

  @ApiProperty({
    description: 'Services in package',
    type: [PackageServiceDto],
  })
  services: PackageServiceDto[];
}

/**
 * ERM Summary in Appointment DTO
 */
export class AppointmentERMSummaryDto {
  @ApiProperty({
    description: 'ERM UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  erm_id: string;

  @ApiProperty({
    description: 'Service appointment UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  service_appointment_id: string;

  @ApiProperty({
    description: 'Record type',
    example: 'CONSULTATION',
  })
  record_type: string;

  @ApiProperty({
    description: 'Service code',
    example: 'CONSULT001',
    nullable: true,
  })
  service_code: string | null;

  @ApiProperty({
    description: 'Service name',
    example: 'Orthopedic Consultation',
  })
  service_name: string;

  @ApiProperty({
    description: 'ERM status',
    example: 'COMPLETED',
  })
  status: string;

  @ApiProperty({
    description: 'Created at',
    example: '2026-03-08T09:00:00Z',
  })
  created_at: Date;

  @ApiProperty({
    description: 'Updated at',
    example: '2026-03-08T10:30:00Z',
  })
  updated_at: Date;

  @ApiProperty({
    description: 'Created by UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  created_by: string;

  @ApiProperty({
    description: 'Created by name',
    example: 'BS. Nguyễn Văn B',
  })
  created_by_name: string;
}

/**
 * Medicine in Prescription DTO
 */
export class PrescriptionMedicineDto {
  @ApiProperty({
    description: 'Prescription detail UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  detail_id: string;

  @ApiProperty({
    description: 'Medicine UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  medicine_id: string;

  @ApiProperty({
    description: 'Medicine name',
    example: 'Paracetamol 500mg',
  })
  medicine_name: string;

  @ApiProperty({
    description: 'Unit (not available in current schema)',
    example: 'viên',
    nullable: true,
  })
  unit: string | null;

  @ApiProperty({
    description: 'Therapeutic class',
    example: 'Thuốc giảm đau, hạ sốt',
    nullable: true,
  })
  therapeutic_class: string | null;

  @ApiProperty({
    description: 'Usage instructions',
    example: 'Uống 1-2 viên mỗi 4-6 giờ khi đau hoặc sốt',
  })
  check_out: string;

  @ApiProperty({
    description: 'Habit forming',
    example: false,
  })
  habit_forming: boolean;

  @ApiProperty({
    description: 'Contraindications',
    example: 'Không dùng cho người mẫn cảm với paracetamol',
    nullable: true,
  })
  contraindications: string | null;

  @ApiProperty({
    description: 'Side effects',
    example: 'Hiếm khi gây phản ứng dị ứng da',
    nullable: true,
  })
  side_effects: string | null;
}

/**
 * Prescription Detail DTO
 */
export class AppointmentPrescriptionDto {
  @ApiProperty({
    description: 'E-prescription UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  e_prescription_id: string;

  @ApiProperty({
    description: 'Appointment UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  appointment_id: string;

  @ApiProperty({
    description: 'Reference ID',
    example: 'EP2026030801',
  })
  reference_id: string;

  @ApiProperty({
    description: 'Doctor note',
    example: 'Uống đủ nước, nghỉ ngơi',
    nullable: true,
  })
  doctor_note: string | null;

  @ApiProperty({
    description: 'Created at',
    example: '2026-03-08T10:00:00Z',
  })
  created_at: Date;

  @ApiProperty({
    description: 'Created by UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  created_by: string;

  @ApiProperty({
    description: 'Created by name',
    example: 'BS. Nguyễn Văn B',
  })
  created_by_name: string;

  @ApiProperty({
    description: 'List of medicines',
    type: [PrescriptionMedicineDto],
  })
  medicines: PrescriptionMedicineDto[];
}

/**
 * Doctor Appointment History Detail Response DTO
 * 
 * Complete appointment detail for doctor's patient history view
 */
export class DoctorAppointmentHistoryDetailResponseDto {
  @ApiProperty({
    description: 'Appointment UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  appointment_id: string;

  @ApiProperty({
    description: 'Appointment date',
    example: '2026-03-08',
  })
  appointment_date: string;

  @ApiProperty({
    description: 'Appointment hour',
    example: '2026-03-08T09:00:00Z',
  })
  appointment_hour: Date;

  @ApiProperty({
    description: 'Extra hour',
    example: '2026-03-08T09:30:00Z',
    nullable: true,
  })
  extra_hour: Date | null;

  @ApiProperty({
    description: 'Appointment status',
    example: 'COMPLETED',
  })
  status: string;

  @ApiProperty({
    description: 'Total price',
    example: 500000,
  })
  total_price: number;

  @ApiProperty({
    description: 'Patient information',
    type: AppointmentPatientInfoDto,
  })
  patient: AppointmentPatientInfoDto;

  @ApiProperty({
    description: 'Doctor information',
    type: AppointmentDoctorInfoDto,
  })
  doctor: AppointmentDoctorInfoDto;

  @ApiProperty({
    description: 'Clinic information',
    type: AppointmentClinicInfoDto,
  })
  clinic: AppointmentClinicInfoDto;

  @ApiProperty({
    description: 'Shift hour information',
    type: AppointmentShiftHourInfoDto,
  })
  shift_hour: AppointmentShiftHourInfoDto;

  @ApiProperty({
    description: 'Clinic rooms where doctor works',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        roomName: { type: 'string' },
      },
    },
    required: false,
  })
  clinicRooms?: { id: string; roomName: string }[];

  @ApiProperty({
    description: 'Reminder sent status',
    example: false,
  })
  isReminder: boolean;

  @ApiProperty({
    description: 'Payment package',
    type: PaymentPackageDto,
    nullable: true,
  })
  package: PaymentPackageDto | null;

  @ApiProperty({
    description: 'List of services',
    type: [AppointmentServiceDetailDto],
  })
  services: AppointmentServiceDetailDto[];

  @ApiProperty({
    description: 'List of ERMs',
    type: [AppointmentERMSummaryDto],
  })
  erms: AppointmentERMSummaryDto[];

  @ApiProperty({
    description: 'Prescription detail',
    type: AppointmentPrescriptionDto,
    nullable: true,
  })
  prescription: AppointmentPrescriptionDto | null;

  @ApiProperty({
    description: 'Patient note',
    example: 'Đau lưng từ 3 ngày trước',
    nullable: true,
  })
  patient_note: string | null;

  @ApiProperty({
    description: 'Doctor note',
    example: 'Tái khám sau 1 tuần',
    nullable: true,
  })
  doctor_note: string | null;

  @ApiProperty({
    description: 'Cancelled reason',
    example: null,
    nullable: true,
  })
  cancelled_reason: string | null;

  @ApiProperty({
    description: 'Completed at',
    example: '2026-03-08T10:30:00Z',
    nullable: true,
  })
  completed_at: Date | null;

  @ApiProperty({
    description: 'Created at',
    example: '2026-03-07T15:00:00Z',
  })
  created_at: Date;

  @ApiProperty({
    description: 'Updated at',
    example: '2026-03-08T10:30:00Z',
  })
  updated_at: Date;
}
