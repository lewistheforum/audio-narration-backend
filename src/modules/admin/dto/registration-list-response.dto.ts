import { ApiProperty } from '@nestjs/swagger';
import { LegalDocumentVerificationStatus } from '../../accounts/enums/legal-document-verification-status.enum';
import { RegistrationStatus } from '../../subscriptions/enums/subscription-status.enum';
import { PaginationDto } from './pagination.dto';

/**
 * Registration List Item DTO
 *
 * Single registration item in the list response
 */
export class RegistrationListItemDto {
  @ApiProperty({ description: 'Registration ID (clinic admin account ID)' })
  clinicAdminId: string;

  @ApiProperty({ description: 'Clinic name' })
  clinicName: string;

  @ApiProperty({ description: 'Clinic admin email' })
  email: string;

  @ApiProperty({ description: 'Clinic admin phone' })
  phone: string;

  @ApiProperty({
    description: 'Legal documents verification status',
    enum: LegalDocumentVerificationStatus,
  })
  legalDocsStatus: LegalDocumentVerificationStatus;

  @ApiProperty({
    description: 'Registration status',
    enum: RegistrationStatus,
  })
  status: RegistrationStatus;

  @ApiProperty({ description: 'Submission date' })
  submittedAt: Date;
}

/**
 * Registration List Response DTO
 *
 * Response wrapper for registration list endpoint
 */
export class RegistrationListResponseDto {
  @ApiProperty({ type: [RegistrationListItemDto] })
  registrations: RegistrationListItemDto[];

  @ApiProperty({ type: PaginationDto })
  pagination: PaginationDto;
}
