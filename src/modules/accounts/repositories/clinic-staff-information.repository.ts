import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial, In } from 'typeorm';
import { ClinicStaffInformation } from '../entities/clinic_staff_information.entity';

/**
 * ClinicStaffInformation Repository
 *
 * Handles all direct database operations for the ClinicStaffInformation entity.
 * This layer is responsible for data access only, no business logic.
 */
@Injectable()
export class ClinicStaffInformationRepository {
  constructor(
    @InjectRepository(ClinicStaffInformation)
    private readonly repository: Repository<ClinicStaffInformation>,
  ) {}

  /**
   * Find all clinic staff information records
   */
  async findAll(
    includeDeleted: boolean = false,
  ): Promise<ClinicStaffInformation[]> {
    return this.repository.find({
      withDeleted: includeDeleted,
    });
  }

  /**
   * Find clinic staff information by ID
   */
  async findById(id: string): Promise<ClinicStaffInformation | null> {
    return this.repository.findOne({
      where: { id },
    });
  }

  /**
   * Find clinic staff information by clinic account ID
   */
  async findByClinicAccountId(
    clinicAccId: string,
  ): Promise<ClinicStaffInformation | null> {
    return this.repository.findOne({
      where: { clinicAccId },
    });
  }

  /**
   * Find multiple clinic staff information by clinic account IDs
   */
  async findByClinicAccountIds(
    clinicAccIds: string[],
  ): Promise<ClinicStaffInformation[]> {
    if (!clinicAccIds || clinicAccIds.length === 0) {
      return [];
    }
    return this.repository.find({
      where: { clinicAccId: In(clinicAccIds) },
    });
  }

  /**
   * Find clinic staff information by clinic account ID including soft-deleted
   */
  async findByClinicAccountIdWithDeleted(
    clinicAccId: string,
  ): Promise<ClinicStaffInformation | null> {
    return this.repository.findOne({
      where: { clinicAccId },
      withDeleted: true,
    });
  }

  /**
   * Create clinic staff information entity (without saving)
   */
  create(data: DeepPartial<ClinicStaffInformation>): ClinicStaffInformation {
    return this.repository.create(data);
  }

  /**
   * Save clinic staff information entity
   */
  async save(
    clinicStaffInfo: ClinicStaffInformation,
  ): Promise<ClinicStaffInformation> {
    return this.repository.save(clinicStaffInfo);
  }

  /**
   * Update clinic staff information by ID
   */
  async update(
    id: string,
    data: DeepPartial<ClinicStaffInformation>,
  ): Promise<ClinicStaffInformation | null> {
    await this.repository.update(id, data);
    return this.findById(id);
  }

  /**
   * Update clinic staff information by clinic account ID
   */
  async updateByClinicAccountId(
    clinicAccId: string,
    data: DeepPartial<ClinicStaffInformation>,
  ): Promise<ClinicStaffInformation | null> {
    await this.repository.update({ clinicAccId }, data);
    return this.findByClinicAccountId(clinicAccId);
  }

  /**
   * Soft delete clinic staff information
   */
  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }

  /**
   * Soft delete clinic staff information by clinic account ID
   */
  async softDeleteByClinicAccountId(clinicAccId: string): Promise<void> {
    await this.repository.softDelete({ clinicAccId });
  }

  /**
   * Hard delete clinic staff information
   */
  async delete(id: string): Promise<number> {
    const result = await this.repository.delete(id);
    return result.affected || 0;
  }

  /**
   * Hard delete clinic staff information by clinic account ID
   */
  async deleteByClinicAccountId(clinicAccId: string): Promise<number> {
    const result = await this.repository.delete({ clinicAccId });
    return result.affected || 0;
  }

  /**
   * Restore soft-deleted clinic staff information
   */
  async restore(id: string): Promise<void> {
    await this.repository.restore(id);
  }

  /**
   * Restore soft-deleted clinic staff information by clinic account ID
   */
  async restoreByClinicAccountId(clinicAccId: string): Promise<void> {
    await this.repository.restore({ clinicAccId });
  }

  /**
   * Check if clinic staff information exists by clinic account ID
   */
  async existsByClinicAccountId(clinicAccId: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { clinicAccId },
    });
    return count > 0;
  }
}
