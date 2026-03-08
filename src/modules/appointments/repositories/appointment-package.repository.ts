import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppointmentPackage } from '../entities/appointment-package.entity';
import { AppointmentPackageStatus } from '../enums';

/**
 * AppointmentPackage Repository
 *
 * Handles database operations for AppointmentPackage entity
 */
@Injectable()
export class AppointmentPackageRepository {
  constructor(
    @InjectRepository(AppointmentPackage)
    private readonly repository: Repository<AppointmentPackage>,
  ) {}

  /**
   * Find appointment package by appointment ID with services
   *
   * @param appointmentId - Appointment UUID
   * @returns AppointmentPackage with services or null
   */
  async findByAppointmentIdWithServices(
    appointmentId: string,
  ): Promise<any | null> {
    // Get package info
    const packageData = await this.repository
      .createQueryBuilder('package')
      .leftJoin('transactions', 'transaction', 'transaction._id = package.transaction_id AND transaction.deleted_at IS NULL')
      .where('package.appointment_id = :appointmentId', { appointmentId })
      .andWhere('package.deleted_at IS NULL')
      .select([
        'package._id AS package_id',
        'package.appointment_id AS appointment_id',
        'package.transaction_id AS transaction_id',
        'package.amount AS amount',
        'package.status AS status',
        'package.payment_type AS payment_type',
        'package.created_at AS created_at',
        'package.updated_at AS updated_at',
        'transaction._id AS transaction_id_val',
      ])
      .getRawOne();

    if (!packageData) {
      return null;
    }

    // Get all services for this package
    const services = await this.repository
      .createQueryBuilder('package')
      .innerJoin(
        'service_appointments',
        'serviceAppointment',
        'serviceAppointment.appointment_package_id = package._id',
      )
      .innerJoin(
        'clinic_service_config',
        'clinicServiceConfig',
        'clinicServiceConfig._id = serviceAppointment.clinic_service_id',
      )
      .innerJoin(
        'clinic_services',
        'clinicService',
        'clinicService._id = clinicServiceConfig.service_id',
      )
      .where('package._id = :packageId', { packageId: packageData.package_id })
      .andWhere('serviceAppointment.deleted_at IS NULL')
      .andWhere('clinicServiceConfig.deleted_at IS NULL')
      .andWhere('clinicService.deleted_at IS NULL')
      .addSelect('clinicServiceConfig._id', 'clinicServiceConfig_id')
      .addSelect('clinicServiceConfig.price', 'clinicServiceConfig_price')
      .addSelect('clinicService._id', 'clinicService_id')
      .addSelect('clinicService.service_name', 'clinicService_serviceName')
      .addSelect('clinicService.description', 'clinicService_description')
      .getRawMany();

    // Transform to structured object
    return {
      _id: packageData.package_id,
      appointmentId: packageData.appointment_id,
      transactionId: packageData.transaction_id,
      amount: packageData.amount,
      status: packageData.status,
      paymentType: packageData.payment_type,
      createdAt: packageData.created_at,
      updatedAt: packageData.updated_at,
      transaction: packageData.transaction_id_val ? {
        _id: packageData.transaction_id_val,
      } : null,
      services: services.map(s => ({
        clinicServiceId: s.clinicServiceConfig__id,
        price: parseFloat(s.clinicServiceConfig_price),
        duration: s.clinicServiceConfig_duration,
        serviceName: s.clinicService_service_name,
        description: s.clinicService_description,
      })),
    };
  }

