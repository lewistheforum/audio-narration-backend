import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Email address for password reset',
    example: 'user@gmail.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Current role of the user',
    example: 'PATIENT',
  })
  @IsString()
  role: string;
}

export class VerifyResetPasswordDto {
  @ApiProperty({
    description: 'Email address for password reset',
    example: 'user@gmail.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Current role of the user',
    example: 'PATIENT',
  })
  @IsString()
  role: string;

  @ApiProperty({
    description: '6-digit verification code sent via email',
    example: '123456',
  })
  @IsString()
  @Length(6, 6)
  code: string;
}

export class SetNewPasswordDto {
  @ApiProperty({
    description: 'Email address for password reset',
    example: 'user@gmail.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'New password',
    example: 'NewStrongPass123!',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  newPassword: string;
}
