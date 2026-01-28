import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiExtraModels,
} from '@nestjs/swagger';
import { BlogsService } from './blogs.service';
import { BlogResponseDto, BlogListResponseDto } from './dto';
import { ApiResponseData } from 'src/common/decorators/api-response.decorator';
import { MESSAGES } from 'src/common/message';

/**
 * Blogs Controller
 *
 * RESTful API controller for managing blog posts in the Medicare system.
 * Provides blog listing and detail retrieval functionality.
 *
 * Features:
 * - Blog list retrieval (all blogs, no pagination)
 * - Blog detail retrieval by ID
 * - Excludes soft-deleted blogs
 * - Includes clinic information for each blog
 *
 * Access Control:
 * - All endpoints are public (no authentication required)
 *
 * @controller
 * @tags Blogs
 */
@ApiTags('Blogs')
@ApiExtraModels(BlogResponseDto, BlogListResponseDto)
@Controller('blogs')
export class BlogsController {
  constructor(private readonly blogsService: BlogsService) {}

  /**
   * Get All Blogs
   *
   * Retrieves a list of all blog posts in the system.
   * Returns all blogs ordered by newest first.
   * Excludes soft-deleted records (deletedAt IS NULL).
   * Includes clinic information for each blog.
   *
   * Response Format:
   * - Returns array of BlogResponseDto objects
   * - Each blog includes clinic information
   * - Ordered by createdAt DESC (newest first)
   *
   * Access Control:
   * - Public endpoint (no authentication required)
   *
   * Use Cases:
   * - Blog listing page
   * - Blog feed display
   * - Public blog browsing
   *
   * @returns {Promise<{data: BlogResponseDto[], message: string}>} List of all blogs
   *
   * @swagger
   * @response 200 - Successfully retrieved blogs
   */
  @Get()
  @ApiOperation({ summary: 'Get all blogs' })
  @ApiResponseData({
    type: BlogResponseDto,
    status: MESSAGES.statusCode.success,
    message: 'Blogs retrieved successfully',
    isArray: true,
  })
  async findAll(): Promise<{ data: BlogResponseDto[]; message: string }> {
    const blogs = await this.blogsService.findAll();
    return {
      data: blogs,
      message: 'Blogs retrieved successfully',
    };
  }

  /**
   * Get Blog by ID
   *
   * Retrieves detailed information for a specific blog post.
   * Includes clinic information via clinic relation.
   * Excludes soft-deleted records.
   *
   * Path Parameters:
   * - id: Blog UUID
   *
   * Response Format:
   * - Returns BlogResponseDto with full blog details
   * - Includes clinic information
   *
   * Access Control:
   * - Public endpoint (no authentication required)
   *
   * Use Cases:
   * - Blog detail page
   * - Individual blog post view
   *
   * @param {string} id - Blog UUID
   * @returns {Promise<{data: BlogResponseDto, message: string}>} Blog details
   * @throws {NotFoundException} If blog not found
   *
   * @swagger
   * @response 200 - Successfully retrieved blog
   * @response 404 - Blog not found
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get blog by ID' })
  @ApiResponseData({
    type: BlogResponseDto,
    status: MESSAGES.statusCode.success,
    message: 'Blog retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Blog not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ data: BlogResponseDto; message: string }> {
    const blog = await this.blogsService.findOne(id);
    return {
      data: blog,
      message: 'Blog retrieved successfully',
    };
  }
}
