import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Reject Registration DTO
 *
 * Request body for rejecting a registration
 */
export class RejectRegistrationDto {
  @ApiProperty({
    description: 'Rejection reason (must be detailed enough for user to understand and fix)',
    example: 'Business license has expired. Please upload a new valid copy.',
    minLength: 10,
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty({ message: 'Rejection reason is required' })
  @MinLength(10, { message: 'Rejection reason must be at least 10 characters' })
  @MaxLength(1000, { message: 'Rejection reason cannot exceed 1000 characters' })
  reason: string;
}
