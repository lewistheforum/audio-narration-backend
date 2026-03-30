import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial, Between } from 'typeorm';
import { Feedback } from '../entities/feedback.entity';

/**
 * Feedback Repository
 *
 * Data access layer for Feedback entity.
 * Implements Repository Pattern to separate data access logic from business logic.
 *
 * Responsibilities:
 * - Direct database operations (CRUD) for Feedback entity
 * - Query construction and execution
 * - No business logic (handled by Services)
 * - No validation (handled by DTOs and Service)
 *
 * Architecture:
 * - Uses TypeORM Repository pattern
 * - Single entity: Feedback
 * - Provides both individual and bulk operations
 *
 * Design Principles:
 * - Single Responsibility: Only handles Feedback data access
 * - Separation of Concerns: No business logic
 * - Testability: Easy to mock for unit tests
 * - Maintainability: Centralized query logic
 *
 * @class FeedbackRepository
 * @injectable
 */
@Injectable()
export class FeedbackRepository {
  /**
   * Constructs FeedbackRepository with TypeORM repository
   *
   * @param {Repository<Feedback>} feedbackRepository - TypeORM repository for Feedback entity
   */
  constructor(
    @InjectRepository(Feedback)
    private readonly feedbackRepository: Repository<Feedback>,
  ) {}

  /**
   * Find All Feedbacks
   *
   * Retrieves all feedback records from database with optional inclusion of soft-deleted records.
   *
   * @param {boolean} includeDeleted - Whether to include soft-deleted feedbacks (default: false)
   * @returns {Promise<Feedback[]>} Array of all feedback entities
   */
  async findAllFeedbacks(includeDeleted: boolean = false): Promise<Feedback[]> {
    return this.feedbackRepository.find({
      withDeleted: includeDeleted,
    });
  }

  /**
   * Find Feedback by ID
   *
   * Retrieves a single feedback by its UUID.
   * Excludes soft-deleted feedbacks by default.
   *
   * @param {string} id - Feedback UUID
   * @returns {Promise<Feedback | null>} Feedback entity or null if not found
   */
  async findFeedbackById(id: string): Promise<Feedback | null> {
    return this.feedbackRepository.findOne({
      where: { _id: id },
    });
  }

  /**
   * Find Feedback by ID
   *
   * Retrieves a single feedback by its UUID.
   * Excludes soft-deleted feedbacks by default.
   *
   * @param {string} id - Feedback UUID
   * @returns {Promise<Feedback | null>} Feedback entity or null if not found
   */
  async findFeedbacksById(clinicId: string): Promise<Feedback[]> {
    return this.feedbackRepository.find({
      where: { clinicId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find Feedbacks by Clinic ID
   *
   * Retrieves all feedbacks for a specific clinic.
   *
   * @param {string} clinicId - Clinic UUID
   * @returns {Promise<Feedback[]>} Array of feedback entities
   */
  async findFeedbacksByClinicId(clinicId: string): Promise<Feedback[]> {
    return this.feedbackRepository.find({
      where: { clinicId },
      relations: ['doctor', 'doctor.doctorInformation'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find Feedbacks by Clinic ID and Date Range
   *
   * Retrieves all feedbacks for a specific clinic within a date range.
   *
   * @param {string} clinicId - Clinic UUID
   * @param {Date} startDate - Start date (inclusive)
   * @param {Date} endDate - End date (inclusive)
   * @returns {Promise<Feedback[]>} Array of feedback entities
   */
  async findFeedbacksByClinicIdAndDateRange(
    clinicId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Feedback[]> {
    return this.feedbackRepository.find({
      where: {
        clinicId,
        createdAt: Between(startDate, endDate),
      },
      relations: ['doctor', 'doctor.doctorInformation'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find Feedbacks by Doctor ID
   *
   * Retrieves all feedbacks for a specific doctor.
   *
   * @param {string} doctorId - Doctor UUID
   * @returns {Promise<Feedback[]>} Array of feedback entities
   */
  async findFeedbacksByDoctorId(doctorId: string): Promise<Feedback[]> {
    return this.feedbackRepository.find({
      where: { doctorId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Create Feedback Entity
   *
   * Creates a Feedback entity instance without persisting to database.
   * Use saveFeedback() to persist created entity.
   *
   * @param {DeepPartial<Feedback>} data - Feedback data (partial object)
   * @returns {Feedback} Unpersisted Feedback entity instance
   */
  createFeedback(data: DeepPartial<Feedback>): Feedback {
    return this.feedbackRepository.create(data);
  }

  /**
   * Save Feedback Entity
   *
   * Persists a Feedback entity to database.
   * Performs INSERT for new entities, UPDATE for existing entities.
   *
   * @param {Feedback} feedback - Feedback entity to save
   * @returns {Promise<Feedback>} Saved Feedback entity with updated fields
   */
  async saveFeedback(feedback: Feedback): Promise<Feedback> {
    return this.feedbackRepository.save(feedback);
  }

  /**
   * Save Multiple Feedback Entities
   *
   * Bulk save multiple feedback entities to database.
   *
   * @param {Feedback[]} feedbacks - Array of Feedback entities to save
   * @returns {Promise<Feedback[]>} Array of saved Feedback entities
   */
  async saveFeedbacks(feedbacks: Feedback[]): Promise<Feedback[]> {
    return this.feedbackRepository.save(feedbacks);
  }

  /**
   * Soft Delete Feedback
   *
   * Marks a feedback as deleted by setting deletedAt timestamp.
   *
   * @param {string} id - Feedback UUID to soft delete
   * @returns {Promise<void>} No return value
   */
  async softDeleteFeedback(id: string): Promise<void> {
    await this.feedbackRepository.softDelete(id);
  }

  /**
   * Hard Delete Feedback
   *
   * Permanently removes a feedback from database.
   *
   * @param {string} id - Feedback UUID to permanently delete
   * @returns {Promise<number>} Number of affected rows
   */
  async deleteFeedback(id: string): Promise<number> {
    const result = await this.feedbackRepository.delete(id);
    return result.affected || 0;
  }

  /**
   * Count All Feedbacks
   *
   * Returns the total count of feedback records in the database.
   *
   * @returns {Promise<number>} Number of feedback records
   *
   * @example
   * ```typescript
   * const count = await repository.countFeedbacks();
   * ```
   */
  async countFeedbacks(): Promise<number> {
    return this.feedbackRepository.count();
  }

  /**
   * Create Query Builder for complex queries
   */
  createQueryBuilder(alias?: string) {
    return this.feedbackRepository.createQueryBuilder(alias);
  }
}
