import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { ClinicManagerInformation } from '../entities/clinic_manager_information.entity';
import { AccountRole } from '../enums/account-role.enum';

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

  /**
   * Find Managers by Parent Admin with Pagination
   * Used for manager list endpoint
   * 
   * @param clinicAdminId - Parent CLINIC_ADMIN account ID
   * @param page - Page number (1-indexed)
   * @param limit - Items per page
   * @param sortBy - Sort field (default: createdAt)
   * @param sortOrder - ASC or DESC
   * @returns Tuple of [managers, totalCount]
   */
  async findManagersByAdminWithPagination(
    clinicAdminId: string,
    page: number = 1,
    limit: number = 10,
    sortBy: string = 'createdAt',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
  ): Promise<[any[], number]> {
    const skip = (page - 1) * limit;

    const queryBuilder = this.repository.createQueryBuilder('manager')
      .leftJoinAndSelect('manager.account', 'account')
      .leftJoin('account.children', 'children')
      .leftJoin('clinics_legal_documents', 'legal', 'legal.account_id = account._id')
      .leftJoin('addresses', 'address', 'address.account_id = account._id')
      .where('account.parent_id = :clinicAdminId', { clinicAdminId })
      .andWhere('account.deleted_at IS NULL')
      .select([
        'manager._id',
        'manager.fullName',
        'manager.clinicBranchName',
        'manager.createdAt',
        'account._id',
        'account.email',
        'account.status',
        'legal.verificationStatus',
        'address.provinceName',
      ])
      .addSelect('COUNT(DISTINCT CASE WHEN children.role = :staffRole THEN children._id END)', 'staffCount')
      .addSelect('COUNT(DISTINCT CASE WHEN children.role = :doctorRole THEN children._id END)', 'doctorCount')
      .setParameter('staffRole', AccountRole.CLINIC_STAFF)
      .setParameter('doctorRole', AccountRole.DOCTOR)
      .groupBy('manager._id')
      .addGroupBy('account._id')
      .addGroupBy('legal.verificationStatus')
      .addGroupBy('address.provinceName')
      .orderBy(`account.${sortBy}`, sortOrder)
      .skip(skip)
      .take(limit);

    const [data, totalCount] = await queryBuilder.getManyAndCount();

    return [data, totalCount];
  }

  /**
   * Find Manager Detail with All Relations
   * Used for manager detail endpoint
   * 
   * @param managerId - Manager account ID
   * @returns Complete manager data with relations
   */
  async findManagerDetailById(managerId: string): Promise<any> {
    return this.repository.createQueryBuilder('manager')
      .leftJoinAndSelect('manager.account', 'account')
      .leftJoinAndSelect('account.children', 'children')
      .leftJoin('children.doctorInformation', 'doctorInfo')
      .leftJoin('children.clinicStaffInformation', 'staffInfo')
      .leftJoin('addresses', 'address', 'address.account_id = account._id')
      .leftJoin('google_iframe', 'iframe', 'iframe.address_id = address._id')
      .leftJoin('clinics_legal_documents', 'legal', 'legal.account_id = account._id')
      .where('manager._id = :managerId', { managerId })
      .andWhere('account.deleted_at IS NULL')
      .select([
        'manager',
        'account._id',
        'account.email',
        'account.status',
        'account.parentId',
        'account.createdAt',
        'account.updatedAt',
        'children._id',
        'children.email',
        'children.role',
        'children.status',
        'doctorInfo.fullName',
        'doctorInfo.specialization',
        'staffInfo.fullName',
        'staffInfo.clinicRole',
        'address',
        'iframe.googleMapIframe',
        'legal',
      ])
      .getOne();
  }
}
