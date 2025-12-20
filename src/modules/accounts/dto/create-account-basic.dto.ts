import {
    IsEmail,
    IsString,
    MinLength,
    MaxLength,
    IsOptional,
    IsNotEmpty,
    Matches,
    IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/**
 * Create Account Basic DTO
 * 
 * Used for Step 1 of patient registration (Account entity only)
 * Creates account in accounts table with INCOMPLETE status
 * 
 * Password Requirements:
 * - Minimum 6 characters
 * - Maximum 50 characters
 * - Must contain at least one letter
 * - Must contain at least one number
 */
export class CreateAccountBasicDto {
    @ApiProperty({
        description: 'Client username',
        example: 'johndoe',
    })
    @IsNotEmpty({ message: 'Username is required' })
    @IsString({ message: 'Username must be a string' })
    @MinLength(3, { message: 'Username must be at least 3 characters' })
    @MaxLength(100, { message: 'Username must not exceed 100 characters' })
    @Transform(({ value }) => value?.trim())
    username: string;

    @ApiProperty({
        description: 'Client email address',
        example: 'user@example.com',
    })
    @IsNotEmpty({ message: 'Email is required' })
    @IsEmail({}, { message: 'Invalid email format' })
    @Transform(({ value }) => value?.toLowerCase().trim())
    email: string;

    @ApiProperty({
        description: 'Client phone number',
        example: '+84123456789',
        required: false,
    })
    @IsOptional()
    @IsString({ message: 'Phone must be a string' })
    @Matches(/^[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}$/, {
        message: 'Invalid phone number format',
    })
    phone?: string;

    @ApiProperty({
        description: 'Client date of birth (ISO date string)',
        example: '1990-01-15',
        required: false,
    })
    @IsOptional()
    @IsDateString({}, { message: 'Date of birth must be a valid date string (YYYY-MM-DD)' })
    dob?: string;

    @ApiProperty({
        description: 'Client password (min 6 characters, must contain letter and number)',
        example: 'Pass123456',
        minLength: 6,
        maxLength: 50,
    })
    @IsNotEmpty({ message: 'Password is required' })
    @IsString()
    @MinLength(6, { message: 'Password must be at least 6 characters' })
    @MaxLength(50, { message: 'Password must not exceed 50 characters' })
    @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, {
        message: 'Password must contain at least one letter and one number',
    })
    password: string;

    @ApiProperty({
        description: 'Profile picture URL',
        example: 'https://example.com/avatar.jpg',
        required: false,
    })
    @IsOptional()
    @IsString({ message: 'Profile picture must be a string' })
    profilePicture?: string;
}
