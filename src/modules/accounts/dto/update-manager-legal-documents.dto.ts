import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray } from 'class-validator';

/**
 * Update Manager Legal Documents DTO
 * Used for PUT /api/clinic-managers/:id/legal-documents
 * ONLY accessible by CLINIC_ADMIN (RBAC enforced)
 * 
 * CRITICAL: Any update to legal documents triggers re-approval workflow:
 * - verificationStatus reset to PENDING_REVIEW
 * - Manager status changes to PENDING_APPROVAL
 * - Branch operations frozen until admin approves
 */
export class UpdateManagerLegalDocumentsDto {
  @ApiPropertyOptional({ description: 'Operating license URL or file path' })
  @IsOptional()
  @IsString()
  operatingLicense?: string;

  @ApiPropertyOptional({ description: 'Business license URL or file path' })
  @IsOptional()
  @IsString()
  businessLicense?: string;

  @ApiPropertyOptional({ description: 'Tax ID document URL or file path' })
  @IsOptional()
  @IsString()
  taxIdUrl?: string;

  @ApiPropertyOptional({ 
    description: 'Additional documents (URLs or file paths)',
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  otherDocs?: string[];
}
