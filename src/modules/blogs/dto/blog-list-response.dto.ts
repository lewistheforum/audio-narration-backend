import { ApiProperty } from '@nestjs/swagger';
import { BlogResponseDto } from './blog-response.dto';

/**
 * Pagination DTO
 *
 * Pagination metadata
 */
export class PaginationDto {
  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of items',
    example: 50,
  })
  total: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 5,
  })
  totalPages: number;
}

/**
 * Blog List Response DTO
 *
 * Response wrapper for blog list
 */
export class BlogListResponseDto {
  @ApiProperty({
    description: 'Array of blogs',
    type: [BlogResponseDto],
  })
  data: BlogResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationDto,
  })
  pagination: PaginationDto;
}
