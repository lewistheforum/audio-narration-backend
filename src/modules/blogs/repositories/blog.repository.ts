import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial, ILike } from 'typeorm';
import { Blog } from '../entities/blog.entity';
import { BlogType } from '../enums';
import { BlogNotification } from '../../notifications/entities/blog-notification.entity';

/**
 * Blog Repository
 *
 * Data access layer for Blog entity.
 * Implements Repository Pattern to separate data access logic from business logic.
 *
 * Responsibilities:
 * - Direct database operations (CRUD) for Blog entity
 * - Query construction and execution
 * - No business logic (handled by Services)
 * - No validation (handled by DTOs and Service)
 *
 * Architecture:
 * - Uses TypeORM Repository pattern
 * - Single entity: Blog
 * - Provides both individual and bulk operations
 *
 * Design Principles:
 * - Single Responsibility: Only handles Blog data access
 * - Separation of Concerns: No business logic
 * - Testability: Easy to mock for unit tests
 * - Maintainability: Centralized query logic
 *
 * @class BlogRepository
 * @injectable
 */
@Injectable()
export class BlogRepository {
  /**
   * Constructs BlogRepository with TypeORM repository
   *
   * @param {Repository<Blog>} blogRepository - TypeORM repository for Blog entity
   */
  constructor(
    @InjectRepository(Blog)
    private readonly blogRepository: Repository<Blog>,
    @InjectRepository(BlogNotification)
    private readonly blogNotificationRepository: Repository<BlogNotification>,
  ) {}

  /**
   * Find All Blogs
   *
   * Retrieves all blog records from database with optional inclusion of soft-deleted records.
   *
   * @param {boolean} includeDeleted - Whether to include soft-deleted blogs (default: false)
   * @returns {Promise<Blog[]>} Array of all blog entities
   */
  async findAll(includeDeleted: boolean = false): Promise<Blog[]> {
    return this.blogRepository.find({
      withDeleted: includeDeleted,
    });
  }

