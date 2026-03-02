import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from './pagination-meta.dto';

/**
 * Approved Legal Document Item DTO
 */
export class ApprovedLegalDocumentItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  subscriptionId: string;

  @ApiProperty()
  clinicName: string;

  @ApiProperty()
  managerEmail: string;

  @ApiProperty()
  adminEmail: string;

  @ApiProperty()
  approvedAt: Date;
}

/**
 * Approved Legal Documents Response DTO
 */
export class ApprovedLegalDocumentsResponseDto {
  @ApiProperty({ type: [ApprovedLegalDocumentItemDto] })
  data: ApprovedLegalDocumentItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
