import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  ClinicServicesResponseDto,
  ClinicServiceItemDto,
  GetClinicServicesQueryDto,
} from './dto';

/**
 * Service Configs Service
 *
 * Business logic for managing clinic service configurations
 */
@Injectable()
export class ServiceConfigsService {
  constructor(private readonly dataSource: DataSource) {}

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
        createdAt: raw.createdAt?.toISOString(),
        updatedAt: raw.updatedAt?.toISOString(),
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
}
