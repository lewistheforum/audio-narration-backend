import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { ClinicService } from '../entities/clinic-service.entity';

/**
 * ClinicService Repository
 *
 * Data access layer for ClinicService entity.
 * Implements the Repository Pattern to separate data access logic from business logic.
 *
 * @class ClinicServiceRepository
 * @injectable
 */
@Injectable()
export class ClinicServiceRepository {
  constructor(
    @InjectRepository(ClinicService)
    private readonly clinicServiceRepository: Repository<ClinicService>,
  ) { }

  /**
   * Find All Clinic Services
   *
   * Retrieves all clinic service records from the database.
   *
   * @returns {Promise<ClinicService[]>} Array of all service entities
   */
  async findAll(): Promise<ClinicService[]> {
    return this.clinicServiceRepository.find();
  }

  /**
   * Find Clinic Service by Service Code
   *
   * Retrieves a single service by its service code.
   *
   * @param {string} serviceCode - Service code
   * @returns {Promise<ClinicService | null>} Service entity or null if not found
   */
  async findByServiceCode(serviceCode: string): Promise<ClinicService | null> {
    return this.clinicServiceRepository.findOne({
      where: { serviceCode },
    });
  }

  /**
   * Find Clinic Service by ID
   *
   * Retrieves a single service by its ID.
   *
   * @param {string} id - Service ID
   * @returns {Promise<ClinicService | null>} Service entity or null if not found
   */
  async findById(id: string): Promise<ClinicService | null> {
    return this.clinicServiceRepository.findOne({
      where: { _id: id },
    });
  }

  /**
   * Find Clinic Services by Category ID
   *
   * Retrieves all services belonging to a specific category.
   *
   * @param {string} categoryId - Category ID
   * @returns {Promise<ClinicService[]>} Array of service entities
   */
  async findByCategoryId(categoryId: string): Promise<ClinicService[]> {
    return this.clinicServiceRepository.find({
      where: { categoryId },
    });
  }

  /**
   * Create Clinic Service Entity
   *
   * Creates a ClinicService entity instance without persisting to database.
   *
   * @param {DeepPartial<ClinicService>} data - Service data (partial object)
   * @returns {ClinicService} Unpersisted ClinicService entity instance
   */
  create(data: DeepPartial<ClinicService>): ClinicService {
    return this.clinicServiceRepository.create(data);
  }

  /**
   * Save Clinic Service Entity
   *
   * Persists a ClinicService entity to the database.
   *
   * @param {ClinicService} service - Service entity to save
   * @returns {Promise<ClinicService>} Saved ClinicService entity with updated fields
   */
  async save(service: ClinicService): Promise<ClinicService> {
    return this.clinicServiceRepository.save(service);
  }

  /**
   * Count All Services
   *
   * Returns the total number of services.
   *
   * @returns {Promise<number>} Number of services
   */
  async count(): Promise<number> {
    return this.clinicServiceRepository.count();
  }
}
