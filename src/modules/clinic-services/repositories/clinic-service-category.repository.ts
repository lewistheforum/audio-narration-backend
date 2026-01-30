import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { ClinicServiceCategory } from '../entities/clinic-service-category.entity';

/**
 * ClinicServiceCategory Repository
 *
 * Data access layer for ClinicServiceCategory entity.
 * Implements the Repository Pattern to separate data access logic from business logic.
 *
 * @class ClinicServiceCategoryRepository
 * @injectable
 */
@Injectable()
export class ClinicServiceCategoryRepository {
  constructor(
    @InjectRepository(ClinicServiceCategory)
    private readonly clinicServiceCategoryRepository: Repository<ClinicServiceCategory>,
  ) { }

  /**
   * Find All Clinic Service Categories
   *
   * Retrieves all clinic service category records from the database.
   *
   * @returns {Promise<ClinicServiceCategory[]>} Array of all category entities
   */
  async findAll(): Promise<ClinicServiceCategory[]> {
    return this.clinicServiceCategoryRepository.find();
  }

  /**
   * Find Clinic Service Category by Type
   *
   * Retrieves a single category by its type.
   *
   * @param {string} type - Category type
   * @returns {Promise<ClinicServiceCategory | null>} Category entity or null if not found
   */
  async findByType(type: string): Promise<ClinicServiceCategory | null> {
    return this.clinicServiceCategoryRepository.findOne({
      where: { type: type as any },
    });
  }

  /**
   * Find Clinic Service Category by ID
   *
   * Retrieves a single category by its ID.
   *
   * @param {string} id - Category ID
   * @returns {Promise<ClinicServiceCategory | null>} Category entity or null if not found
   */
  async findById(id: string): Promise<ClinicServiceCategory | null> {
    return this.clinicServiceCategoryRepository.findOne({
      where: { _id: id },
    });
  }

  /**
   * Create Clinic Service Category Entity
   *
   * Creates a ClinicServiceCategory entity instance without persisting to database.
   *
   * @param {DeepPartial<ClinicServiceCategory>} data - Category data (partial object)
   * @returns {ClinicServiceCategory} Unpersisted ClinicServiceCategory entity instance
   */
  create(data: DeepPartial<ClinicServiceCategory>): ClinicServiceCategory {
    return this.clinicServiceCategoryRepository.create(data);
  }

  /**
   * Save Clinic Service Category Entity
   *
   * Persists a ClinicServiceCategory entity to the database.
   *
   * @param {ClinicServiceCategory} category - Category entity to save
   * @returns {Promise<ClinicServiceCategory>} Saved ClinicServiceCategory entity with updated fields
   */
  async save(category: ClinicServiceCategory): Promise<ClinicServiceCategory> {
    return this.clinicServiceCategoryRepository.save(category);
  }

  /**
   * Count All Categories
   *
   * Returns the total number of categories.
   *
   * @returns {Promise<number>} Number of categories
   */
  async count(): Promise<number> {
    return this.clinicServiceCategoryRepository.count();
  }
}
