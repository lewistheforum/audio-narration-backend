import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for individual doctor in available doctors response
 */
export class AvailableDoctorDto {
  @ApiProperty({
    description: 'Doctor account ID',
    example: '550e8400-e29b-41d4-a716-446655440011',
  })
  doctor_id: string;

  @ApiProperty({
    description: 'Doctor full name',
    example: 'Dr. John Smith',
  })
  doctor_name: string;

  @ApiProperty({
    description: 'Doctor profile picture URL',
    example: 'https://example.com/avatar.jpg',
    nullable: true,
  })
  doctor_avatar?: string | null;

  @ApiProperty({
    description: 'Doctor academic degree',
    example: 'Doctor',
    nullable: true,
  })
  academic_degree?: string | null;

  @ApiProperty({
    description: 'Doctor position/specialty',
    example: 'Internal Medicine Specialist',
    nullable: true,
  })
  position?: string | null;
}

/**
 * Metadata for available doctors response
 */
export class AvailableDoctorsMetaDto {
  @ApiProperty({
    description: 'Total number of available doctors',
    example: 5,
  })
  total: number;

  @ApiProperty({
    description: 'Requested appointment date',
    example: '2026-03-15',
  })
  requested_date: string;

  @ApiProperty({
    description: 'Requested extra hour timestamp',
    example: '2026-03-15T14:30:00+07:00',
  })
  requested_time: string;
}

/**
 * Response DTO for available doctors for out-of-hours booking (Option 4)
 * 
 * Returns list of doctors who are NOT busy at the requested time
 */
export class AvailableDoctorsResponseDto {
  @ApiProperty({
    description: 'List of available doctors',
    type: [AvailableDoctorDto],
  })
  data: AvailableDoctorDto[];

  @ApiProperty({
    description: 'Response metadata',
    type: AvailableDoctorsMetaDto,
  })
  meta: AvailableDoctorsMetaDto;
}
