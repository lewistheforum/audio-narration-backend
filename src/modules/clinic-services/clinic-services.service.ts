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
import { DataSource } from 'typeorm';
import { ClinicServiceResponseDto } from './dto/clinic-service-response.dto';
import { CreateClinicServiceDto } from './dto/create-clinic-service.dto';
import { UpdateClinicServiceDto } from './dto/update-clinic-service.dto';
import { ClinicService } from './entities/clinic-service.entity';
import { ClinicServiceConfig } from '../service-configs/entities/clinic-service-config.entity';

@Injectable()
export class ClinicServicesService {
  constructor(
    private readonly clinicServiceRepository: ClinicServiceRepository,
    private readonly clinicServiceCategoryRepository: ClinicServiceCategoryRepository,
    private readonly clinicServiceConfigRepository: ClinicServiceConfigRepository,
    private readonly dataSource: DataSource,
  ) { }

  // --- MANAGER CRUD OPERATIONS ---

  async getServicesByManager(clinicManagerId: string): Promise<ClinicServiceResponseDto[]> {
    const rawData = await this.dataSource.createQueryBuilder()
      .select([
        'cs._id as "_id"',
        'cs.category_id as "categoryId"',
        'cs.service_name as "serviceName"',
        'cs.service_code as "serviceCode"',
        'cs.description as "description"',
        'cs.service_functions as "serviceFunctions"',
        'cs.is_active as "isActive"',
        'csc.price as "price"',
        'csc.discount as "discount"',
        'csc.duration_min as "durationMin"',
        'csc.note_for_patient as "noteForPatient"',
      ])
      .from('clinic_services', 'cs')
      .innerJoin('clinic_service_config', 'csc', 'csc.service_id = cs._id')
      .where('csc.clinic_id = :clinicManagerId', { clinicManagerId })
      .andWhere('cs.deleted_at IS NULL')
      .andWhere('csc.deleted_at IS NULL')
      .getRawMany();

    return rawData.map(raw => {
      // Create a plain object matching the response DTO structure
      const response = new ClinicServiceResponseDto({
        _id: raw._id,
        categoryId: raw.categoryId,
        serviceName: raw.serviceName,
        serviceCode: raw.serviceCode,
        description: raw.description,
        serviceFunctions: typeof raw.serviceFunctions === 'string'
          ? raw.serviceFunctions.replace(/^{|}$/g, '').split(',') // parse postgres array string if needed
          : raw.serviceFunctions,
        isActive: raw.isActive,
      } as any, {
        price: raw.price,
        discount: raw.discount,
        durationMin: raw.durationMin,
        noteForPatient: raw.noteForPatient,
      } as any);
      return response;
    });
  }

  async getServiceDetail(clinicManagerId: string, id: string): Promise<ClinicServiceResponseDto> {
    const service = await this.clinicServiceRepository.findById(id);
    if (!service) {
      throw new NotFoundException(`Service with ID ${id} not found.`);
    }

    const config = await this.clinicServiceConfigRepository.findByClinicAndService(clinicManagerId, id);
    if (!config) {
      throw new NotFoundException(`Config for service ${id} not found for this clinic.`);
    }

    return new ClinicServiceResponseDto(service, config);
  }

  async createService(clinicManagerId: string, dto: CreateClinicServiceDto): Promise<ClinicServiceResponseDto> {
    const category = await this.clinicServiceCategoryRepository.findById(dto.categoryId);
    if (!category) {
      throw new NotFoundException(`Category with ID ${dto.categoryId} not found.`);
    }

    const existingCode = await this.clinicServiceRepository.findByServiceCode(dto.serviceCode);
    if (existingCode) {
      throw new BadRequestException(`Service with code ${dto.serviceCode} already exists.`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Create Clinic Service (Master data)
      const service = new ClinicService();
      service.categoryId = dto.categoryId;
      service.serviceName = dto.serviceName;
      service.serviceCode = dto.serviceCode;
      service.description = dto.description;
      service.serviceFunctions = dto.serviceFunctions;
      service.isActive = true;

      const savedService = await queryRunner.manager.save(ClinicService, service);

      // 2. Create Clinic Service Config for the manager
      const config = new ClinicServiceConfig();
      config.serviceId = savedService._id;
      config.clinicId = clinicManagerId;
      config.price = dto.price;
      config.discount = dto.discount || 0;
      config.durationMin = dto.durationMin;
      config.noteForPatient = dto.noteForPatient;
      config.isActive = true;

      const savedConfig = await queryRunner.manager.save(ClinicServiceConfig, config);

      await queryRunner.commitTransaction();

      return new ClinicServiceResponseDto(savedService, savedConfig);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async updateService(clinicManagerId: string, id: string, dto: UpdateClinicServiceDto): Promise<ClinicServiceResponseDto> {
    const service = await this.clinicServiceRepository.findById(id);
    if (!service) {
      throw new NotFoundException(`Service with ID ${id} not found.`);
    }

    const config = await this.clinicServiceConfigRepository.findByClinicAndService(clinicManagerId, id);
    if (!config) {
      throw new NotFoundException(`Config for Service ID ${id} not found for this clinic.`);
    }

    // Check if new code conflicts
    if (dto.serviceCode && dto.serviceCode !== service.serviceCode) {
      const existingCode = await this.clinicServiceRepository.findByServiceCode(dto.serviceCode);
      if (existingCode) {
        throw new BadRequestException(`Service with code ${dto.serviceCode} already exists.`);
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update Service
      if (dto.categoryId !== undefined) service.categoryId = dto.categoryId;
      if (dto.serviceName !== undefined) service.serviceName = dto.serviceName;
      if (dto.serviceCode !== undefined) service.serviceCode = dto.serviceCode;
      if (dto.description !== undefined) service.description = dto.description;
      if (dto.serviceFunctions !== undefined) service.serviceFunctions = dto.serviceFunctions;

      const savedService = await queryRunner.manager.save(ClinicService, service);

      // Update Config
      if (dto.price !== undefined) config.price = dto.price;
      if (dto.discount !== undefined) config.discount = dto.discount;
      if (dto.durationMin !== undefined) config.durationMin = dto.durationMin;
      if (dto.noteForPatient !== undefined) config.noteForPatient = dto.noteForPatient;

      const savedConfig = await queryRunner.manager.save(ClinicServiceConfig, config);

      await queryRunner.commitTransaction();

      return new ClinicServiceResponseDto(savedService, savedConfig);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async toggleServiceStatus(clinicManagerId: string, id: string, isActive: boolean): Promise<ClinicServiceResponseDto> {
    const service = await this.clinicServiceRepository.findById(id);
    if (!service) {
      throw new NotFoundException(`Service with ID ${id} not found.`);
    }

    const config = await this.clinicServiceConfigRepository.findByClinicAndService(clinicManagerId, id);
    if (!config) {
      throw new NotFoundException(`Config for Service ID ${id} not found for this clinic.`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      service.isActive = isActive;
      const savedService = await queryRunner.manager.save(ClinicService, service);

      config.isActive = isActive;
      const savedConfig = await queryRunner.manager.save(ClinicServiceConfig, config);

      await queryRunner.commitTransaction();

      return new ClinicServiceResponseDto(savedService, savedConfig);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // --- CATEGORY OPERATIONS (ADMIN) ---

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
