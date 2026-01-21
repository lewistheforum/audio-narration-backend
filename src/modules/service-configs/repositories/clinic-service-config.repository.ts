import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { ClinicServiceConfig } from '../entities/clinic-service-config.entity';

/**
 * ClinicServiceConfig Repository
 *
 * Data access layer for ClinicServiceConfig entity.
 * Implements the Repository Pattern to separate data access logic from business logic.
 *
 * @class ClinicServiceConfigRepository
 * @injectable
 */
@Injectable()
export class ClinicServiceConfigRepository {
  constructor(
    @InjectRepository(ClinicServiceConfig)
    private readonly clinicServiceConfigRepository: Repository<ClinicServiceConfig>,
  ) {}

  /**
   * Find All Clinic Service Configs
   *
   * Retrieves all clinic service config records from the database.
   *
   * @returns {Promise<ClinicServiceConfig[]>} Array of all config entities
   */
  async findAll(): Promise<ClinicServiceConfig[]> {
    return this.clinicServiceConfigRepository.find();
  }

  /**
   * Find Clinic Service Config by Clinic and Service
   *
   * Retrieves a single config by its clinic and service IDs.
   *
   * @param {string} clinicId - Clinic ID
   * @param {string} serviceId - Service ID
   * @returns {Promise<ClinicServiceConfig | null>} Config entity or null if not found
   */
  async findByClinicAndService(
    clinicId: string,
    serviceId: string,
  ): Promise<ClinicServiceConfig | null> {
    return this.clinicServiceConfigRepository.findOne({
      where: { clinicId, serviceId },
    });
  }

  /**
   * Find Clinic Service Configs by Clinic ID
   *
   * Retrieves all configs for a specific clinic.
   *
   * @param {string} clinicId - Clinic ID
   * @returns {Promise<ClinicServiceConfig[]>} Array of config entities
   */
  async findByClinicId(clinicId: string): Promise<ClinicServiceConfig[]> {
    return this.clinicServiceConfigRepository.find({
      where: { clinicId },
    });
  }

  /**
   * Create Clinic Service Config Entity
   *
   * Creates a ClinicServiceConfig entity instance without persisting to database.
   *
   * @param {DeepPartial<ClinicServiceConfig>} data - Config data (partial object)
   * @returns {ClinicServiceConfig} Unpersisted ClinicServiceConfig entity instance
   */
  create(data: DeepPartial<ClinicServiceConfig>): ClinicServiceConfig {
    return this.clinicServiceConfigRepository.create(data);
  }

  /**
   * Save Clinic Service Config Entity
   *
   * Persists a ClinicServiceConfig entity to the database.
   *
   * @param {ClinicServiceConfig} config - Config entity to save
   * @returns {Promise<ClinicServiceConfig>} Saved ClinicServiceConfig entity with updated fields
   */
  async save(config: ClinicServiceConfig): Promise<ClinicServiceConfig> {
    return this.clinicServiceConfigRepository.save(config);
  }

  /**
   * Count All Configs
   *
   * Returns the total number of configs.
   *
   * @returns {Promise<number>} Number of configs
   */
  async count(): Promise<number> {
    return this.clinicServiceConfigRepository.count();
  }
}
