import {
    IsString,
    MaxLength,
    IsOptional,
    IsEnum,
    IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Gender } from '../enums';

/**
 * Create Account Profile DTO
 * 
 * Used for Step 2 of patient registration (GeneralAccount entity)
 * Creates profile data in general_accounts table
 * If this step fails, the account created in Step 1 will be automatically deleted
 */
export class CreateAccountProfileDto {
    @ApiProperty({
        description: 'Client full name',
        example: 'John Doe',
        required: true,
        maxLength: 255,
    })
    @IsNotEmpty({ message: 'Full name is required' })
    @IsString({ message: 'Full name must be a string' })
    @MaxLength(255, { message: 'Full name must not exceed 255 characters' })
    @Transform(({ value }) => value?.trim())
    fullName: string;

    @ApiProperty({
        description: 'Client gender',
        enum: Gender,
        example: Gender.MALE,
        required: true,
    })
    @IsNotEmpty({ message: 'Gender is required' })
    @IsEnum(Gender, { message: 'Gender must be one of: MALE, FEMALE, OTHER' })
    gender: Gender;
}
