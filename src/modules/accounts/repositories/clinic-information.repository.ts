import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { ClinicInformation } from '../entities/clinic_information.entity';

/**
 * ClinicInformation Repository
 *
 * Handles all direct database operations for the ClinicInformation entity.
 * This layer is responsible for data access only, no business logic.
 */
@Injectable()
export class ClinicInformationRepository {
  constructor(
    @InjectRepository(ClinicInformation)
    private readonly repository: Repository<ClinicInformation>,
  ) {}

  /**
   * Find all clinic information records
   */
  async findAll(
    includeDeleted: boolean = false,
  ): Promise<ClinicInformation[]> {
    return this.repository.find({
      withDeleted: includeDeleted,
    });
  }

  /**
   * Find clinic information by ID
   */
  async findById(id: string): Promise<ClinicInformation | null> {
    return this.repository.findOne({
      where: { _id: id },
    });
  }

  /**
   * Find clinic information by clinic ID
   */
  async findByClinicId(clinicId: string): Promise<ClinicInformation | null> {
    return this.repository.findOne({
      where: { clinicId },
    });
  }

  /**
   * Find clinic information by clinic ID including soft-deleted
   */
  async findByClinicIdWithDeleted(
    clinicId: string,
  ): Promise<ClinicInformation | null> {
    return this.repository.findOne({
      where: { clinicId },
      withDeleted: true,
    });
  }

  /**
   * Create clinic information entity (without saving)
   */
  create(data: DeepPartial<ClinicInformation>): ClinicInformation {
    return this.repository.create(data);
  }

  /**
   * Save clinic information entity
   */
  async save(clinicInfo: ClinicInformation): Promise<ClinicInformation> {
    return this.repository.save(clinicInfo);
  }

  /**
   * Update clinic information by ID
   */
  async update(
    id: string,
    data: DeepPartial<ClinicInformation>,
  ): Promise<ClinicInformation | null> {
    await this.repository.update(id, data);
    return this.findById(id);
  }

  /**
   * Update clinic information by clinic ID
   */
  async updateByClinicId(
    clinicId: string,
    data: DeepPartial<ClinicInformation>,
  ): Promise<ClinicInformation | null> {
    await this.repository.update({ clinicId }, data);
    return this.findByClinicId(clinicId);
  }

  /**
   * Soft delete clinic information
   */
  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }

  /**
   * Soft delete clinic information by clinic ID
   */
  async softDeleteByClinicId(clinicId: string): Promise<void> {
    await this.repository.softDelete({ clinicId });
  }

  /**
   * Hard delete clinic information
   */
  async delete(id: string): Promise<number> {
    const result = await this.repository.delete(id);
    return result.affected || 0;
  }

  /**
   * Hard delete clinic information by clinic ID
   */
  async deleteByClinicId(clinicId: string): Promise<number> {
    const result = await this.repository.delete({ clinicId });
    return result.affected || 0;
  }

  /**
   * Restore soft-deleted clinic information
   */
  async restore(id: string): Promise<void> {
    await this.repository.restore(id);
  }

  /**
   * Restore soft-deleted clinic information by clinic ID
   */
  async restoreByClinicId(clinicId: string): Promise<void> {
    await this.repository.restore({ clinicId });
  }

  /**
   * Check if clinic information exists by clinic ID
   */
  async existsByClinicId(clinicId: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { clinicId },
    });
    return count > 0;
  }
}
