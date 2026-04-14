import { Injectable, Logger } from '@nestjs/common';
import { ClinicServiceConfig } from '../../modules/service-configs/entities/clinic-service-config.entity';
import { ClinicServiceConfigRepository } from '../../modules/service-configs/repositories/clinic-service-config.repository';
import { ClinicServiceRepository } from '../../modules/clinic-services/repositories/clinic-service.repository';
import { ClinicServiceCategoryRepository } from '../../modules/clinic-services/repositories/clinic-service-category.repository';
import { ClinicSubscriptionRepository } from '../../modules/subscriptions/repositories/clinic-subscription.repository';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { AccountRole } from '../../modules/accounts/enums';
import { ServiceCategoryType } from '../../modules/clinic-services/enums';
import { SERVICE_NOTES } from '../constants/medical-terms';

const TARGET_CLINIC_MANAGER_EMAIL = 'clinic_manager_1_1@medicare.test';

/**
 * ClinicServiceConfig Seeder Service
 *
 * Seeds clinic service config records linking clinics to services.
 *
 * Seeding Rules:
 * - Gets all CLINIC_MANAGER accounts
 * - Gets all clinic services
 * - For each clinic, generates configs linking to a subset of services
 * - Must be idempotent (re-run safe)
 *
 * Idempotent: Uses check-then-insert pattern by checking existing config
 */
@Injectable()
export class ClinicServiceConfigSeederService {
  private readonly logger = new Logger(ClinicServiceConfigSeederService.name);

  constructor(
    private readonly clinicServiceConfigRepository: ClinicServiceConfigRepository,
    private readonly clinicServiceRepository: ClinicServiceRepository,
    private readonly clinicServiceCategoryRepository: ClinicServiceCategoryRepository,
    private readonly accountRepository: AccountRepository,
    private readonly clinicSubscriptionRepository: ClinicSubscriptionRepository,
  ) {}

  /**
   * Seed clinic service configs
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
   */
  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed clinic service configs...');

      // Check active subscriptions to filter clinics
      const activeClinicIds =
        await this.clinicSubscriptionRepository.findActiveClinicIds();

      // Get all CLINIC_MANAGER accounts
      const allAccounts = await this.accountRepository.findAllAccounts();
      const clinicManagers = allAccounts.filter(
        (account) =>
          account.role === AccountRole.CLINIC_MANAGER &&
          activeClinicIds.includes(account.parentId),
      );

      if (clinicManagers.length === 0) {
        this.logger.log('No CLINIC_MANAGER accounts found. Skipping seeding.');
        return;
      }

      // Get all clinic services
      const services = await this.clinicServiceRepository.findAll();

      if (services.length === 0) {
        this.logger.log('No clinic services found. Skipping seeding.');
        return;
      }

      // Get all categories for mapping
      const categories = await this.clinicServiceCategoryRepository.findAll();
      const categoryMap = new Map<string, string>();
      for (const cat of categories) {
        categoryMap.set(cat.type, cat._id);
      }

      this.logger.log(
        `Found ${clinicManagers.length} clinics and ${services.length} services`,
      );

      let configsCreated = 0;

      // For each clinic manager, create configs for a subset of services
      for (const clinic of clinicManagers) {
        const clinicId = clinic._id;
        const isTargetClinic = clinic.email === TARGET_CLINIC_MANAGER_EMAIL;

        if (isTargetClinic) {
          // Special handling for target clinic: ensure ALL categories are covered
          configsCreated += await this.seedTargetClinic(
            clinicId,
            services,
            categoryMap,
          );
        } else {
          // Standard random seeding for other clinics
          const servicesForClinic = services.slice(0, 8);

          for (const service of servicesForClinic) {
            const serviceId = service._id;

            const existingConfig =
              await this.clinicServiceConfigRepository.findByClinicAndService(
                clinicId,
                serviceId,
              );

            if (existingConfig) {
              continue;
            }

            const price = this.generatePrice(service.serviceCode);
            const discount = this.generateDiscount();
            const durationMin = this.generateDuration(service.serviceCode);
            const noteForPatient = this.generateNote(service.serviceCode);

            const config = this.clinicServiceConfigRepository.create({
              serviceId,
              clinicId,
              price,
              discount,
              durationMin,
              noteForPatient,
              isActive: true,
            });

            await this.clinicServiceConfigRepository.save(config);
            configsCreated++;
          }
        }
      }

