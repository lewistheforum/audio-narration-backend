import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsIn,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {

    // username
    @ApiProperty({
        description: 'Tên đăng nhập',
        example: 'baotran1003',
        minLength: 3,
    })
    @IsString()
    @MinLength(3)
    username: string;

    // password
    @ApiProperty({
        description: 'Mật khẩu',
        example: 'password123',
        minLength: 6,
    })
    @IsString()
    @MinLength(6)
    password: string;

    // email
    @ApiProperty({
        description: 'Email đăng ký',
        example: 'userexample@gmail.com',
        minLength: 6,
    })
    @IsString()
    @MinLength(6)
    email: string;

    // gender
    @ApiProperty({
        description: 'Giới tính',
        example: 'mail',
        required: false,
        enum: ['male', 'female', 'other'],
    })
    @IsString()
    @IsIn(['male', 'female', 'other'])
    @IsOptional()
    gender?: string;

    // DOB
    @ApiProperty({
        description: 'Ngày sinh (YYYY-MM-DD)',
        example: '2004-03-10',
        required: false,
    })
    @IsDateString()
    @IsOptional()
    dateOfBirth?: string;
}