  /**
   * Find services by appointment IDs
   *
   * @param appointmentIds - Array of appointment UUIDs
   * @returns Map of appointmentId to services
   */
  async findServicesByAppointmentIds(
    appointmentIds: string[],
  ): Promise<Map<string, any[]>> {
    if (appointmentIds.length === 0) {
      return new Map();
    }

    const result = await this.repository
      .createQueryBuilder('package')
      .innerJoin(
        'service_appointments',
        'serviceAppointment',
        'serviceAppointment.appointment_package_id = package._id',
      )
      .innerJoin(
        'clinic_service_config',
        'clinicServiceConfig',
        'clinicServiceConfig._id = serviceAppointment.clinic_service_id',
      )
      .innerJoin(
        'clinic_services',
        'clinicService',
        'clinicService._id = clinicServiceConfig.service_id',
      )
      .where('package.appointment_id IN (:...appointmentIds)', {
        appointmentIds,
      })
      .andWhere('package.deleted_at IS NULL')
      .andWhere('serviceAppointment.deleted_at IS NULL')
      .select([
        'package.appointment_id',
        'clinicService._id',
        'clinicService.service_name',
        'clinicService.description',
        'clinicServiceConfig.price',
      ])
      .getRawMany();

    // Group services by appointment ID
    const servicesMap = new Map<string, any[]>();
    result.forEach((row) => {
      const appointmentId = row.appointment_id; // Fixed: was package_appointment_id
      const service = {
        id: row.clinicService__id,
        serviceName: row.service_name, // Fixed: was clinicService_service_name
        description: row.clinicService_description,
        price: parseFloat(row.clinicServiceConfig_price),
      };

      if (!servicesMap.has(appointmentId)) {
        servicesMap.set(appointmentId, []);
      }
      servicesMap.get(appointmentId)!.push(service);
    });

    return servicesMap;
  }

  /**
   * Find all packages by appointment ID with services (raw data)
   * 
   * Returns raw query results to avoid loading entities with circular dependencies.
   * Used for payment confirmation flow.
   * 
   * @param appointmentId - Appointment UUID
   * @returns Array of raw package data with services
   */
  async findAllByAppointmentIdWithServices(appointmentId: string): Promise<any[]> {
    // Get all packages with their basic info
    const packages = await this.repository
      .createQueryBuilder('pkg')
      .select([
        'pkg._id AS package_id',
        'pkg.appointment_id AS appointment_id',
        'pkg.transaction_id AS transaction_id',
        'pkg.amount AS amount',
        'pkg.status AS status',
        'pkg.payment_type AS payment_type',
        'pkg.created_at AS created_at',
        'pkg.updated_at AS updated_at',
      ])
      .where('pkg.appointment_id = :appointmentId', { appointmentId })
      .andWhere('pkg.deleted_at IS NULL')
      .getRawMany();

    // For each package, get its services
    for (const pkg of packages) {
      const services = await this.repository
        .createQueryBuilder('pkg')
        .innerJoin('service_appointments', 'sa', 'sa.appointment_package_id = pkg._id')
        .innerJoin('clinic_service_config', 'csc', 'csc._id = sa.clinic_service_id')
        .innerJoin('clinic_services', 'cs', 'cs._id = csc.service_id')
        .select([
          'sa._id AS service_appointment_id',
          'csc._id AS clinic_service_id',
          'cs.service_name AS service_name',
          'csc.price AS service_price',
        ])
        .where('pkg._id = :packageId', { packageId: pkg.package_id })
        .andWhere('sa.deleted_at IS NULL')
        .andWhere('csc.deleted_at IS NULL')
        .andWhere('cs.deleted_at IS NULL')
        .getRawMany();

      pkg.services = services;
    }

    return packages;
  }

  /**
   * Find package by ID (for update)
   * 
   * Returns entity for update operations
   * 
   * @param packageId - Package UUID
   * @returns AppointmentPackage entity or null
   */
  async findByIdForUpdate(packageId: string): Promise<AppointmentPackage | null> {
    return this.repository.findOne({
      where: { _id: packageId },
    });
  }

  /**
   * Update package
   * 
   * @param packageId - Package UUID
   * @param data - Data to update
   * @returns Updated package entity
   */
  async updatePackage(
    packageId: string,
    data: Partial<AppointmentPackage>,
  ): Promise<AppointmentPackage> {
    await this.repository.update({ _id: packageId }, data);
    
    const updated = await this.repository.findOne({
      where: { _id: packageId },
    });

    if (!updated) {
      throw new Error('Package not found after update');
    }

    return updated;
  }

  /**
   * Count pending packages for an appointment
   * 
   * @param appointmentId - Appointment UUID
   * @returns Number of packages with PENDING_PAYMENT status
   */
  async countPendingPackages(appointmentId: string): Promise<number> {
    return this.repository
      .createQueryBuilder('pkg')
      .where('pkg.appointment_id = :appointmentId', { appointmentId })
      .andWhere('pkg.status = :status', { status: AppointmentPackageStatus.PENDING_PAYMENT })
      .andWhere('pkg.deleted_at IS NULL')
      .getCount();
  }
}
