import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppointmentPackage } from '../entities/appointment-package.entity';

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
}
