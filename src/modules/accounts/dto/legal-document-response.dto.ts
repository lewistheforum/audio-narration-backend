import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { LegalDocumentVerificationStatus } from '../enums/legal-document-verification-status.enum';
import { ClinicsLegalDocuments } from '../entities/clinics_legal_documents.entity';
import { formatToVietnamTime } from '../../../common/utils/date.util';

/**
 * Legal Document Response DTO
 *
 * Used for returning legal document information.
 */
export class LegalDocumentResponseDto {
  @ApiProperty({
    description: 'Legal document ID',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  _id: string;

  @ApiProperty({
    description: 'Associated account ID (clinic manager)',
    example: '550e8400-e29b-41d4-a716-4466554400000',
  })
  accountId: string;

  @ApiProperty({
    description: 'Operating license document URL',
    example: 'https://example.com/operating-license.pdf',
    required: false,
  })
  operatingLicense?: string;

  @ApiProperty({
    description: 'Business license document URL',
    example: 'https://example.com/business-license.pdf',
    required: false,
  })
  businessLicense?: string;

  @ApiProperty({
    description: 'Tax ID document URL',
    example: 'https://example.com/tax-id.pdf',
    required: false,
  })
  taxIdUrl?: string;

  @ApiProperty({
    description: 'Other supporting documents URLs',
    example: ['https://example.com/doc1.pdf', 'https://example.com/doc2.pdf'],
    required: false,
    type: [String],
  })
  otherDocs?: string[];

  @ApiProperty({
    description: 'Verification status',
    enum: LegalDocumentVerificationStatus,
    example: LegalDocumentVerificationStatus.PENDING_REVIEW,
  })
  verificationStatus: LegalDocumentVerificationStatus;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2023-10-27T10:00:00.000Z',
  })
  @Transform(({ value }) => formatToVietnamTime(value))
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2023-10-27T10:00:00.000Z',
  })
  @Transform(({ value }) => formatToVietnamTime(value))
  updatedAt: Date;

  constructor(legalDocs: ClinicsLegalDocuments) {
    this._id = legalDocs._id;
    this.accountId = legalDocs.accountId;
    this.operatingLicense = legalDocs.operatingLicense;
    this.businessLicense = legalDocs.businessLicense;
    this.taxIdUrl = legalDocs.taxIdUrl;
    this.otherDocs = legalDocs.otherDocs;
    this.verificationStatus = legalDocs.verificationStatus;
    this.createdAt = legalDocs.createdAt;
    this.updatedAt = legalDocs.updatedAt;
  }
}
