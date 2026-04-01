import { ApiProperty } from '@nestjs/swagger';

/**
 * Time Slot DTO
 *
 * Represents a single time slot in a schedule
 */
export class TimeSlotDto {
  @ApiProperty({
    description: 'Clinic Shift Hour ID',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  shiftHourId: string;

  @ApiProperty({
    description: 'Start time (HH:MM:SS format)',
    example: '08:00:00',
  })
  startHour: string;

  @ApiProperty({
    description: 'End time (HH:MM:SS format)',
    example: '08:30:00',
  })
  endHour: string;

  @ApiProperty({
    description: 'Maximum appointments allowed',
    example: 5,
  })
  limit: number;

  @ApiProperty({
    description: 'Available slots remaining',
    example: 3,
  })
  availableSlots: number;

  @ApiProperty({
    description: 'Whether this slot is fully booked',
    example: false,
  })
  isFullyBooked: boolean;
}

/**
 * Room Info DTO
 *
 * Represents room information for a schedule
 */
export class RoomInfoDto {
  @ApiProperty({
    description: 'Room ID',
    example: '880e8400-e29b-41d4-a716-446655440000',
  })
  roomId: string;

  @ApiProperty({
    description: 'Room number or identifier',
    example: 'P101',
  })
  roomNumber: string;

  @ApiProperty({
    description: 'Room name',
    example: 'Room 1',
  })
  roomName: string;
}

/**
 * Doctor Schedule Item DTO
 *
 * Represents a single schedule entry for a doctor
 */
export class DoctorScheduleItemDto {
  @ApiProperty({
    description: 'Employee Schedule ID',
    example: '990e8400-e29b-41d4-a716-446655440000',
  })
  employeeScheduleId: string;

  @ApiProperty({
    description: 'Work date (YYYY-MM-DD format)',
    example: '2024-03-15',
  })
  workDate: string;

  @ApiProperty({
    description: 'Week day (MON, TUE, WED, THU, FRI, SAT, SUN)',
    example: 'MON',
  })
  weekDay: string;

  @ApiProperty({
    description: 'Shift type (MORNING, AFTERNOON, EVENING)',
    example: 'MORNING',
  })
  shiftType: string;

  @ApiProperty({
    description: 'Shift ID',
    example: 'aa0e8400-e29b-41d4-a716-446655440000',
  })
  shiftId: string;

  @ApiProperty({
    description: 'Shift start hour (HH:MM)',
    example: '07:00',
  })
  startHour: string;

  @ApiProperty({
    description: 'Shift end hour (HH:MM)',
    example: '10:00',
  })
  endHour: string;

  @ApiProperty({
    description: 'Available time slots',
    type: [TimeSlotDto],
  })
  timeSlots: TimeSlotDto[];

  @ApiProperty({
    description: 'Rooms assigned to this schedule',
    type: [RoomInfoDto],
  })
  rooms: RoomInfoDto[];

  @ApiProperty({
    description: 'Total available slots for this schedule',
    example: 15,
  })
  totalAvailableSlots: number;
}

/**
 * Doctor Info DTO
 *
 * Represents doctor information
 */
export class DoctorInfoDto {
  @ApiProperty({
    description: 'Doctor Account ID',
    example: 'bb0e8400-e29b-41d4-a716-446655440000',
  })
  doctorId: string;

  @ApiProperty({
    description: 'Doctor full name',
    example: 'Dr. John Smith',
  })
  fullName: string;

  @ApiProperty({
    description: 'Doctor email',
    example: 'doctor.a@clinic.com',
  })
  email: string;

  @ApiProperty({
    description: 'Doctor phone number',
    example: '0901234567',
    nullable: true,
  })
  phone: string | null;

  @ApiProperty({
    description: 'Doctor avatar URL',
    example: 'https://example.com/avatar.jpg',
    nullable: true,
  })
  avatar: string | null;

  @ApiProperty({
    description: 'Specialization',
    example: 'Internal Medicine',
    nullable: true,
  })
  specialization: string | null;

  @ApiProperty({
    description: 'Years of experience',
    example: 10,
    nullable: true,
  })
  yearsOfExperience: number | null;
}

/**
 * Doctor With Schedules DTO
 *
 * Represents a doctor with their available schedules
 */
export class DoctorWithSchedulesDto {
  @ApiProperty({
    description: 'Doctor information',
    type: DoctorInfoDto,
  })
  doctor: DoctorInfoDto;

  @ApiProperty({
    description: 'Available schedules for this doctor',
    type: [DoctorScheduleItemDto],
  })
  schedules: DoctorScheduleItemDto[];

  @ApiProperty({
    description: 'Total schedules count',
    example: 5,
  })
  totalSchedules: number;
}

/**
 * Clinic Info DTO (for schedules)
 *
 * Basic clinic information
 */
export class ClinicInfoDto {
  @ApiProperty({
    description: 'Clinic ID',
    example: 'cc0e8400-e29b-41d4-a716-446655440000',
  })
  clinicId: string;

  @ApiProperty({
    description: 'Clinic name',
    example: 'ABC Clinic',
  })
  clinicName: string;

  @ApiProperty({
    description: 'Clinic address',
    example: '123 Nguyen Hue, District 1, HCMC',
    nullable: true,
  })
  address: string | null;

  @ApiProperty({
    description: 'Clinic phone',
    example: '0281234567',
    nullable: true,
  })
  phone: string | null;
}

/**
 * Doctor Schedules Response DTO
 *
 * Main response DTO for doctor schedules endpoint
 */
export class DoctorSchedulesResponseDto {
  @ApiProperty({
    description: 'List of doctors with their schedules',
    type: [DoctorWithSchedulesDto],
  })
  doctors: DoctorWithSchedulesDto[];

  @ApiProperty({
    description: 'Total doctors count',
    example: 8,
  })
  totalDoctors: number;

  @ApiProperty({
    description: 'Clinic information',
    type: ClinicInfoDto,
  })
  clinicInfo: ClinicInfoDto;

  @ApiProperty({
    description: 'Date range start (YYYY-MM-DD)',
    example: '2024-03-05',
  })
  dateRangeStart: string;

  @ApiProperty({
    description: 'Date range end (YYYY-MM-DD)',
    example: '2024-05-05',
  })
  dateRangeEnd: string;
}
