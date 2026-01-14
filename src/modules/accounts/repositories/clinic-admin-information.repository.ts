import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { ClinicAdminInformation } from '../entities/clinic-admin-information.entity';

/**
 * ClinicAdminInformation Repository
 *
 * Handles all direct database operations for the ClinicAdminInformation entity.
 * This layer is responsible for data access only, no business logic.
 *
 * IMPORTANT: Role Enforcement
 * - Only accounts with role='CLINIC_ADMIN' should have ClinicAdminInformation records
 * - Role validation MUST be performed at the service layer before calling save(), update(), or updateByAccountId()
 * - This repository does NOT enforce role validation as it is a data access layer
 * - Service-level enforcement is implemented in AccountsService.validateClinicAdminRole()
 *
 * @see AccountsService.validateClinicAdminRole for role validation implementation
 */
@Injectable()
export class ClinicAdminInformationRepository {
  constructor(
    @InjectRepository(ClinicAdminInformation)
    private readonly repository: Repository<ClinicAdminInformation>,
  ) {}

  /**
   * Find all clinic admin information records
   */
  async findAll(
    includeDeleted: boolean = false,
  ): Promise<ClinicAdminInformation[]> {
    return this.repository.find({
      withDeleted: includeDeleted,
    });
  }

  /**
   * Find clinic admin information by ID
   */
  async findById(id: string): Promise<ClinicAdminInformation | null> {
    return this.repository.findOne({
      where: { _id: id },
    });
  }

  /**
   * Find clinic admin information by account ID
   */
  async findByAccountId(
    accountId: string,
  ): Promise<ClinicAdminInformation | null> {
    return this.repository.findOne({
      where: { accountId },
    });
  }

  /**
   * Find clinic admin information by account ID including soft-deleted
   */
  async findByAccountIdWithDeleted(
    accountId: string,
  ): Promise<ClinicAdminInformation | null> {
    return this.repository.findOne({
      where: { accountId },
      withDeleted: true,
    });
  }

  /**
   * Create clinic admin information entity (without saving)
   *
   * NOTE: Role validation should be performed at service level before calling this method.
   * Only accounts with role='CLINIC_ADMIN' should have ClinicAdminInformation records.
   */
  create(data: DeepPartial<ClinicAdminInformation>): ClinicAdminInformation {
    return this.repository.create(data);
  }

  /**
   * Save clinic admin information entity
   *
   * NOTE: Role validation should be performed at service level before calling this method.
   * Only accounts with role='CLINIC_ADMIN' should have ClinicAdminInformation records.
   */
  async save(
    clinicAdminInfo: ClinicAdminInformation,
  ): Promise<ClinicAdminInformation> {
    return this.repository.save(clinicAdminInfo);
  }

  /**
   * Update clinic admin information by ID
   *
   * NOTE: Role validation should be performed at service level before calling this method.
   * Only accounts with role='CLINIC_ADMIN' should have ClinicAdminInformation records.
   */
  async update(
    id: string,
    data: DeepPartial<ClinicAdminInformation>,
  ): Promise<ClinicAdminInformation | null> {
    await this.repository.update(id, data);
    return this.findById(id);
  }

  /**
   * Update clinic admin information by account ID
   *
   * NOTE: Role validation should be performed at service level before calling this method.
   * Only accounts with role='CLINIC_ADMIN' should have ClinicAdminInformation records.
   */
  async updateByAccountId(
    accountId: string,
    data: DeepPartial<ClinicAdminInformation>,
  ): Promise<ClinicAdminInformation | null> {
    await this.repository.update({ accountId }, data);
    return this.findByAccountId(accountId);
  }

  /**
   * Soft delete clinic admin information
   */
  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }

  /**
   * Soft delete clinic admin information by account ID
   */
  async softDeleteByAccountId(accountId: string): Promise<void> {
    await this.repository.softDelete({ accountId });
  }

  /**
   * Hard delete clinic admin information
   */
  async delete(id: string): Promise<number> {
    const result = await this.repository.delete(id);
    return result.affected || 0;
  }

  /**
   * Hard delete clinic admin information by account ID
   */
  async deleteByAccountId(accountId: string): Promise<number> {
    const result = await this.repository.delete({ accountId });
    return result.affected || 0;
  }

  /**
   * Restore soft-deleted clinic admin information
   */
  async restore(id: string): Promise<void> {
    await this.repository.restore(id);
  }

  /**
   * Restore soft-deleted clinic admin information by account ID
   */
  async restoreByAccountId(accountId: string): Promise<void> {
    await this.repository.restore({ accountId });
  }

  /**
   * Check if clinic admin information exists by account ID
   */
  async existsByAccountId(accountId: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { accountId },
    });
    return count > 0;
  }
}
