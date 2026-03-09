import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsEnum } from 'class-validator';
import { ShiftType } from '../enums/shift-type.enum';

/**
 * Get Doctor Schedules Query DTO
 *
 * Query parameters for retrieving doctor schedules
 * Used for appointment booking flow
 */
export class GetDoctorSchedulesQueryDto {
  /**
   * Clinic ID (optional - will be extracted from staff JWT if not provided)
   */
  @ApiPropertyOptional({
    description: 'Clinic ID (optional - auto-detected from staff JWT)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  clinicId?: string;

  /**
   * Service Config ID to filter doctors by service capability
   */
  @ApiPropertyOptional({
    description:
      'Service Config ID - filters doctors who can perform this service',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  serviceConfigId?: string;

  /**
   * Shift type to filter schedules (MORNING, AFTERNOON, EVENING)
   */
  @ApiPropertyOptional({
    description: 'Shift type to filter schedules',
    enum: ShiftType,
    example: ShiftType.MORNING,
  })
  @IsOptional()
  @IsEnum(ShiftType)
  shiftType?: ShiftType;
}
