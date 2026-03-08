import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID, IsEnum } from 'class-validator';

enum ShiftType {
    MORNING = 'morning',
    AFTERNOON = 'afternoon',
    EVENING = 'evening',
}

/**
 * DTO for querying doctor schedules by specific date
 */
export class GetDoctorSchedulesByDateQueryDto {
    @ApiProperty({
        description: 'Date to get schedules for (YYYY-MM-DD)',
        example: '2026-03-05',
    })
    @IsDateString()
    date: string;

    @ApiPropertyOptional({
        description: 'Filter by specific doctor ID',
        example: '123e4567-e89b-12d3-a456-426614174020',
    })
    @IsOptional()
    @IsUUID()
    doctorId?: string;

    @ApiPropertyOptional({
        description: 'Filter by shift type',
        enum: ShiftType,
        example: 'morning',
    })
    @IsOptional()
    @IsEnum(ShiftType)
    shiftType?: ShiftType;

    @ApiPropertyOptional({
        description: 'Filter by service config ID',
        example: '550e8400-e29b-41d4-a716-446655440001',
    })
    @IsOptional()
    @IsUUID()
    serviceConfigId?: string;
}
