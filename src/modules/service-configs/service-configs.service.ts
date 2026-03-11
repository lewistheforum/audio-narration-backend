import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  ClinicServicesResponseDto,
  ClinicServiceItemDto,
  GetClinicServicesQueryDto,
} from './dto';
import { formatToVietnamTime } from '../../common/utils/date.util';

/**
 * Service Configs Service
 *
 * Business logic for managing clinic service configurations
 */
@Injectable()
export class ServiceConfigsService {
  constructor(private readonly dataSource: DataSource) { }

  /**
   * Get Clinic Services with Pagination
   *
   * Retrieves all active services for a specific clinic with pricing and configuration
   *
   * @param {string} clinicId - Clinic ID from staff JWT or query
   * @param {GetClinicServicesQueryDto} query - Query parameters
   * @returns {Promise<ClinicServicesResponseDto>} Services list with pagination
   */
  async getClinicServices(
    clinicId: string,
    query: GetClinicServicesQueryDto,
  ): Promise<ClinicServicesResponseDto> {
    const { isActive, search, page, limit } = query;
    const skip = (page - 1) * limit;

    // Build query
    const queryBuilder = this.dataSource
      .createQueryBuilder()
      .select([
        'csc._id AS "clinicServiceId"',
        'cs.service_name AS "serviceName"',
        'cs.service_code AS "serviceCode"',
        'cs.description AS "description"',
        'csc.duration_min AS "duration"',
        'csc.price AS "price"',
        'csc.discount AS "discount"',
        'csc.is_active AS "isActive"',
        'csc.note_for_patient AS "noteForPatient"',
        'csc.created_at AS "createdAt"',
        'csc.updated_at AS "updatedAt"',
        'csc_category.category_name AS "categoryName"',
      ])
      .from('clinic_service_config', 'csc')
      .innerJoin('clinic_services', 'cs', 'cs._id = csc.service_id')
      .leftJoin(
        'clinic_service_category',
        'csc_category',
        'csc_category._id = cs.category_id',
      )
      .where('csc.clinic_id = :clinicId', { clinicId })
      .andWhere('csc.deleted_at IS NULL')
      .andWhere('cs.deleted_at IS NULL');

    // Filter by active status
    if (isActive !== undefined) {
      queryBuilder.andWhere('csc.is_active = :isActive', { isActive });
    }

    // Search by service name
    if (search) {
      queryBuilder.andWhere('cs.service_name ILIKE :search', {
        search: `%${search}%`,
      });
    }

    // Order by service name
    queryBuilder.orderBy('cs.service_name', 'ASC');

    // Get total count
    const totalItems = await queryBuilder.getCount();

    // Apply pagination
    queryBuilder.skip(skip).take(limit);

    // Execute query
    const rawServices = await queryBuilder.getRawMany();

    // Transform to DTO
    const services: ClinicServiceItemDto[] = rawServices.map((raw) => {
      const price = parseFloat(raw.price);
      const discount = parseFloat(raw.discount);
      const finalPrice = price - (price * discount) / 100;

      return {
        clinicServiceId: raw.clinicServiceId,
        serviceName: raw.serviceName,
        serviceCode: raw.serviceCode,
        description: raw.description,
        duration: raw.duration,
        price: price,
        discount: discount,
        finalPrice: Math.round(finalPrice),
        isActive: raw.isActive,
        categoryName: raw.categoryName,
        noteForPatient: raw.noteForPatient,
        createdAt: formatToVietnamTime(raw.createdAt),
        updatedAt: formatToVietnamTime(raw.updatedAt),
      };
    });

    // Get clinic info
    const clinicInfo = await this.dataSource
      .createQueryBuilder()
      .select([
        'a._id AS "clinicId"',
        'COALESCE(ga.full_name, a.email) AS "clinicName"',
        'COALESCE(addr.address, \'\') AS "address"',
        'COALESCE(a.phone, \'\') AS "phone"',
      ])
      .from('accounts', 'a')
      .leftJoin('general_accounts', 'ga', 'ga.account_id = a._id AND ga.deleted_at IS NULL')
      .leftJoin('addresses', 'addr', 'addr.account_id = a._id AND addr.deleted_at IS NULL')
      .where('a._id = :clinicId', { clinicId })
      .andWhere('a.deleted_at IS NULL')
      .getRawOne();

    if (!clinicInfo) {
      throw new NotFoundException('Clinic not found');
    }

    // Calculate pagination
    const totalPages = Math.ceil(totalItems / limit);

    return {
      services,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
      },
      clinicInfo: {
        clinicId: clinicInfo.clinicId,
        clinicName: clinicInfo.clinicName,
        address: clinicInfo.address || null,
        phone: clinicInfo.phone || null,
      },
    };
  }

  // --- MANAGER CRUD OPERATIONS ---

  async getServicesByManager(clinicManagerId: string): Promise<any[]> {
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
      return {
        _id: raw._id,
        categoryId: raw.categoryId,
        serviceName: raw.serviceName,
        serviceCode: raw.serviceCode,
        description: raw.description,
        serviceFunctions: typeof raw.serviceFunctions === 'string'
          ? raw.serviceFunctions.replace(/^{|}$/g, '').split(',') // parse postgres array string if needed
          : raw.serviceFunctions,
        isActive: raw.isActive,
        price: Number(raw.price),
        discount: Number(raw.discount),
        durationMin: raw.durationMin,
        noteForPatient: raw.noteForPatient,
      };
    });
  }

  async getServiceDetail(clinicManagerId: string, id: string): Promise<any> {
    const raw = await this.dataSource.createQueryBuilder()
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
      .where('cs._id = :id', { id })
      .andWhere('csc.clinic_id = :clinicManagerId', { clinicManagerId })
      .andWhere('cs.deleted_at IS NULL')
      .andWhere('csc.deleted_at IS NULL')
      .getRawOne();

    if (!raw) {
      throw new NotFoundException(`Service with ID ${id} not found for this clinic.`);
    }

    return {
      _id: raw._id,
      categoryId: raw.categoryId,
      serviceName: raw.serviceName,
      serviceCode: raw.serviceCode,
      description: raw.description,
      serviceFunctions: typeof raw.serviceFunctions === 'string'
        ? raw.serviceFunctions.replace(/^{|}$/g, '').split(',')
        : raw.serviceFunctions,
      isActive: raw.isActive,
      price: Number(raw.price),
      discount: Number(raw.discount),
      durationMin: raw.durationMin,
      noteForPatient: raw.noteForPatient,
    };
  }

  async createService(clinicManagerId: string, dto: any): Promise<any> {
    const categoryExists = await this.dataSource.query(
      `SELECT _id FROM clinic_service_category WHERE _id = $1 AND deleted_at IS NULL`,
      [dto.categoryId]
    );
    if (!categoryExists || categoryExists.length === 0) {
      throw new NotFoundException(`Category with ID ${dto.categoryId} not found.`);
    }

    const existingCode = await this.dataSource.query(
      `SELECT _id FROM clinic_services WHERE service_code = $1 AND deleted_at IS NULL`,
      [dto.serviceCode]
    );

    if (existingCode && existingCode.length > 0) {
      // throw new BadRequestException(`Service with code ${dto.serviceCode} already exists.`);
      // Actually, if it's the manager creating it, let's just make it unique by checking
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Create Clinic Service (Master data)
      const serviceResult = await queryRunner.query(
        `INSERT INTO clinic_services (category_id, service_name, service_code, description, service_functions, is_active)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [dto.categoryId, dto.serviceName, dto.serviceCode, dto.description, dto.serviceFunctions, true]
      );
      const savedService = serviceResult[0];

      // 2. Create Clinic Service Config for the manager
      const configResult = await queryRunner.query(
        `INSERT INTO clinic_service_config (service_id, clinic_id, price, discount, duration_min, note_for_patient, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [savedService._id, clinicManagerId, dto.price, dto.discount || 0, dto.durationMin, dto.noteForPatient, true]
      );
      const savedConfig = configResult[0];

      await queryRunner.commitTransaction();

      return {
        _id: savedService._id,
        categoryId: savedService.category_id,
        serviceName: savedService.service_name,
        serviceCode: savedService.service_code,
        description: savedService.description,
        serviceFunctions: savedService.service_functions,
        isActive: savedService.is_active,
        price: Number(savedConfig.price),
        discount: Number(savedConfig.discount),
        durationMin: savedConfig.duration_min,
        noteForPatient: savedConfig.note_for_patient,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async updateService(clinicManagerId: string, id: string, dto: any): Promise<any> {
    const raw = await this.getServiceDetail(clinicManagerId, id); // Will throw if not found

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update Service
      let updateServiceQuery = 'UPDATE clinic_services SET updated_at = NOW()';
      const serviceParams: any[] = [];
      let serviceParamIndex = 1;

      if (dto.categoryId !== undefined) {
        updateServiceQuery += `, category_id = $${serviceParamIndex++}`;
        serviceParams.push(dto.categoryId);
      }
      if (dto.serviceName !== undefined) {
        updateServiceQuery += `, service_name = $${serviceParamIndex++}`;
        serviceParams.push(dto.serviceName);
      }
      if (dto.serviceCode !== undefined) {
        updateServiceQuery += `, service_code = $${serviceParamIndex++}`;
        serviceParams.push(dto.serviceCode);
      }
      if (dto.description !== undefined) {
        updateServiceQuery += `, description = $${serviceParamIndex++}`;
        serviceParams.push(dto.description);
      }
      if (dto.serviceFunctions !== undefined) {
        updateServiceQuery += `, service_functions = $${serviceParamIndex++}`;
        serviceParams.push(dto.serviceFunctions);
      }

      updateServiceQuery += ` WHERE _id = $${serviceParamIndex}`;
      serviceParams.push(id);

      await queryRunner.query(updateServiceQuery, serviceParams);

      // Update Config
      let updateConfigQuery = 'UPDATE clinic_service_config SET updated_at = NOW()';
      const configParams: any[] = [];
      let configParamIndex = 1;

      if (dto.price !== undefined) {
        updateConfigQuery += `, price = $${configParamIndex++}`;
        configParams.push(dto.price);
      }
      if (dto.discount !== undefined) {
        updateConfigQuery += `, discount = $${configParamIndex++}`;
        configParams.push(dto.discount);
      }
      if (dto.durationMin !== undefined) {
        updateConfigQuery += `, duration_min = $${configParamIndex++}`;
        configParams.push(dto.durationMin);
      }
      if (dto.noteForPatient !== undefined) {
        updateConfigQuery += `, note_for_patient = $${configParamIndex++}`;
        configParams.push(dto.noteForPatient);
      }

      updateConfigQuery += ` WHERE service_id = $${configParamIndex++} AND clinic_id = $${configParamIndex}`;
      configParams.push(id, clinicManagerId);

      await queryRunner.query(updateConfigQuery, configParams);

      await queryRunner.commitTransaction();

      return this.getServiceDetail(clinicManagerId, id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async toggleServiceStatus(clinicManagerId: string, id: string, isActive: boolean): Promise<any> {
    const raw = await this.getServiceDetail(clinicManagerId, id); // Will throw if not found

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(
        `UPDATE clinic_services SET is_active = $1, updated_at = NOW() WHERE _id = $2`,
        [isActive, id]
      );

      await queryRunner.query(
        `UPDATE clinic_service_config SET is_active = $1, updated_at = NOW() WHERE service_id = $2 AND clinic_id = $3`,
        [isActive, id, clinicManagerId]
      );

      await queryRunner.commitTransaction();

      return this.getServiceDetail(clinicManagerId, id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
