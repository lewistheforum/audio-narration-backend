import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Email dùng để reset mật khẩu',
    example: 'user@gmail.com',
  })
  @IsEmail()
  email: string;
}

export class VerifyResetPasswordDto {
  @ApiProperty({
    description: 'Email dùng để reset mật khẩu',
    example: 'user@gmail.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Mã xác thực 6 số được gửi qua email',
    example: '123456',
  })
  @IsString()
  @Length(6, 6)
  code: string;
}

export class SetNewPasswordDto {
  @ApiProperty({
    description: 'Email dùng để reset mật khẩu',
    example: 'user@gmail.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Mật khẩu mới',
    example: 'NewStrongPass123!',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  newPassword: string;
}
