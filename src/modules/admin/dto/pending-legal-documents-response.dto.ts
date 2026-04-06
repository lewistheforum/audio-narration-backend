import { ApiProperty } from '@nestjs/swagger';
import { LegalDocumentListItemDto } from './legal-document-list-item.dto';
import { PaginationDto } from './pagination.dto';

/**
 * Pending Legal Documents Response DTO
 *
 * Response for pending legal documents list
 */
export class PendingLegalDocumentsResponseDto {
  @ApiProperty({ type: [LegalDocumentListItemDto] })
  data: LegalDocumentListItemDto[];

  @ApiProperty({ type: PaginationDto })
  pagination: PaginationDto;
}
