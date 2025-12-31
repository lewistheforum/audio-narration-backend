import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { DoctorInformation } from '../entities/doctor_information.entity';

/**
 * DoctorInformation Repository
 *
 * Handles all direct database operations for the DoctorInformation entity.
 * This layer is responsible for data access only, no business logic.
 */
@Injectable()
export class DoctorInformationRepository {
  constructor(
    @InjectRepository(DoctorInformation)
    private readonly repository: Repository<DoctorInformation>,
  ) {}

  /**
   * Find all doctor information records
   */
  async findAll(includeDeleted: boolean = false): Promise<DoctorInformation[]> {
    return this.repository.find({
      withDeleted: includeDeleted,
    });
  }

  /**
   * Find doctor information by ID
   */
  async findById(id: string): Promise<DoctorInformation | null> {
    return this.repository.findOne({
      where: { _id: id },
    });
  }

  /**
   * Find doctor information by doctor account ID
   */
  async findByDoctorAccountId(
    doctorAccId: string,
  ): Promise<DoctorInformation | null> {
    return this.repository.findOne({
      where: { doctorAccId },
    });
  }

  /**
   * Find doctor information by doctor account ID including soft-deleted
   */
  async findByDoctorAccountIdWithDeleted(
    doctorAccId: string,
  ): Promise<DoctorInformation | null> {
    return this.repository.findOne({
      where: { doctorAccId },
      withDeleted: true,
    });
  }

  /**
   * Create doctor information entity (without saving)
   */
  create(data: DeepPartial<DoctorInformation>): DoctorInformation {
    return this.repository.create(data);
  }

  /**
   * Save doctor information entity
   */
  async save(doctorInfo: DoctorInformation): Promise<DoctorInformation> {
    return this.repository.save(doctorInfo);
  }

  /**
   * Update doctor information by ID
   */
  async update(
    id: string,
    data: DeepPartial<DoctorInformation>,
  ): Promise<DoctorInformation | null> {
    await this.repository.update(id, data);
    return this.findById(id);
  }

  /**
   * Update doctor information by doctor account ID
   */
  async updateByDoctorAccountId(
    doctorAccId: string,
    data: DeepPartial<DoctorInformation>,
  ): Promise<DoctorInformation | null> {
    await this.repository.update({ doctorAccId }, data);
    return this.findByDoctorAccountId(doctorAccId);
  }

  /**
   * Soft delete doctor information
   */
  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }

  /**
   * Soft delete doctor information by doctor account ID
   */
  async softDeleteByDoctorAccountId(doctorAccId: string): Promise<void> {
    await this.repository.softDelete({ doctorAccId });
  }

  /**
   * Hard delete doctor information
   */
  async delete(id: string): Promise<number> {
    const result = await this.repository.delete(id);
    return result.affected || 0;
  }

  /**
   * Hard delete doctor information by doctor account ID
   */
  async deleteByDoctorAccountId(doctorAccId: string): Promise<number> {
    const result = await this.repository.delete({ doctorAccId });
    return result.affected || 0;
  }

  /**
   * Restore soft-deleted doctor information
   */
  async restore(id: string): Promise<void> {
    await this.repository.restore(id);
  }

  /**
   * Restore soft-deleted doctor information by doctor account ID
   */
  async restoreByDoctorAccountId(doctorAccId: string): Promise<void> {
    await this.repository.restore({ doctorAccId });
  }

  /**
   * Check if doctor information exists by doctor account ID
   */
  async existsByDoctorAccountId(doctorAccId: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { doctorAccId },
    });
    return count > 0;
  }
}
