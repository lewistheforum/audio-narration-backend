import {
  IsEmail,
  IsString,
  Length,
  Matches,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { AccountRole } from '../../accounts/enums/account-role.enum';

/**
 * Verify Email DTO
 * 
 * Used to verify email with 6-digit code
 */
export class VerifyEmailDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Invalid email format' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({
    description: '6-digit verification code',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @Length(6, 6, { message: 'Verification code must be 6 digits' })
  @Matches(/^\d{6}$/, { message: 'Verification code must contain only numbers' })
  code: string;

  @ApiProperty({
    description: 'Optional role hint for overlapping emails',
    enum: AccountRole,
    required: false,
    example: AccountRole.CLINIC_MANAGER,
  })
  @IsOptional()
  @IsEnum(AccountRole, { message: 'Invalid account role' })
  role?: AccountRole;
}
