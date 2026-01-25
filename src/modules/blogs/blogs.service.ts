import { Injectable, NotFoundException } from '@nestjs/common';
import { Blog } from './entities/blog.entity';
import { BlogRepository } from './repositories/blog.repository';
import { BlogResponseDto } from './dto';

/**
 * Blogs Service
 *
 * Centralized service layer for managing all blog-related operations in the Medicare system.
 * This service implements the business logic layer between controllers and the data access layer (repository).
 *
 * Core Responsibilities:
 * - Blog retrieval (list and detail)
 * - Soft-deleted record exclusion
 * - Clinic information inclusion via ORM relations
 *
 * Database Architecture:
 * - blogs table: Core blog data (id, clinic_id, title, content, thumbnail, type)
 *
 * Design Patterns:
 * - Repository Pattern: All database operations delegated to BlogRepository
 * - DTO Pattern: Data transformation via BlogResponseDto
 * - Service Layer Pattern: Business logic separation from controllers
 *
 * @class BlogsService
 * @injectable
 */
@Injectable()
export class BlogsService {
  constructor(private readonly blogRepository: BlogRepository) {}

  /**
   * Find All Blogs
   *
   * Retrieves all blog posts from the system.
   * Excludes soft-deleted records (deletedAt IS NULL).
   * Orders by newest first (createdAt DESC).
   * Includes clinic information for each blog via ORM relation join.
   *
   * Use Cases:
   * - Blog listing page
   * - Public blog browsing
   * - Blog feed display
   *
   * @returns {Promise<BlogResponseDto[]>} Array of blog DTOs with clinic information
   *
   * @example
   * ```typescript
   * const blogs = await blogsService.findAll();
   * // Returns array of blogs ordered by newest first
   * ```
   */
  async findAll(): Promise<BlogResponseDto[]> {
    const blogs = await this.blogRepository.findAllWithClinic();
    return blogs.map((blog) => new BlogResponseDto(blog));
  }

  /**
   * Find Blog by ID
   *
   * Retrieves a single blog by its UUID.
   * Excludes soft-deleted records (deletedAt IS NULL).
   * Includes clinic information via ORM relation join.
   *
   * Business Rules:
   * - Blog must exist
   * - Blog must not be soft-deleted
   * - Returns 404 Not Found if blog not found
   *
   * @param {string} id - Blog UUID
   * @returns {Promise<BlogResponseDto>} Blog DTO with clinic information
   * @throws {NotFoundException} If blog does not exist or is soft-deleted
   *
   * @example
   * ```typescript
   * const blog = await blogsService.findOne('uuid-here');
   * // Returns blog with clinic information
   * ```
   */
  async findOne(id: string): Promise<BlogResponseDto> {
    const blog = await this.blogRepository.findByIdWithClinic(id);
    if (!blog) {
      throw new NotFoundException('Blog not found');
    }
    return new BlogResponseDto(blog);
  }
}
