import { Injectable, Logger } from '@nestjs/common';
import { ClinicService } from '../../modules/clinic-services/entities/clinic-service.entity';
import { ClinicServiceRepository } from '../../modules/clinic-services/repositories/clinic-service.repository';
import { ClinicServiceCategoryRepository } from '../../modules/clinic-services/repositories/clinic-service-category.repository';
import { ServiceCategoryType } from '../../modules/clinic-services/enums';
import { SERVICE_NAMES } from '../constants/medical-terms';

/**
 * ClinicService Seeder Service
 *
 * Seeds clinic service records.
 *
 * Seeding Rules:
 * - Creates services for each category
 * - Must be idempotent (re-run safe)
 *
 * Idempotent: Uses check-then-insert pattern by count
 */
@Injectable()
export class ClinicServiceSeederService {
  private readonly logger = new Logger(ClinicServiceSeederService.name);

  constructor(
    private readonly clinicServiceRepository: ClinicServiceRepository,
    private readonly clinicServiceCategoryRepository: ClinicServiceCategoryRepository,
  ) {}

  /**
   * Seed clinic services
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
   */
  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed clinic services...');

      // Check if services already exist
      const existingCount = await this.clinicServiceRepository.count();
      if (existingCount >= 12) {
        this.logger.log(
          `Clinic services already exist (${existingCount}). Skipping seeding.`,
        );
        return;
      }

      this.logger.log('Seeding clinic services...');

      // Get all categories
      const categories = await this.clinicServiceCategoryRepository.findAll();
      const categoryMap = new Map<string, string>();
      for (const category of categories) {
        categoryMap.set(category.type, category._id);
      }

      // Create service records for each category
      const services: ClinicService[] = [];

      // CONSULTATION services
      const consultationCategoryId = categoryMap.get(ServiceCategoryType.CONSULTATION);
      if (consultationCategoryId) {
        services.push(
          this.clinicServiceRepository.create({
            categoryId: consultationCategoryId,
            serviceName: SERVICE_NAMES.CONSULTATION_GENERAL.name,
            serviceCode: SERVICE_NAMES.CONSULTATION_GENERAL.code,
            description: SERVICE_NAMES.CONSULTATION_GENERAL.description,
            serviceFunctions: SERVICE_NAMES.CONSULTATION_GENERAL.functions,
            isActive: true,
          }),
          this.clinicServiceRepository.create({
            categoryId: consultationCategoryId,
            serviceName: SERVICE_NAMES.CONSULTATION_ENT.name,
            serviceCode: SERVICE_NAMES.CONSULTATION_ENT.code,
            description: SERVICE_NAMES.CONSULTATION_ENT.description,
            serviceFunctions: SERVICE_NAMES.CONSULTATION_ENT.functions,
            isActive: true,
          }),
        );
      }

      // ULTRASOUND services
      const ultrasoundCategoryId = categoryMap.get(ServiceCategoryType.ULTRASOUND);
      if (ultrasoundCategoryId) {
        services.push(
          this.clinicServiceRepository.create({
            categoryId: ultrasoundCategoryId,
            serviceName: SERVICE_NAMES.ULTRASOUND_ABDOMINAL.name,
            serviceCode: SERVICE_NAMES.ULTRASOUND_ABDOMINAL.code,
            description: SERVICE_NAMES.ULTRASOUND_ABDOMINAL.description,
            serviceFunctions: SERVICE_NAMES.ULTRASOUND_ABDOMINAL.functions,
            isActive: true,
          }),
          this.clinicServiceRepository.create({
            categoryId: ultrasoundCategoryId,
            serviceName: SERVICE_NAMES.ULTRASOUND_OBSTETRIC.name,
            serviceCode: SERVICE_NAMES.ULTRASOUND_OBSTETRIC.code,
            description: SERVICE_NAMES.ULTRASOUND_OBSTETRIC.description,
            serviceFunctions: SERVICE_NAMES.ULTRASOUND_OBSTETRIC.functions,
            isActive: true,
          }),
        );
      }

