import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from './pagination-meta.dto';

/**
 * Rejected Legal Document Item DTO
 */
export class RejectedLegalDocumentItemDto {
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
  rejectionReason: string;

  @ApiProperty()
  rejectedAt: Date;
}

/**
 * Rejected Legal Documents Response DTO
 */
export class RejectedLegalDocumentsResponseDto {
  @ApiProperty({ type: [RejectedLegalDocumentItemDto] })
  data: RejectedLegalDocumentItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
