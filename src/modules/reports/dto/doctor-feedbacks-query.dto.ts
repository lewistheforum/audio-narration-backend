import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsEnum, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Query DTO for Doctor to retrieve their feedbacks
 * 
 * Supports pagination, sorting, and filtering
 */
export class DoctorFeedbacksQueryDto {
  @ApiProperty({
    description: 'Page number (1-based)',
    example: 1,
    required: false,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
    required: false,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({
    description: 'Sort by field',
    example: 'created_at',
    enum: ['created_at', 'rating'],
    required: false,
    default: 'created_at',
  })
  @IsOptional()
  @IsEnum(['created_at', 'rating'])
  sort_by?: 'created_at' | 'rating' = 'created_at';

  @ApiProperty({
    description: 'Sort order',
    example: 'DESC',
    enum: ['ASC', 'DESC'],
    required: false,
    default: 'DESC',
  })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  order?: 'ASC' | 'DESC' = 'DESC';

  @ApiProperty({
    description: 'Filter by minimum rating (1-5)',
    example: 3,
    required: false,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  min_rating?: number;

  @ApiProperty({
    description: 'Search in feedback description',
    example: 'excellent',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;
}
