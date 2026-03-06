import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Blog } from './entities/blog.entity';
import { BlogRepository } from './repositories/blog.repository';
import {
  BlogResponseDto,
  CreateBlogDto,
  UpdateBlogDto,
  BlogNotificationResponseDto,
} from './dto';
import { Account } from '../accounts/entities/accounts.entity';
import { AccountRole, AccountStatus } from '../accounts/enums';
import { ac } from '@faker-js/faker/dist/airline-CWrCIUHH';
import { AccountsService } from '../accounts/accounts.service';
import { SocketGatewayService } from '../socket-gateway/socket-gateway.service';

/**
 * Blogs Service
 *
 * Centralized service layer for managing all blog-related operations in the Medicare system.
 * This service implements the business logic layer between controllers and the data access layer (repository).
 *
 * Core Responsibilities:
 * - Blog retrieval (list and detail)
 * - Blog creation (clinic admin only)
 * - Blog update (clinic admin only, own blogs)
 * - Blog deletion (clinic admin only, own blogs)
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
  constructor(
    private readonly blogRepository: BlogRepository,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    private readonly accountsService: AccountsService,
    private readonly socketGatewayService: SocketGatewayService,
  ) { }

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
   * Find Blogs by Clinic ID
   *
   * Retrieves all blog posts belonging to a specific clinic.
   * Accepts either a clinic manager ID or a staff/doctor ID.
   * If a staff/doctor ID is passed, resolves to the parent clinic manager ID.
   *
   * @param {string} accountId - Account UUID (clinic manager or staff/doctor)
   * @returns {Promise<BlogResponseDto[]>} Array of blog DTOs for the clinic
   * @throws {NotFoundException} If account not found
   */
  async findByClinicId(accountId: string): Promise<BlogResponseDto[]> {
    const account = await this.accountRepository.findOne({
      where: { _id: accountId },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    // If account has a parentId, it's a staff/doctor — use the parent (clinic manager) ID
    const clinicManagerId = account.parentId;

    const blogs = await this.blogRepository.findByClinicId(clinicManagerId);

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

  /**
   * Create New Blog
   *
   * Creates a new blog post for the authenticated clinic admin.
   *
   * Business Rules:
   * - User must be a CLINIC_ADMIN (enforced by controller guard)
   * - Blog is associated with the user's account ID (clinic ID)
   *
   * @param {CreateBlogDto} createBlogDto - Blog creation data
   * @param {Account} user - Authenticated user (Clinic Admin)
   * @returns {Promise<BlogResponseDto>} Created blog dto
   */
  async create(
    createBlogDto: CreateBlogDto,
    user: Account,
  ): Promise<BlogResponseDto> {
    const blog = this.blogRepository.create({
      ...createBlogDto,
      clinicId: user.parentId,
    });

    const savedBlog = await this.blogRepository.saveBlog(blog);

    // Fetch full blog with clinic info to return complete response
    const fullBlog = await this.blogRepository.findByIdWithClinic(
      savedBlog._id,
    );

    // Fetch all active patients
    const [patients] = await this.accountsService.findByRoleAndStatus(
      AccountRole.PATIENT,
      AccountStatus.ACTIVE,
      0,
      100000, // Fetch up to 100k patients to notify
    );

    if (patients.length > 0) {
      // 1. Bulk create notifications
      const notificationsToSave = patients.map((patient) => ({
        patientId: patient._id,
        blogId: fullBlog!._id,
        isRead: false,
      }));
      await this.blogRepository.saveBlogNotifications(notificationsToSave);

      // 2. Map and emit socket events to online patients
      const responseDto = new BlogResponseDto(fullBlog!);
      patients.forEach((patient) => {
        const userSocketId = this.socketGatewayService.getUserSocket(
          patient._id,
        );
        if (userSocketId) {
          this.socketGatewayService.server
            .to(userSocketId)
            .emit('newBlogNotification', {
              message: 'New blog posted',
              blog: responseDto,
            });
        }
      });
    }

    return new BlogResponseDto(fullBlog!);
  }

  /**
   * Update Blog
   *
   * Updates an existing blog post.
   *
   * Business Rules:
   * - Blog must exist
   * - User must be the owner of the blog (clinicId matches user ID)
   *
   * @param {string} id - Blog UUID
   * @param {UpdateBlogDto} updateBlogDto - Updatable fields
   * @param {Account} user - Authenticated user
   * @returns {Promise<BlogResponseDto>} Updated blog dto
   * @throws {NotFoundException} If blog not found
   * @throws {ForbiddenException} If user represents a different clinic
   */
  async update(
    id: string,
    updateBlogDto: UpdateBlogDto,
    user: Account,
  ): Promise<BlogResponseDto> {
    const blog = await this.blogRepository.findById(id);

    if (!blog) {
      throw new NotFoundException('Blog not found');
    }

    if (blog.clinicId !== user.parentId) {
      throw new ForbiddenException('You can only update your own blogs');
    }

    // Merge updates
    Object.assign(blog, updateBlogDto);

    await this.blogRepository.saveBlog(blog);

    // Return full details
    return this.findOne(id);
  }

  /**
   * Delete Blog
   *
   * Soft deletes a blog post.
   *
   * Business Rules:
   * - Blog must exist
   * - User must be the owner of the blog
   *
   * @param {string} id - Blog UUID
   * @param {Account} user - Authenticated user
   * @returns {Promise<void>}
   * @throws {NotFoundException} If blog not found
   * @throws {ForbiddenException} If user not owner
   */
  async remove(id: string, user: Account): Promise<void> {
    const blog = await this.blogRepository.findById(id);

    if (!blog) {
      throw new NotFoundException('Blog not found');
    }

    if (blog.clinicId !== user.parentId) {
      throw new ForbiddenException('You can only delete your own blogs');
    }

    await this.blogRepository.softDelete(id);
  }

  /**
   * Find Blogs by Patient ID
   *
   * Retrieves all blog notifications for a specific patient,
   * enriched with blog title, thumbnail, and createdAt.
   *
   * @param {string} patientId - Patient UUID
   * @returns {Promise<BlogNotificationResponseDto[]>} Array of blog notification DTOs
   */
  async findBlogsByPatientId(
    patientId: string,
  ): Promise<BlogNotificationResponseDto[]> {
    const notifications =
      await this.blogRepository.findBlogsByPatientId(patientId);
    return notifications.map(
      (notification) => new BlogNotificationResponseDto(notification),
    );
  }

  /**
   * Mark Blog Notification as Read
   *
   * @param {string} notificationId - Notification UUID
   * @param {string} patientId - Patient UUID
   * @returns {Promise<BlogNotificationResponseDto>} Updated notification
   * @throws {NotFoundException} If notification not found or doesn't belong to patient
   */
  async markNotificationAsRead(
    notificationId: string,
    patientId: string,
  ): Promise<BlogNotificationResponseDto> {
    const notification = await this.blogRepository.markNotificationAsRead(
      notificationId,
      patientId,
    );

    if (!notification) {
      throw new NotFoundException('Blog notification not found');
    }

    return new BlogNotificationResponseDto(notification);
  }
}
