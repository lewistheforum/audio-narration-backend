import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

/**
 * Query DTO for Get Rooms with Shift Hours Endpoint
 *
 * Filters shift hours by specific date
 */
export class GetRoomsShiftHoursQueryDto {
  @ApiProperty({
    description: 'Filter shift hours by work date (YYYY-MM-DD format)',
    example: '2024-03-15',
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: 'Invalid date format. Expected YYYY-MM-DD' })
  date?: string;
}
