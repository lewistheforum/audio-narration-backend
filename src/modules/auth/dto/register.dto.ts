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

    @ApiProperty({
        description: 'Username for login',
        example: 'baotran1003',
        minLength: 3,
    })
    @IsString()
    @MinLength(3)
    username: string;

    @ApiProperty({
        description: 'Account password',
        example: 'password123',
        minLength: 6,
    })
    @IsString()
    @MinLength(6)
    password: string;

    @ApiProperty({
        description: 'Registration email',
        example: 'userexample@gmail.com',
        minLength: 6,
    })
    @IsString()
    @MinLength(6)
    email: string;

    @ApiProperty({
        description: 'Gender',
        example: 'mail',
        required: false,
        enum: ['male', 'female', 'other'],
    })
    @IsString()
    @IsIn(['male', 'female', 'other'])
    @IsOptional()
    gender?: string;

    @ApiProperty({
        description: 'Date of birth (YYYY-MM-DD)',
        example: '2004-03-10',
        required: false,
    })
    @IsDateString()
    @IsOptional()
    dateOfBirth?: string;
}
