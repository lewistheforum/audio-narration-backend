import { ApiProperty } from '@nestjs/swagger';

/**
 * Shift Hour DTO
 *
 * Represents a shift hour slot with details
 */
export class ShiftHourDto {
  @ApiProperty({
    description: 'Shift hour ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  id: string;

  @ApiProperty({
    description: 'Start time (HH:MM format)',
    example: '08:00',
  })
  startHour: string;

  @ApiProperty({
    description: 'End time (HH:MM format)',
    example: '09:00',
  })
  endHour: string;

  @ApiProperty({
    description: 'Patient limit for this slot',
    example: 10,
  })
  limit: number;

  @ApiProperty({
    description: 'Shift type',
    example: 'MORNING',
  })
  shiftType: string;

  @ApiProperty({
    description: 'Shift ID',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  shiftId: string;
}

/**
 * Clinic Room DTO
 *
 * Represents a clinic room with its shift hours
 */
export class ClinicRoomWithShiftHoursDto {
  @ApiProperty({
    description: 'Room ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Room name',
    example: 'Room 1',
  })
  roomName: string;

  @ApiProperty({
    description: 'List of shift hours for this room',
    type: [ShiftHourDto],
  })
  shiftHours: ShiftHourDto[];
}

/**
 * Clinic Rooms and Shift Hours Response DTO
 *
 * Response containing all clinic rooms with their shift hours
 */
export class ClinicRoomsShiftHoursResponseDto {
  @ApiProperty({
    description: 'List of clinic rooms with their shift hours',
    type: [ClinicRoomWithShiftHoursDto],
  })
  rooms: ClinicRoomWithShiftHoursDto[];
}
