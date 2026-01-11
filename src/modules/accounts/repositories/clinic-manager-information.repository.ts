import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { ClinicManagerInformation } from '../entities/clinic_manager_information.entity';

/**
 * ClinicManagerInformation Repository
 *
 * Handles all direct database operations for the ClinicManagerInformation entity.
 * This layer is responsible for data access only, no business logic.
 *
 * IMPORTANT: Role Enforcement
 * - Only accounts with role='CLINIC_MANAGER' should have ClinicManagerInformation records
 * - Role validation MUST be performed at the service layer before calling save(), update(), or updateByAccountId()
 * - This repository does NOT enforce role validation as it is a data access layer
 * - Service-level enforcement is implemented in AccountsService.validateClinicManagerRole()
 *
 * @see AccountsService.validateClinicManagerRole for role validation implementation
 */
@Injectable()
export class ClinicManagerInformationRepository {
  constructor(
    @InjectRepository(ClinicManagerInformation)
    private readonly repository: Repository<ClinicManagerInformation>,
  ) {}

  /**
   * Find all clinic manager information records
   */
  async findAll(
    includeDeleted: boolean = false,
  ): Promise<ClinicManagerInformation[]> {
    return this.repository.find({
      withDeleted: includeDeleted,
    });
  }

  /**
   * Find clinic manager information by ID
   */
  async findById(id: string): Promise<ClinicManagerInformation | null> {
    return this.repository.findOne({
      where: { _id: id },
    });
  }

  /**
   * Find clinic manager information by account ID
   */
  async findByAccountId(accountId: string): Promise<ClinicManagerInformation | null> {
    return this.repository.findOne({
      where: { accountId },
    });
  }

  /**
   * Find clinic manager information by account ID including soft-deleted
   */
  async findByAccountIdWithDeleted(
    accountId: string,
  ): Promise<ClinicManagerInformation | null> {
    return this.repository.findOne({
      where: { accountId },
      withDeleted: true,
    });
  }

  /**
   * Create clinic manager information entity (without saving)
   *
   * NOTE: Role validation should be performed at service level before calling this method.
   * Only accounts with role='CLINIC_MANAGER' should have ClinicManagerInformation records.
   */
  create(data: DeepPartial<ClinicManagerInformation>): ClinicManagerInformation {
    return this.repository.create(data);
  }

  /**
   * Save clinic manager information entity
   *
   * NOTE: Role validation should be performed at service level before calling this method.
   * Only accounts with role='CLINIC_MANAGER' should have ClinicManagerInformation records.
   */
  async save(clinicManagerInfo: ClinicManagerInformation): Promise<ClinicManagerInformation> {
    return this.repository.save(clinicManagerInfo);
  }

  /**
   * Update clinic manager information by ID
   *
   * NOTE: Role validation should be performed at service level before calling this method.
   * Only accounts with role='CLINIC_MANAGER' should have ClinicManagerInformation records.
   */
  async update(
    id: string,
    data: DeepPartial<ClinicManagerInformation>,
  ): Promise<ClinicManagerInformation | null> {
    await this.repository.update(id, data);
    return this.findById(id);
  }

  /**
   * Update clinic manager information by account ID
   *
   * NOTE: Role validation should be performed at service level before calling this method.
   * Only accounts with role='CLINIC_MANAGER' should have ClinicManagerInformation records.
   */
  async updateByAccountId(
    accountId: string,
    data: DeepPartial<ClinicManagerInformation>,
  ): Promise<ClinicManagerInformation | null> {
    await this.repository.update({ accountId }, data);
    return this.findByAccountId(accountId);
  }

  /**
   * Soft delete clinic manager information
   */
  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }

  /**
   * Soft delete clinic manager information by account ID
   */
  async softDeleteByAccountId(accountId: string): Promise<void> {
    await this.repository.softDelete({ accountId });
  }

  /**
   * Hard delete clinic manager information
   */
  async delete(id: string): Promise<number> {
    const result = await this.repository.delete(id);
    return result.affected || 0;
  }

  /**
   * Hard delete clinic manager information by account ID
   */
  async deleteByAccountId(accountId: string): Promise<number> {
    const result = await this.repository.delete({ accountId });
    return result.affected || 0;
  }

  /**
   * Restore soft-deleted clinic manager information
   */
  async restore(id: string): Promise<void> {
    await this.repository.restore(id);
  }

  /**
   * Restore soft-deleted clinic manager information by account ID
   */
  async restoreByAccountId(accountId: string): Promise<void> {
    await this.repository.restore({ accountId });
  }

  /**
   * Check if clinic manager information exists by account ID
   */
  async existsByAccountId(accountId: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { accountId },
    });
    return count > 0;
  }
}
