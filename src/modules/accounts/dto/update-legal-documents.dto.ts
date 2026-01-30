import {
  IsString,
  IsOptional,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Update Legal Documents DTO
 *
 * Used for updating rejected legal documents for a specific clinic manager.
 * This is used when documents have been rejected and need to be resubmitted.
 *
 * Business Rules:
 * - Actor must have CLINIC_ADMIN role
 * - Manager exists, has role CLINIC_MANAGER
 * - Ownership: manager.parentId equals current admin account id
 * - Documents must be in REJECTED status
 * - verificationStatus transitions to PENDING_REVIEW
 * - Subscription status transitions back to PENDING_APPROVAL
 */
export class UpdateLegalDocumentsDto {
  @ApiProperty({
    description: 'Operating license document URL',
    example: 'https://example.com/operating-license.pdf',
    required: false,
  })
  @IsOptional()
  @IsUrl({}, { message: 'Operating license must be a valid URL' })
  @IsString({ message: 'Operating license URL must be a string' })
  @MaxLength(1000, { message: 'Operating license URL must not exceed 1000 characters' })
  operatingLicense?: string;

  @ApiProperty({
    description: 'Business license document URL',
    example: 'https://example.com/business-license.pdf',
    required: false,
  })
  @IsOptional()
  @IsUrl({}, { message: 'Business license must be a valid URL' })
  @IsString({ message: 'Business license URL must be a string' })
  @MaxLength(1000, { message: 'Business license URL must not exceed 1000 characters' })
  businessLicense?: string;
}
