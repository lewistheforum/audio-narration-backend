import { ApiProperty } from '@nestjs/swagger';
import { BlogResponseDto } from './blog-response.dto';

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
  blogs: BlogResponseDto[];
}
