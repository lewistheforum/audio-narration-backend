import { Injectable, Logger } from '@nestjs/common';
import { ClinicServiceCategory } from '../../modules/clinic-services/entities/clinic-service-category.entity';
import { ClinicServiceCategoryRepository } from '../../modules/clinic-services/repositories/clinic-service-category.repository';
import { ServiceCategoryType } from '../../modules/clinic-services/enums';

/**
 * ClinicServiceCategory Seeder Service
 *
 * Seeds clinic service category records.
 *
 * Seeding Rules:
 * - Creates 6 categories for each ServiceCategoryType enum value
 * - Must be idempotent (re-run safe)
 *
 * Idempotent: Uses check-then-insert pattern by count
 */
@Injectable()
export class ClinicServiceCategorySeederService {
  private readonly logger = new Logger(ClinicServiceCategorySeederService.name);

  constructor(
    private readonly clinicServiceCategoryRepository: ClinicServiceCategoryRepository,
  ) {}

  /**
   * Seed clinic service categories
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
   */
  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed clinic service categories...');

      // Check if categories already exist
      const existingCount = await this.clinicServiceCategoryRepository.count();
      if (existingCount >= 6) {
        this.logger.log(
          `Clinic service categories already exist (${existingCount}). Skipping seeding.`,
        );
        return;
      }

      this.logger.log('Seeding 6 clinic service categories...');

      // Create category records for each ServiceCategoryType
      const categories: ClinicServiceCategory[] = [
        this.clinicServiceCategoryRepository.create({
          categoryName: 'General Consultation',
          type: ServiceCategoryType.CONSULTATION,
          isActive: true,
        }),
        this.clinicServiceCategoryRepository.create({
          categoryName: 'Ultrasound',
          type: ServiceCategoryType.ULTRASOUND,
          isActive: true,
        }),
        this.clinicServiceCategoryRepository.create({
          categoryName: 'X-Ray',
          type: ServiceCategoryType.XRAY,
          isActive: true,
        }),
        this.clinicServiceCategoryRepository.create({
          categoryName: 'Lab Tests',
          type: ServiceCategoryType.LAB,
          isActive: true,
        }),
        this.clinicServiceCategoryRepository.create({
          categoryName: 'Bone Density',
          type: ServiceCategoryType.BONE_DENSITY,
          isActive: true,
        }),
        this.clinicServiceCategoryRepository.create({
          categoryName: 'Medical Procedures',
          type: ServiceCategoryType.PROCEDURE,
          isActive: true,
        }),
      ];

      // Save all categories
      for (const category of categories) {
        await this.clinicServiceCategoryRepository.save(category);
      }

      this.logger.log(`✅ Created ${categories.length} clinic service categories`);
    } catch (error) {
      this.logger.error('Failed to seed clinic service categories', error.stack);
      throw error;
    }
  }
}
