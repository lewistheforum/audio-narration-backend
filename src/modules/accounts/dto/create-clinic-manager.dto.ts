import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsString, 
  IsEmail, 
  IsEnum, 
  IsOptional, 
  IsDateString,
  MinLength,
  MaxLength
} from 'class-validator';
import { Gender } from '../enums/gender.enum';

/**
 * Create Clinic Manager DTO
 * Used by CLINIC_ADMIN to create new manager account
 */
export class CreateClinicManagerDto {
  @ApiProperty({ description: 'Manager email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ 
    description: 'Manager password (min 8 characters)',
    minLength: 8
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ description: 'Manager full name' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  @ApiProperty({ description: 'Clinic branch name' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  clinicBranchName: string;

  @ApiProperty({ 
    description: 'Gender',
    enum: Gender
  })
  @IsEnum(Gender)
  gender: Gender;

  @ApiPropertyOptional({ description: 'Date of birth (ISO 8601 format)' })
  @IsOptional()
  @IsDateString()
  dob?: string;

  // Address fields
  @ApiProperty({ description: 'Street address' })
  @IsString()
  address: string;

  @ApiProperty({ description: 'Ward code' })
  @IsString()
  ward: string;

  @ApiProperty({ description: 'District code' })
  @IsString()
  district: string;

  @ApiProperty({ description: 'Province code' })
  @IsString()
  province: string;

  @ApiProperty({ description: 'Province name' })
  @IsString()
  provinceName: string;

  @ApiProperty({ description: 'District name' })
  @IsString()
  districtName: string;

  @ApiProperty({ description: 'Ward name' })
  @IsString()
  wardName: string;

  // Google Maps iframe (optional)
  @ApiPropertyOptional({ description: 'Google Maps iframe HTML' })
  @IsOptional()
  @IsString()
  googleMapIframe?: string;
}