      this.logger.log(`✅ Created ${configsCreated} clinic service configs`);
    } catch (error) {
      this.logger.error('Failed to seed clinic service configs', error.stack);
      throw error;
    }
  }

  /**
   * Seed target clinic with comprehensive coverage of all ERM categories
   */
  private async seedTargetClinic(
    clinicId: string,
    services: any[],
    categoryMap: Map<string, string>,
  ): Promise<number> {
    this.logger.log(
      `Seeding target clinic ${TARGET_CLINIC_MANAGER_EMAIL} with full category coverage`,
    );

    let created = 0;
    const allCategoryTypes = Object.values(ServiceCategoryType);
    const servicesByCategory = new Map<string, any[]>();

    for (const catType of allCategoryTypes) {
      const categoryId = categoryMap.get(catType);
      if (categoryId) {
        const catServices = services.filter(
          (s) => (s as any).categoryId === categoryId,
        );
        servicesByCategory.set(catType, catServices);
      }
    }

    const discountVariations = [0, 5, 10, 15, 20];
    let discountIndex = 0;

    for (const categoryType of allCategoryTypes) {
      const catServices = servicesByCategory.get(categoryType);
      if (!catServices || catServices.length === 0) {
        this.logger.warn(`No services found for category ${categoryType}`);
        continue;
      }

      const service = catServices[0];
      const serviceId = service._id;

      const existingConfig =
        await this.clinicServiceConfigRepository.findByClinicAndService(
          clinicId,
          serviceId,
        );

      if (existingConfig) {
        this.logger.log(
          `Config already exists for ${categoryType}, skipping`,
        );
        continue;
      }

      const discount = discountVariations[discountIndex % discountVariations.length];
      discountIndex++;

      const price = this.generatePrice(service.serviceCode);
      const durationMin = this.generateDuration(service.serviceCode);
      const noteForPatient = this.generateNote(service.serviceCode);

      const config = this.clinicServiceConfigRepository.create({
        serviceId,
        clinicId,
        price,
        discount,
        durationMin,
        noteForPatient,
        isActive: true,
      });

      await this.clinicServiceConfigRepository.save(config);
      created++;

      this.logger.log(
        `✅ Created ${categoryType} service: ${service.serviceName} (discount: ${discount}%)`,
      );
    }

    return created;
  }

  /**
   * Generate price based on service code
   */
  private generatePrice(serviceCode: string): number {
    const basePrice = 1000;
    const multiplier = (serviceCode.length % 5) + 1; // 1-5
    return basePrice * multiplier;
  }

  /**
   * Generate discount (0-20%)
   */
  private generateDiscount(): number {
    const discount = Math.floor(Math.random() * 21); // 0-20
    return discount;
  }

  /**
   * Generate duration based on service code
   */
  private generateDuration(serviceCode: string): number {
    if (serviceCode.includes('CONSULTATION')) {
      return 30;
    } else if (serviceCode.includes('ULTRASOUND')) {
      return 20;
    } else if (serviceCode.includes('XRAY')) {
      return 15;
    } else if (serviceCode.includes('LAB')) {
      return 10;
    } else if (serviceCode.includes('BONE_DENSITY')) {
      return 30;
    } else if (serviceCode.includes('PROCEDURE')) {
      return 15;
    }
    return 30; // default
  }

  /**
   * Generate note for patient based on service code
   */
  private generateNote(serviceCode: string): string {
    if (serviceCode.includes('CONSULTATION')) {
      return SERVICE_NOTES.CONSULTATION;
    } else if (serviceCode.includes('ULTRASOUND')) {
      return SERVICE_NOTES.ULTRASOUND;
    } else if (serviceCode.includes('XRAY')) {
      return SERVICE_NOTES.XRAY;
    } else if (serviceCode.includes('LAB')) {
      return SERVICE_NOTES.LAB;
    } else if (serviceCode.includes('BONE_DENSITY')) {
      return SERVICE_NOTES.BONE_DENSITY;
    } else if (serviceCode.includes('PROCEDURE')) {
      return SERVICE_NOTES.PROCEDURE;
    }
    return 'Please follow the doctor instructions';
  }
}
