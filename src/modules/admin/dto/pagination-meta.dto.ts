import { ApiProperty } from '@nestjs/swagger';

/**
 * Pagination Meta DTO
 *
 * Metadata for paginated responses
 */
export class PaginationMetaDto {
  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Items per page' })
  limit: number;

  @ApiProperty({ description: 'Total number of items' })
  totalItems: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;
}
