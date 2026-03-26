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

  /**
   * Update Status by Service IDs
   *
   * Updates the isActive status for all configs associated with the given service IDs.
   *
   * @param {string[]} serviceIds - Array of Service IDs
   * @param {boolean} isActive - New status
   * @returns {Promise<void>}
   */
  async updateStatusByServiceIds(
    serviceIds: string[],
    isActive: boolean,
  ): Promise<void> {
    if (serviceIds.length === 0) return;

    await this.clinicServiceConfigRepository
      .createQueryBuilder()
      .update(ClinicServiceConfig)
      .set({ isActive })
      .where('service_id = ANY(:serviceIds)', { serviceIds })
      .execute();
  }

  /**
   * Find Clinics By Category ID
   *
   * Retrieves a list of clinics and their branches that are using services from a specific category.
   *
   * @param {string} categoryId - Category ID
   * @returns {Promise<any[]>} List of clinics with details
   */
  async findClinicsByCategoryId(categoryId: string): Promise<any[]> {
    return this.clinicServiceConfigRepository.query(
      `
      SELECT 
          DISTINCT
          CASE 
              WHEN admin_info.clinic_name IS NOT NULL THEN admin_info.clinic_name
              WHEN parent_admin_info.clinic_name IS NOT NULL THEN parent_admin_info.clinic_name
              ELSE COALESCE(admin_info.clinic_name, parent_admin_info.clinic_name)
          END AS "clinicName",
          CASE 
              WHEN manager_info.clinic_branch_name IS NOT NULL THEN manager_info.clinic_branch_name
              ELSE 'Main Headquarters'
          END AS "branchName",
          cs.service_name AS "serviceName",
          cs.service_code AS "serviceCode",
          csc.category_name AS "categoryName",
          a.email as "contactEmail"
      FROM clinic_service_config csc2
      JOIN clinic_services cs ON cs._id = csc2.service_id
      JOIN clinic_service_category csc ON csc._id = cs.category_id
      JOIN accounts a ON a._id = csc2.clinic_id
      LEFT JOIN clinic_admin_information admin_info ON admin_info.account_id = a._id
      LEFT JOIN clinic_manager_information manager_info ON manager_info.account_id = a._id
      LEFT JOIN accounts parent_acc ON parent_acc._id = a.parent_id
      LEFT JOIN clinic_admin_information parent_admin_info ON parent_admin_info.account_id = parent_acc._id
      WHERE csc._id = $1
      ORDER BY "clinicName", "branchName"
      `,
      [categoryId],
    );
  }
}
