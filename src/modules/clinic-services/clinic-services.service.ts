import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateClinicServiceCategoryDto } from './dto/create-clinic-service-category.dto';
import { UpdateClinicServiceCategoryDto } from './dto/update-clinic-service-category.dto';
import { ClinicServiceCategory } from './entities';
import { ClinicServiceCategoryRepository } from './repositories/clinic-service-category.repository';
import { ClinicServiceRepository } from './repositories/clinic-service.repository';
import { ClinicServiceConfigRepository } from '../service-configs/repositories/clinic-service-config.repository';

@Injectable()
export class ClinicServicesService {
  constructor(
    private readonly clinicServiceRepository: ClinicServiceRepository,
    private readonly clinicServiceCategoryRepository: ClinicServiceCategoryRepository,
    private readonly clinicServiceConfigRepository: ClinicServiceConfigRepository,
  ) {}

  async createCategory(
    createClinicServiceCategoryDto: CreateClinicServiceCategoryDto,
  ): Promise<ClinicServiceCategory> {
    const { type, categoryName } = createClinicServiceCategoryDto;

    // Check if category type already exists
    const existingCategory =
      await this.clinicServiceCategoryRepository.findByType(type);
    if (existingCategory) {
      throw new BadRequestException(
        `Category with type ${type} already exists.`,
      );
    }

    const category = this.clinicServiceCategoryRepository.create({
      categoryName,
      type,
    });

    return this.clinicServiceCategoryRepository.save(category);
  }

  async updateCategoryStatus(
    id: string,
    isActive: boolean,
  ): Promise<ClinicServiceCategory> {
    const category = await this.getCategoryById(id);
    category.isActive = isActive;
    await this.clinicServiceCategoryRepository.save(category);

    // 1. Find all services in this category
    const services = await this.clinicServiceRepository.findByCategoryId(id);
    const serviceIds = services.map((service) => service._id);

    if (serviceIds.length > 0) {
      // 2. Update status of all services in this category
      await this.clinicServiceRepository.updateStatusByCategoryId(id, isActive);

      // 3. Update status of all service configs related to these services
      await this.clinicServiceConfigRepository.updateStatusByServiceIds(
        serviceIds,
        isActive,
      );
    }

    return category;
  }

  async getAllCategories(): Promise<ClinicServiceCategory[]> {
    return this.clinicServiceCategoryRepository.findAll();
  }

  async getCategoryById(id: string): Promise<ClinicServiceCategory> {
    const category = await this.clinicServiceCategoryRepository.findById(id);
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found.`);
    }
    return category;
  }

  async updateCategory(
    id: string,
    updateClinicServiceCategoryDto: UpdateClinicServiceCategoryDto,
  ): Promise<ClinicServiceCategory> {
    const category = await this.getCategoryById(id);
    const { type } = updateClinicServiceCategoryDto;

    if (type && type !== category.type) {
      const existingCategory =
        await this.clinicServiceCategoryRepository.findByType(type);
      if (existingCategory) {
        throw new BadRequestException(
          `Category with type ${type} already exists.`,
        );
      }
    }

    Object.assign(category, updateClinicServiceCategoryDto);
    return this.clinicServiceCategoryRepository.save(category);
  }

  async deleteCategory(id: string): Promise<void> {
    const category = await this.getCategoryById(id);
    await this.clinicServiceCategoryRepository.softDelete(category._id);
  }

  // async countClinicsUsingCategory(id: string): Promise<number> {
  //   const services = await this.clinicServiceRepository.findByCategoryId(id);
  //   const serviceIds = services.map((service) => service._id);
  //   return this.clinicServiceConfigRepository.countDistinctClinicsByServiceIds(
  //     serviceIds,
  //   );
  // }

  async getClinicsUsingCategory(categoryId: string): Promise<any[]> {
    return this.clinicServiceConfigRepository.findClinicsByCategoryId(
      categoryId,
    );
  }
}
