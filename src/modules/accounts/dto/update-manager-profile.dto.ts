import { ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsString, 
  IsEnum, 
  IsOptional, 
  IsDateString,
  MinLength,
  MaxLength
} from 'class-validator';
import { Gender } from '../enums/gender.enum';

/**
 * Update Manager Profile DTO
 * Used for PATCH /api/clinic-managers/:id/profile
 * Only updates personal information, no status changes
 */
export class UpdateManagerProfileDto {
  @ApiPropertyOptional({ description: 'Manager full name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional({ description: 'Clinic branch name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  clinicBranchName?: string;

  @ApiPropertyOptional({ 
    description: 'Gender',
    enum: Gender
  })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ description: 'Date of birth (ISO 8601 format)' })
  @IsOptional()
  @IsDateString()
  dob?: string;

  @ApiPropertyOptional({ description: 'Profile picture URL' })
  @IsOptional()
  @IsString()
  profilePicture?: string;
}
