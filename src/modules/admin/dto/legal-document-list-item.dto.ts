import { ApiProperty } from '@nestjs/swagger';

/**
 * Legal Document List Item DTO
 *
 * Single item in legal documents list
 */
export class LegalDocumentListItemDto {
  @ApiProperty({ description: 'Legal document record ID' })
  id: string;

  @ApiProperty({ description: 'Clinic Admin Account ID' })
  clinicAdminId: string;

  @ApiProperty({ description: 'Subscription ID' })
  subscriptionId: string;

  @ApiProperty({ description: 'Clinic name' })
  clinicName: string;

  @ApiProperty({ description: 'Manager email' })
  managerEmail: string;

  @ApiProperty({ description: 'Admin email' })
  adminEmail: string;

  @ApiProperty({ description: 'Operating license URL', nullable: true })
  operatingLicense: string | null;

  @ApiProperty({ description: 'Business license URL', nullable: true })
  businessLicense: string | null;

  @ApiProperty({ description: 'Submission timestamp' })
  submittedAt: Date;
}
