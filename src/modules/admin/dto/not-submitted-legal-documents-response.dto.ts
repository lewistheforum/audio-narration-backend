import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from './pagination-meta.dto';
import { RegistrationStatus } from '../../subscriptions/enums/subscription-status.enum';

/**
 * Not Submitted Legal Document Item DTO
 */
export class NotSubmittedLegalDocumentItemDto {
  @ApiProperty()
  clinicName: string;

  @ApiProperty()
  adminEmail: string;

  @ApiProperty()
  managerEmail: string;

  @ApiProperty()
  registrationDate: Date;

  @ApiProperty()
  daysSinceRegistration: number;

  @ApiProperty({ enum: RegistrationStatus })
  currentStatus: RegistrationStatus;
}

/**
 * Not Submitted Legal Documents Response DTO
 */
export class NotSubmittedLegalDocumentsResponseDto {
  @ApiProperty({ type: [NotSubmittedLegalDocumentItemDto] })
  data: NotSubmittedLegalDocumentItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
