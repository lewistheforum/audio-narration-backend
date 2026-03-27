import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsNotEmpty,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { AccountRole } from '../../accounts/enums/account-role.enum';

/**
 * Login Data Transfer Object
 * 
 * Validates user login credentials
 * Email is automatically normalized (lowercase, trimmed)
 */
export class LoginDto {
  @ApiProperty({
    description: 'User email address for login',
    example: 'user@example.com',
  })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email format' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'Pass123456',
    minLength: 6,
    maxLength: 50,
  })
  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @MaxLength(50, { message: 'Password must not exceed 50 characters' })
  password: string;

  @ApiProperty({
    description: 'Optional role hint for overlapping emails',
    enum: AccountRole,
    required: false,
    example: AccountRole.CLINIC_ADMIN,
  })
  @IsOptional()
  @IsEnum(AccountRole, { message: 'Invalid account role' })
  role?: AccountRole;
}
