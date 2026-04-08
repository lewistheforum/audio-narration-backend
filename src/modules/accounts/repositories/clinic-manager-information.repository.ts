import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { ClinicManagerInformation } from '../entities/clinic_manager_information.entity';
import { Account } from '../entities/accounts.entity';
import { AccountRole } from '../enums/account-role.enum';
import { LegalDocumentVerificationStatus } from '../enums/legal-document-verification-status.enum';
import { AccountStatus } from '../enums';

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
    return this.repository.createQueryBuilder('manager')
      .leftJoinAndSelect('manager.account', 'account')
      .leftJoinAndSelect('account.legalDocuments', 'legal')
      .where('manager.accountId = :accountId', { accountId })
      .getOne();
  }

  /**
   * Find clinic manager information by account ID including soft-deleted
   */
  async findByAccountIdWithDeleted(
    accountId: string,
  ): Promise<ClinicManagerInformation | null> {
    return this.repository.createQueryBuilder('manager')
      .withDeleted()
      .leftJoinAndSelect('manager.account', 'account')
      .leftJoinAndSelect('account.legalDocuments', 'legal')
      .where('manager.accountId = :accountId', { accountId })
      .getOne();
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
   * Find Managers by Parent Admin with Pagination and Filters
   * Used for manager list endpoint
   * 
   * Uses PostgreSQL subqueries for staffCount/doctorCount to eliminate N+1.
   * All array filters use PostgreSQL ANY() operator.
   * 
   * @param clinicAdminId - Parent CLINIC_ADMIN account ID
   * @param query - Query parameters (pagination, sorting, filters)
   * @returns Tuple of [managers, totalCount]
   */
  async findManagersByAdminWithPagination(
    clinicAdminId: string,
    query: any,
  ): Promise<[any[], number]> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      fullName,
      clinicBranchName,
      email,
      status,
      legalDocStatus,
      province,
    } = query;

    const skip = (page - 1) * limit;

    // Map sortBy field to correct entity alias
    const sortFieldMap: Record<string, string> = {
      'fullName': 'manager.fullName',
      'clinicBranchName': 'manager.clinicBranchName',
      'createdAt': 'manager.createdAt',
      'email': 'account.email',
      'status': 'account.status',
      'verificationStatus': 'legal.verificationStatus',
      'provinceName': 'address.provinceName',
    };

    const sortField = sortFieldMap[sortBy] || 'manager.createdAt';

    const queryBuilder = this.repository.createQueryBuilder('manager')
      .leftJoinAndSelect('manager.account', 'account')
      .leftJoin('clinics_legal_documents', 'legal', 'legal.account_id = account._id')
      .leftJoin('addresses', 'address', 'address.account_id = account._id')
      .where('account.parent_id = :clinicAdminId', { clinicAdminId })
      .andWhere('account.deleted_at IS NULL');

    // Apply filters dynamically
    if (fullName) {
      queryBuilder.andWhere('LOWER(manager.fullName) LIKE LOWER(:fullName)', {
        fullName: `%${fullName}%`,
      });
    }

    if (clinicBranchName) {
      queryBuilder.andWhere('LOWER(manager.clinicBranchName) LIKE LOWER(:clinicBranchName)', {
        clinicBranchName: `%${clinicBranchName}%`,
      });
    }

    if (email) {
      queryBuilder.andWhere('LOWER(account.email) LIKE LOWER(:email)', {
        email: `%${email}%`,
      });
    }

    if (status) {
      queryBuilder.andWhere('account.status = :status', { status });
    }

    if (legalDocStatus) {
      if (legalDocStatus === 'NOT_SUBMITTED') {
        queryBuilder.andWhere('legal.verificationStatus IS NULL');
      } else {
        queryBuilder.andWhere('legal.verificationStatus = :legalDocStatus', {
          legalDocStatus,
        });
      }
    }

    if (province) {
      queryBuilder.andWhere('LOWER(address.provinceName) LIKE LOWER(:province)', {
        province: `%${province}%`,
      });
    }

    // Subquery for staff count (N+1 elimination)
    queryBuilder.addSelect((subQuery) => {
      return subQuery
        .select('COUNT(acc._id)')
        .from(Account, 'acc')
        .where('acc.parent_id = account._id')
        .andWhere('acc.role = :staffRole')
        .andWhere('acc.deleted_at IS NULL');
    }, 'staffCount');

    // Subquery for doctor count (N+1 elimination)
    queryBuilder.addSelect((subQuery) => {
      return subQuery
        .select('COUNT(acc._id)')
        .from(Account, 'acc')
        .where('acc.parent_id = account._id')
        .andWhere('acc.role = :doctorRole')
        .andWhere('acc.deleted_at IS NULL');
    }, 'doctorCount');

    queryBuilder
      .setParameter('staffRole', AccountRole.CLINIC_STAFF)
      .setParameter('doctorRole', AccountRole.DOCTOR)
      .orderBy(sortField, sortOrder)
      .skip(skip)
      .take(limit);

    const result = await queryBuilder.getRawAndEntities();
    const countResult = await queryBuilder.getCount();

    // Attach raw count values to each entity for service layer mapping
    const managersWithCounts = result.entities.map((manager, index) => {
      (manager as any).staffCount = result.raw[index]?.staffCount ?? '0';
      (manager as any).doctorCount = result.raw[index]?.doctorCount ?? '0';
      return manager;
    });

    return [managersWithCounts, countResult];
  }

  /**
   * Find Manager Detail with All Relations
   * Used for manager detail endpoint
   * 
   * @param managerId - Manager account ID
   * @returns Complete manager data with relations
   */
  async findManagerDetailById(managerId: string): Promise<any> {
    const manager = await this.repository.createQueryBuilder('manager')
      .leftJoinAndSelect('manager.account', 'account')
      .leftJoinAndSelect('account.parent', 'clinicAdmin')
      .leftJoinAndSelect('clinicAdmin.clinicSubscription', 'clinicSubscription')
      .leftJoinAndSelect('account.children', 'children')
      .leftJoinAndSelect('children.doctorInformation', 'doctorInfo')
      .leftJoinAndSelect('children.clinicStaffInformation', 'staffInfo')
      .leftJoinAndSelect('account.legalDocuments', 'legal')
      .leftJoinAndSelect('account.address', 'address')
      .leftJoinAndSelect('address.googleIframe', 'iframe')
      .where('account._id = :managerId', { managerId })
      .andWhere('account.status = :status', { status: AccountStatus.ACTIVE })
      .andWhere('clinicAdmin.status = :adminStatus', { adminStatus: AccountStatus.ACTIVE })
      .andWhere('clinicSubscription.status = :subscriptionStatus', { subscriptionStatus: AccountStatus.ACTIVE })
      .andWhere('legal.verification_status = :legalDocStatus', { legalDocStatus: LegalDocumentVerificationStatus.APPROVED })
      .andWhere('account.deleted_at IS NULL')
      .getOne();
    
    return manager;
  }
}
