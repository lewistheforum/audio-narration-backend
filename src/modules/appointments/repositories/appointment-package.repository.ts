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
    return this.repository
      .createQueryBuilder('package')
      .leftJoinAndSelect('package.transaction', 'transaction')
      .leftJoin(
        'service_appointments',
        'serviceAppointment',
        'serviceAppointment.appointment_package_id = package._id',
      )
      .leftJoinAndSelect(
        'serviceAppointment.clinicService',
        'clinicService',
      )
      .leftJoinAndSelect('clinicService.service', 'service')
      .where('package.appointmentId = :appointmentId', { appointmentId })
      .andWhere('package.deletedAt IS NULL')
      .select([
        'package._id',
        'package.appointmentId',
        'package.transactionId',
        'package.amount',
        'package.status',
        'package.paymentType',
        'package.createdAt',
        'package.updatedAt',
        'transaction._id',
        'clinicService._id',
        'clinicService.price',
        'clinicService.duration',
        'service._id',
        'service.serviceName',
        'service.description',
      ])
      .getOne();
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
      const appointmentId = row.package_appointment_id;
      const service = {
        id: row.clinicService__id,
        serviceName: row.clinicService_service_name,
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
