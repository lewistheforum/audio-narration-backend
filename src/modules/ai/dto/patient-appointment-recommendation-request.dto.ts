import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PatientAppointmentRecommendationRequestDto {
  @ApiProperty({
    description:
      "List of clinic IDs (maximum 5) from patient's appointment history",
    type: [String],
    example: ['clinic-id-1', 'clinic-id-2'],
  })
  @IsArray()
  @IsString({ each: true })
  clinicIds: string[];

  @ApiPropertyOptional({
    description: 'Maximum number of recommendations to return',
    type: Number,
    example: 5,
    default: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}
