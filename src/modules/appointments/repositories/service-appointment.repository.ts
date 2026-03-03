import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceAppointment } from '../entities';

/**
 * Service Appointment Repository
 */
@Injectable()
export class ServiceAppointmentRepository {
  constructor(
    @InjectRepository(ServiceAppointment)
    private readonly repository: Repository<ServiceAppointment>,
  ) { }

  async create(data: Partial<ServiceAppointment>): Promise<ServiceAppointment> {
    const item = this.repository.create(data);
    return await this.repository.save(item);
  }

  async findByPackageId(packageId: string): Promise<ServiceAppointment[]> {
    return await this.repository.find({
      where: { appointmentPackageId: packageId },
    });
  }
}
