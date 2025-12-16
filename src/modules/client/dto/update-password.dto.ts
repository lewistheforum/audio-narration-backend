import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, IsNotEmpty, Matches } from 'class-validator';

/**
 * Update Password DTO
 * 
 * Used for secure password changes requiring old password verification
 * 
 * Security Requirements:
 * - Old password must be correct
 * - New password cannot be the same as old password
 * - New password must meet strength requirements:
 *   - Minimum 6 characters
 *   - Maximum 50 characters
 *   - At least one letter
 *   - At least one number
 */
export class UpdatePasswordDto {
  @ApiProperty({
    description: 'Current password',
    example: 'OldPass123',
    minLength: 6,
    maxLength: 50,
  })
  @IsNotEmpty({ message: 'Old password is required' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @MaxLength(50, { message: 'Password must not exceed 50 characters' })
  oldPassword: string;

  @ApiProperty({
    description: 'New password (min 6 characters, must contain letter and number)',
    example: 'NewPass456',
    minLength: 6,
    maxLength: 50,
  })
  @IsNotEmpty({ message: 'New password is required' })
  @IsString()
  @MinLength(6, { message: 'New password must be at least 6 characters' })
  @MaxLength(50, { message: 'New password must not exceed 50 characters' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'New password must contain at least one letter and one number',
  })
  newPassword: string;
}