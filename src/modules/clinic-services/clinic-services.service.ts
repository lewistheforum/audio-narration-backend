import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateClinicServiceCategoryDto } from './dto/create-clinic-service-category.dto';
import { CreateClinicServiceDto } from './dto/create-clinic-service.dto';
import { UpdateClinicServiceDto } from './dto/update-clinic-service.dto';
import { ClinicServiceCategory, ClinicService } from './entities';
import {
    ClinicServiceCategoryRepository,
    ClinicServiceRepository,
} from './repositories';

@Injectable()
export class ClinicServicesService {
    constructor(
        private readonly clinicServiceRepository: ClinicServiceRepository,
        private readonly clinicServiceCategoryRepository: ClinicServiceCategoryRepository,
    ) { }

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

    async createService(
        createClinicServiceDto: CreateClinicServiceDto,
    ): Promise<ClinicService> {
        const { categoryId, serviceCode } = createClinicServiceDto;

        // Check if category exists
        const category = await this.clinicServiceCategoryRepository.findById(categoryId);
        if (!category) {
            throw new NotFoundException(`Category with ID ${categoryId} not found.`);
        }

        // Is serviceCode unique?
        const existingService =
            await this.clinicServiceRepository.findByServiceCode(serviceCode);
        if (existingService) {
            throw new BadRequestException(
                `Service with code ${serviceCode} already exists.`,
            );
        }

        const newService = this.clinicServiceRepository.create({
            ...createClinicServiceDto,
        });

        return this.clinicServiceRepository.save(newService);
    }

    async getServiceById(id: string): Promise<ClinicService> {
        const service = await this.clinicServiceRepository.findById(id);
        if (!service) {
            throw new NotFoundException(`Service with ID ${id} not found.`);
        }
        return service;
    }

    async updateService(
        id: string,
        updateClinicServiceDto: UpdateClinicServiceDto,
    ): Promise<ClinicService> {
        const service = await this.getServiceById(id);
        const { categoryId, serviceCode } = updateClinicServiceDto;

        if (categoryId) {
            const category = await this.clinicServiceCategoryRepository.findById(
                categoryId,
            );
            if (!category) {
                throw new NotFoundException(
                    `Category with ID ${categoryId} not found.`,
                );
            }
        }

        if (serviceCode && serviceCode !== service.serviceCode) {
            const existingService =
                await this.clinicServiceRepository.findByServiceCode(serviceCode);
            if (existingService) {
                throw new BadRequestException(
                    `Service with code ${serviceCode} already exists.`,
                );
            }
        }

        Object.assign(service, updateClinicServiceDto);
        return this.clinicServiceRepository.save(service);
    }

    async updateServiceStatus(id: string, isActive: boolean): Promise<ClinicService> {
        const service = await this.getServiceById(id);
        service.isActive = isActive;
        return this.clinicServiceRepository.save(service);
    }
}
