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
      where: { _id: id },
    });
  }

  /**
   * Find clinic staff information by clinic account ID
   */
  async findByAccountId(
    clinicAccId: string,
  ): Promise<ClinicStaffInformation | null> {
    return this.repository.findOne({
      where: { accountId: clinicAccId },
      relations: ['account'],
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
      where: { accountId: In(clinicAccIds) },
    });
  }

  /**
   * Find clinic staff information by clinic account ID including soft-deleted
   */
  async findByClinicAccountIdWithDeleted(
    clinicAccId: string,
  ): Promise<ClinicStaffInformation | null> {
    return this.repository.findOne({
      where: { accountId: clinicAccId },
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
    await this.repository.update({ accountId: clinicAccId }, data);
    return this.findByAccountId(clinicAccId);
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
    await this.repository.softDelete({ accountId: clinicAccId });
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
    const result = await this.repository.delete({ accountId: clinicAccId });
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
    await this.repository.restore({ accountId: clinicAccId });
  }

  /**
   * Check if clinic staff information exists by clinic account ID
   */
  async existsByClinicAccountId(clinicAccId: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { accountId: clinicAccId },
    });
    return count > 0;
  }
}
