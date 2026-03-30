import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import {
  IsStrongPassword,
  Match,
} from 'src/common/validators/custom-validators';

/**
 * Reset Password DTO
 * Request DTO for resetting password with reset code
 */
export class ResetPasswordDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    description: 'User role',
    example: 'user',
  })
  @IsString()
  @IsNotEmpty({ message: 'Role is required' })
  role: string;

  @ApiProperty({
    description: '6-digit reset code sent to email',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: 'Reset code is required' })
  @MinLength(6, { message: 'Reset code must be 6 digits' })
  code: string;

  @ApiProperty({
    description:
      'New password (min 8 chars, must contain uppercase, lowercase, number, special character)',
    example: 'NewPassword@123',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty({ message: 'New password is required' })
  @IsStrongPassword({
    message:
      'Password must be at least 8 characters and contain uppercase, lowercase, number, and special character',
  })
  newPassword: string;

  @ApiProperty({
    description: 'Confirm new password (must match new password)',
    example: 'NewPassword@123',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password confirmation is required' })
  @Match('newPassword', { message: 'Passwords do not match' })
  confirmPassword: string;
}
