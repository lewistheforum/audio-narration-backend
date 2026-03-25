import { ApiProperty } from '@nestjs/swagger';

/**
 * Time Slot DTO for by-date response
 */
export class TimeSlotByDateDto {
    @ApiProperty({
        description: 'Clinic Shift Hour ID',
        example: '550e8400-e29b-41d4-a716-446655440300',
    })
    shiftHourId: string;

    @ApiProperty({
        description: 'Start time (HH:MM:SS)',
        example: '08:00:00',
    })
    startTime: string;

    @ApiProperty({
        description: 'End time (HH:MM:SS)',
        example: '08:30:00',
    })
    endTime: string;

    @ApiProperty({
        description: 'Full appointment datetime (ISO 8601)',
        example: '2026-03-05T08:00:00.000Z',
    })
    appointmentHour: string;

    @ApiProperty({
        description: 'Whether this slot is available',
        example: true,
    })
    isAvailable: boolean;

    @ApiProperty({
        description: 'Patient name (for booked slots)',
        example: 'John Doe',
        required: false,
    })
    bookedBy?: string;

    @ApiProperty({
        description: 'Appointment ID (for booked slots)',
        example: '550e8400-e29b-41d4-a716-446655440500',
        required: false,
    })
    appointmentId?: string;
}

/**
 * Room Info DTO
 */
export class RoomByDateDto {
    @ApiProperty({
        description: 'Room ID',
        example: '550e8400-e29b-41d4-a716-446655440200',
    })
    roomId: string;

    @ApiProperty({
        description: 'Room name',
        example: 'Room 101',
    })
    roomName: string;
}

/**
 * Shift Info DTO
 */
export class ShiftByDateDto {
    @ApiProperty({
        description: 'Employee Schedule ID',
        example: '550e8400-e29b-41d4-a716-446655440010',
    })
    employeeScheduleId: string;

    @ApiProperty({
        description: 'Shift ID',
        example: '550e8400-e29b-41d4-a716-446655440100',
    })
    shiftId: string;

    @ApiProperty({
        description: 'Shift type',
        example: 'MORNING',
    })
    shiftType: string;

    @ApiProperty({
        description: 'Shift start time',
        example: '08:00:00',
    })
    shiftStartTime: string;

    @ApiProperty({
        description: 'Shift end time',
        example: '12:00:00',
    })
    shiftEndTime: string;

    @ApiProperty({
        description: 'Room information',
        type: RoomByDateDto,
    })
    room: RoomByDateDto;

    @ApiProperty({
        description: 'Available time slots',
        type: [TimeSlotByDateDto],
    })
    availableSlots: TimeSlotByDateDto[];

    @ApiProperty({
        description: 'Booked time slots',
        type: [TimeSlotByDateDto],
    })
    bookedSlots: TimeSlotByDateDto[];

    @ApiProperty({
        description: 'Total number of slots',
        example: 8,
    })
    totalSlots: number;

    @ApiProperty({
        description: 'Number of available slots',
        example: 7,
    })
    availableCount: number;

    @ApiProperty({
        description: 'Number of booked slots',
        example: 1,
    })
    bookedCount: number;
}

/**
 * Doctor Info DTO
 */
export class DoctorByDateDto {
    @ApiProperty({
        description: 'Doctor ID',
        example: '123e4567-e89b-12d3-a456-426614174020',
    })
    doctorId: string;

    @ApiProperty({
        description: 'Doctor full name',
        example: 'Dr. Jane Doe',
    })
    doctorFullName: string;

    @ApiProperty({
        description: 'Doctor specialty',
        example: 'General Internal Medicine',
    })
    doctorSpecialty: string;

    @ApiProperty({
        description: 'Doctor avatar URL',
        example: 'https://example.com/avatar.jpg',
        required: false,
    })
    doctorAvatar?: string;

    @ApiProperty({
        description: 'Doctor email',
        example: 'doctor@clinic.com',
    })
    doctorEmail: string;

    @ApiProperty({
        description: 'Doctor phone',
        example: '0909123456',
    })
    doctorPhone: string;

    @ApiProperty({
        description: 'List of shifts for this doctor',
        type: [ShiftByDateDto],
    })
    shifts: ShiftByDateDto[];

    @ApiProperty({
        description: 'Total available slots across all shifts',
        example: 15,
    })
    totalAvailableSlots: number;
}

/**
 * Summary DTO
 */
export class ScheduleByDateSummaryDto {
    @ApiProperty({
        description: 'Total doctors available',
        example: 2,
    })
    totalDoctorsAvailable: number;

    @ApiProperty({
        description: 'Total slots available',
        example: 15,
    })
    totalSlotsAvailable: number;

    @ApiProperty({
        description: 'Earliest slot time',
        example: '08:00:00',
    })
    earliestSlot: string;

    @ApiProperty({
        description: 'Latest slot time',
        example: '17:00:00',
    })
    latestSlot: string;
}

/**
 * Main Response DTO
 */
export class DoctorSchedulesByDateResponseDto {
    @ApiProperty({
        description: 'Query date',
        example: '2026-03-05',
    })
    date: string;

    @ApiProperty({
        description: 'Week day',
        example: 'WED',
    })
    weekDay: string;

    @ApiProperty({
        description: 'List of doctors with their schedules',
        type: [DoctorByDateDto],
    })
    doctors: DoctorByDateDto[];

    @ApiProperty({
        description: 'Summary statistics',
        type: ScheduleByDateSummaryDto,
    })
    summary: ScheduleByDateSummaryDto;
}