      // XRAY services
      const xrayCategoryId = categoryMap.get(ServiceCategoryType.XRAY);
      if (xrayCategoryId) {
        services.push(
          this.clinicServiceRepository.create({
            categoryId: xrayCategoryId,
            serviceName: SERVICE_NAMES.XRAY_CHEST.name,
            serviceCode: SERVICE_NAMES.XRAY_CHEST.code,
            description: SERVICE_NAMES.XRAY_CHEST.description,
            serviceFunctions: SERVICE_NAMES.XRAY_CHEST.functions,
            isActive: true,
          }),
          this.clinicServiceRepository.create({
            categoryId: xrayCategoryId,
            serviceName: SERVICE_NAMES.XRAY_LIMB.name,
            serviceCode: SERVICE_NAMES.XRAY_LIMB.code,
            description: SERVICE_NAMES.XRAY_LIMB.description,
            serviceFunctions: SERVICE_NAMES.XRAY_LIMB.functions,
            isActive: true,
          }),
        );
      }

      // LAB services
      const labCategoryId = categoryMap.get(ServiceCategoryType.LAB);
      if (labCategoryId) {
        services.push(
          this.clinicServiceRepository.create({
            categoryId: labCategoryId,
            serviceName: SERVICE_NAMES.LAB_CBC.name,
            serviceCode: SERVICE_NAMES.LAB_CBC.code,
            description: SERVICE_NAMES.LAB_CBC.description,
            serviceFunctions: SERVICE_NAMES.LAB_CBC.functions,
            isActive: true,
          }),
          this.clinicServiceRepository.create({
            categoryId: labCategoryId,
            serviceName: SERVICE_NAMES.LAB_GLUCOSE.name,
            serviceCode: SERVICE_NAMES.LAB_GLUCOSE.code,
            description: SERVICE_NAMES.LAB_GLUCOSE.description,
            serviceFunctions: SERVICE_NAMES.LAB_GLUCOSE.functions,
            isActive: true,
          }),
        );
      }

      // BONE_DENSITY services
      const boneDensityCategoryId = categoryMap.get(ServiceCategoryType.BONE_DENSITY);
      if (boneDensityCategoryId) {
        services.push(
          this.clinicServiceRepository.create({
            categoryId: boneDensityCategoryId,
            serviceName: SERVICE_NAMES.BONE_DENSITY_DEXA.name,
            serviceCode: SERVICE_NAMES.BONE_DENSITY_DEXA.code,
            description: SERVICE_NAMES.BONE_DENSITY_DEXA.description,
            serviceFunctions: SERVICE_NAMES.BONE_DENSITY_DEXA.functions,
            isActive: true,
          }),
        );
      }

      // PROCEDURE services
      const procedureCategoryId = categoryMap.get(ServiceCategoryType.PROCEDURE);
      if (procedureCategoryId) {
        services.push(
          this.clinicServiceRepository.create({
            categoryId: procedureCategoryId,
            serviceName: SERVICE_NAMES.PROCEDURE_VACCINE.name,
            serviceCode: SERVICE_NAMES.PROCEDURE_VACCINE.code,
            description: SERVICE_NAMES.PROCEDURE_VACCINE.description,
            serviceFunctions: SERVICE_NAMES.PROCEDURE_VACCINE.functions,
            isActive: true,
          }),
          this.clinicServiceRepository.create({
            categoryId: procedureCategoryId,
            serviceName: SERVICE_NAMES.PROCEDURE_DRESSING.name,
            serviceCode: SERVICE_NAMES.PROCEDURE_DRESSING.code,
            description: SERVICE_NAMES.PROCEDURE_DRESSING.description,
            serviceFunctions: SERVICE_NAMES.PROCEDURE_DRESSING.functions,
            isActive: true,
          }),
          this.clinicServiceRepository.create({
            categoryId: procedureCategoryId,
            serviceName: SERVICE_NAMES.PROCEDURE_BLOOD_DRAW.name,
            serviceCode: SERVICE_NAMES.PROCEDURE_BLOOD_DRAW.code,
            description: SERVICE_NAMES.PROCEDURE_BLOOD_DRAW.description,
            serviceFunctions: SERVICE_NAMES.PROCEDURE_BLOOD_DRAW.functions,
            isActive: true,
          }),
        );
      }

      // Save all services
      for (const service of services) {
        await this.clinicServiceRepository.save(service);
      }

      this.logger.log(`✅ Created ${services.length} clinic services`);
    } catch (error) {
      this.logger.error('Failed to seed clinic services', error.stack);
      throw error;
    }
  }
}
