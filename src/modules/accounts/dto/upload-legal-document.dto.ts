import {
  IsString,
  IsOptional,
  IsArray,
  IsUrl,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Upload Legal Document DTO
 *
 * Used in Step 4B of clinic admin registration flow.
 * Uploads legal documents for a specific clinic manager.
 *
 * Business Rules:
 * - Actor must have CLINIC_ADMIN role
 * - Manager exists, has role CLINIC_MANAGER
 * - Ownership: manager.parentId equals current admin account id
 * - Docs stored per manager (FK to manager account)
 * - Status transitions to PENDING_APPROVAL
 * - verificationStatus transitions to PENDING_REVIEW
 */
export class UploadLegalDocumentDto {
  @ApiProperty({
    description: 'Operating license document URL',
    example: 'https://example.com/operating-license.pdf',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Operating license must be a string' })
  @MaxLength(1000, { message: 'Operating license URL must not exceed 1000 characters' })
  operatingLicense?: string;

  @ApiProperty({
    description: 'Business license document URL',
    example: 'https://example.com/business-license.pdf',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Business license URL must be a string' })
  @MaxLength(1000, { message: 'Business license URL must not exceed 1000 characters' })
  businessLicense?: string;

  @ApiProperty({
    description: 'Tax ID document URL',
    example: 'https://example.com/tax-id.pdf',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Tax ID URL must be a string' })
  @MaxLength(1000, { message: 'Tax ID URL must not exceed 1000 characters' })
  taxIdUrl?: string;

  @ApiProperty({
    description: 'Other supporting documents URLs',
    example: ['https://example.com/doc1.pdf', 'https://example.com/doc2.pdf'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Other docs must be an array' })
  @IsString({ each: true, message: 'Each doc URL must be a string' })
  @MaxLength(1000, { each: true, message: 'Each doc URL must not exceed 1000 characters' })
  otherDocs?: string[];
}
