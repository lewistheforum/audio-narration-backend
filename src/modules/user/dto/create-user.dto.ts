import { IsEmail, IsString, MinLength, IsOptional, IsBoolean, IsIn, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ description: 'Email của người dùng', example: 'user@example.com', minLength: 6 })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Mật khẩu của người dùng',
    example: 'password123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({
    description: 'Tên của người dùng',
    example: 'Nguyễn Văn A',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Giới tính',
    required: false,
    enum: ['male', 'female', 'other'],
    example: 'male',
  })
  @IsString()
  @IsIn(['male', 'female', 'other'])
  @IsOptional()
  gender?: string;

  @ApiProperty({
    description: 'Ngày sinh (YYYY-MM-DD)',
    required: false,
    example: '2000-01-01',
  })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiProperty({ description: 'Có phải user đăng nhập bằng OAuth không', required: false })
  @IsBoolean()
  @IsOptional()
  isOAuthUser?: boolean;

  @ApiProperty({ description: 'Google ID', required: false })
  @IsString()
  @IsOptional()
  googleId?: string;

  @ApiProperty({ description: 'Email đã được Google verify chưa', required: false })
  @IsBoolean()
  @IsOptional()
  isEmailVerified?: boolean;

  @ApiProperty({
    description: 'Ảnh đại diện',
    example: 'https://lh3.googleusercontent.com/a/xxxx',
    required: false,
  })
  @IsString()
  @IsOptional()
  profilePicture?: string;
}
