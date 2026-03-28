import {
  IsString,
  IsOptional,
  IsUrl,
  MaxLength,
  IsArray,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const LEGAL_DOCUMENT_URL_PATTERN =
  /^https?:\/\/.*\.(png|jpe?g|pdf|doc|docx)(\?.*)?$/i;

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
  @Matches(LEGAL_DOCUMENT_URL_PATTERN, {
    message: 'Operating license must be a PNG, JPG, JPEG, DOC, DOCX, or PDF file URL',
  })
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
  @Matches(LEGAL_DOCUMENT_URL_PATTERN, {
    message: 'Business license must be a PNG, JPG, JPEG, DOC, DOCX, or PDF file URL',
  })
  businessLicense?: string;

  @ApiProperty({
    description: 'Tax ID document URL',
    example: 'https://example.com/tax-id.pdf',
    required: false,
  })
  @IsOptional()
  @IsUrl({}, { message: 'Tax ID URL must be a valid URL' })
  @IsString({ message: 'Tax ID URL must be a string' })
  @MaxLength(1000, { message: 'Tax ID URL must not exceed 1000 characters' })
  @Matches(LEGAL_DOCUMENT_URL_PATTERN, {
    message: 'Tax ID URL must be a PNG, JPG, JPEG, DOC, DOCX, or PDF file URL',
  })
  taxIdUrl?: string;

  @ApiProperty({
    description: 'Other supporting documents URLs',
    example: ['https://example.com/doc1.pdf'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Other docs must be an array' })
  @IsUrl({}, { each: true, message: 'Each supporting document must be a valid URL' })
  @IsString({ each: true, message: 'Each doc URL must be a string' })
  @MaxLength(1000, { each: true, message: 'Each doc URL must not exceed 1000 characters' })
  @Matches(LEGAL_DOCUMENT_URL_PATTERN, {
    each: true,
    message: 'Each supporting document must be a PNG, JPG, JPEG, DOC, DOCX, or PDF file URL',
  })
  otherDocs?: string[];
}