  /**
   * Find All Blogs with Clinic
   *
   * Retrieves all blog records with clinic information.
   * Excludes soft-deleted records.
   * Orders by newest first (createdAt DESC).
   *
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @param {string} [search] - Optional search query for title
   * @returns {Promise<[Blog[], number]>} Array of blog entities and total count
   */
  async findAllWithClinic(
    page: number = 1,
    limit: number = 6,
    type?: BlogType,
    search?: string,
  ): Promise<[Blog[], number]> {
    const where: any = {};
    if (type && (type as any) !== 'all' && (type as any) !== '') {
      where.type = type;
    }
    if (search) {
      where.title = ILike(`%${search}%`);
    }

    return this.blogRepository.findAndCount({
      where,
      relations: ['clinic', 'clinic.clinicManagerInformation'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  /**
   * Find Blog by ID with Clinic
   *
   * Retrieves a single blog by its UUID with clinic information.
   * Excludes soft-deleted records.
   *
   * @param {string} id - Blog UUID
   * @returns {Promise<Blog | null>} Blog entity with clinic relations or null if not found
   */
  async findByIdWithClinic(id: string): Promise<Blog | null> {
    return this.blogRepository.findOne({
      where: { _id: id },
      relations: ['clinic', 'clinic.clinicManagerInformation'],
    });
  }

  /**
   * Find Blog by ID
   *
   * Retrieves a single blog by its UUID.
   * Excludes soft-deleted blogs by default.
   *
   * @param {string} id - Blog UUID
   * @returns {Promise<Blog | null>} Blog entity or null if not found
   */
  async findById(id: string): Promise<Blog | null> {
    return this.blogRepository.findOne({
      where: { _id: id },
    });
  }

  /**
   * Find Blogs by Clinic ID
   *
   * Retrieves all blogs for a specific clinic.
   *
   * @param {string} clinicId - Clinic UUID
   * @returns {Promise<Blog[]>} Array of blog entities
   */
  async findByClinicId(clinicId: string): Promise<Blog[]> {
    return this.blogRepository.find({
      where: { clinicId },
      relations: ['clinic', 'clinic.clinicManagerInformation'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Create Blog Entity
   *
   * Creates a Blog entity instance without persisting to database.
   * Use save() to persist created entity.
   *
   * @param {DeepPartial<Blog>} data - Blog data (partial object)
   * @returns {Blog} Unpersisted Blog entity instance
   */
  create(data: DeepPartial<Blog>): Blog {
    return this.blogRepository.create(data);
  }

  /**
   * Save Blog Entity
   *
   * Persists a Blog entity to database.
   * Performs INSERT for new entities, UPDATE for existing entities.
   *
   * @param {Blog} blog - Blog entity to save
   * @returns {Promise<Blog>} Saved Blog entity with updated fields
   */
  async saveBlog(blog: Blog): Promise<Blog> {
    return this.blogRepository.save(blog);
  }

  /**
   * Save Multiple Blog Entities
   *
   * Bulk save multiple blog entities to database.
   *
   * @param {Blog[]} blogs - Array of Blog entities to save
   * @returns {Promise<Blog[]>} Array of saved Blog entities
   */
  async saveBlogs(blogs: Blog[]): Promise<Blog[]> {
    return this.blogRepository.save(blogs);
  }

  /**
   * Soft Delete Blog
   *
   * Marks a blog as deleted by setting deletedAt timestamp.
   *
   * @param {string} id - Blog UUID to soft delete
   * @returns {Promise<void>} No return value
   */
  async softDelete(id: string): Promise<void> {
    await this.blogRepository.softDelete(id);
  }

  /**
   * Hard Delete Blog
   *
   * Permanently removes a blog from database.
   *
   * @param {string} id - Blog UUID to permanently delete
   * @returns {Promise<number>} Number of affected rows
   */
  async delete(id: string): Promise<number> {
    const result = await this.blogRepository.delete(id);
    return result.affected || 0;
  }

  /**
   * Count All Blogs
   *
   * Returns the total count of blog records in the database.
   *
   * @returns {Promise<number>} Number of blog records
   *
   * @example
   * ```typescript
   * const count = await repository.count();
   * ```
   */
  async count(): Promise<number> {
    return this.blogRepository.count();
  }

  /**
   * Find Blogs by Patient ID
   *
   * Retrieves all blog notifications for a specific patient,
   * joined with blog data (title, thumbnail, createdAt).
   *
   * @param {string} patientId - Patient UUID
   * @returns {Promise<BlogNotification[]>} Array of blog notifications with blog relations
   */
  async findBlogsByPatientId(patientId: string): Promise<BlogNotification[]> {
    return this.blogNotificationRepository.find({
      where: { patientId },
      relations: ['blog'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Save Multiple Blog Notifications
   *
   * Bulk save blog notifications to database.
   *
   * @param {DeepPartial<BlogNotification>[]} notifications - Array of notifications to save
   * @returns {Promise<BlogNotification[]>} Array of saved notifications
   */
  async saveBlogNotifications(
    notifications: DeepPartial<BlogNotification>[],
  ): Promise<BlogNotification[]> {
    const newNotifications =
      this.blogNotificationRepository.create(notifications);
    return this.blogNotificationRepository.save(newNotifications);
  }

  /**
   * Mark Notification as Read
   *
   * Updates the isRead status of a specific notification belonging to a patient.
   *
   * @param {string} notificationId - Notification UUID
   * @param {string} patientId - Patient UUID who owns the notification
   * @returns {Promise<BlogNotification | null>} Updated notification or null if not found
   */
  async markNotificationAsRead(
    notificationId: string,
    patientId: string,
  ): Promise<BlogNotification | null> {
    const notification = await this.blogNotificationRepository.findOne({
      where: { _id: notificationId, patientId },
      relations: ['blog'],
    });

    if (!notification) {
      return null;
    }

    notification.isRead = true;
    return this.blogNotificationRepository.save(notification);
  }
}
