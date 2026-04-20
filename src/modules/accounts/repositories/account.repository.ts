import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial, IsNull, Brackets } from 'typeorm';
import { Account } from '../entities/accounts.entity';
import {
  AccountRole,
  AccountStatus,
  ClinicRole,
  LegalDocumentVerificationStatus,
} from '../enums';
import { RegistrationStatus } from '../../subscriptions/enums/subscription-status.enum';
import { ClinicSubscription } from '../../subscriptions/entities/clinic-subscription.entity';

/**
 * Account Repository
 *
 * Data access layer for Account entity.
 * Implements the Repository Pattern to separate data access logic from business logic.
 *
 * Responsibilities:
 * - Direct database operations (CRUD) for Account entity
 * - Query construction and execution
 * - No business logic (handled by AccountsService)
 * - No validation (handled by DTOs and Service)
 *
 * Architecture:
 * - Uses TypeORM Repository pattern
 * - Single entity: Account
 * - Provides both individual and bulk operations
 * - Implements soft delete functionality
 *
 * Design Principles:
 * - Single Responsibility: Only handles Account data access
 * - Separation of Concerns: No business logic
 * - Testability: Easy to mock for unit tests
 * - Maintainability: Centralized query logic
 *
 * @class AccountRepository
 * @injectable
 */
@Injectable()
export class AccountRepository {
  /**
   * Constructs the AccountRepository with TypeORM repository
   *
   * @param {Repository<Account>} accountRepository - TypeORM repository for Account entity
   */
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
  ) {}

  /**
   * Find All Accounts
   *
   * Retrieves all account records from the database with optional inclusion of soft-deleted records.
   *
   * Query Behavior:
   * - By default, excludes soft-deleted accounts (deletedAt IS NULL)
   * - When includeDeleted=true, includes all accounts regardless of deletedAt status
   *
   * Performance Considerations:
   * - Loads all accounts into memory
   * - Consider adding pagination for large datasets
   * - No eager loading of relations (GeneralAccount must be queried separately)
   *
   * @param {boolean} includeDeleted - Whether to include soft-deleted accounts (default: false)
   * @returns {Promise<Account[]>} Array of all account entities
   *
   * @example
   * ```typescript
   * const activeAccounts = await repository.findAllAccounts();
   * const allAccounts = await repository.findAllAccounts(true);
   * ```
   */
  async findAllAccounts(includeDeleted: boolean = false): Promise<Account[]> {
    return this.accountRepository.find({
      withDeleted: includeDeleted,
    });
  }

  /**
   * Find All Accounts with GeneralAccount (Optimized for N+1 Prevention)
   *
   * Retrieves all accounts with their associated GeneralAccount in a single query.
   * Uses LEFT JOIN to fetch related data efficiently.
   *
   * @param {boolean} includeDeleted - Include soft-deleted accounts
   * @returns {Promise<Account[]>} Array of accounts with generalAccount relation loaded
   */
  async findAllAccountsWithGeneralAccount(
    includeDeleted: boolean = false,
  ): Promise<Account[]> {
    const queryBuilder = this.accountRepository
      .createQueryBuilder('account')
      .leftJoinAndSelect('account.generalAccount', 'generalAccount')
      .orderBy('account.createdAt', 'DESC');

    if (includeDeleted) {
      queryBuilder.withDeleted();
    }

    return queryBuilder.getMany();
  }

  /**
   * Find Account by ID
   *
   * Retrieves a single account by its UUID.
   * Excludes soft-deleted accounts by default.
   *
   * @param {string} id - Account UUID
   * @returns {Promise<Account | null>} Account entity or null if not found
   *
   * @example
   * ```typescript
   * const account = await repository.findAccountById('uuid-here');
   * if (account) {
   *   // Account exists and is not deleted
   * }
   * ```
   */
  async findAccountById(id: string): Promise<Account | null> {
    return this.accountRepository
      .createQueryBuilder('account')
      .leftJoinAndSelect('account.legalDocuments', 'legalDocuments')
      .where('account._id = :id', { id })
      .getOne();
  }

  /**
   * Find Account by ID (Including Deleted)
   *
   * Retrieves a single account by its UUID, including soft-deleted accounts.
   * Used for restoration operations and audit queries.
   *
   * @param {string} id - Account UUID
   * @returns {Promise<Account | null>} Account entity or null if not found
   *
   * @example
   * ```typescript
   * const account = await repository.findAccountByIdWithDeleted('uuid-here');
   * if (account && account.deletedAt) {
   *   // Account is soft-deleted and can be restored
   * }
   * ```
   */
  async findAccountByIdWithDeleted(id: string): Promise<Account | null> {
    return this.accountRepository.findOne({
      where: { _id: id },
      withDeleted: true,
    });
  }

  /**
   * Find Account by Email
   *
   * Retrieves a single account by email address.
   * Email is a unique field in the database.
   *
   * Use Cases:
   * - Email/password authentication
   * - Email uniqueness validation
   * - Password reset workflow
   *
   * @param {string} email - Account email address
   * @returns {Promise<Account | null>} Account entity or null if not found
   *
   * @example
   * ```typescript
   * const account = await repository.findAccountByEmail('user@example.com');
   * ```
   */
  async findAccountByEmail(
    email: string,
    role?: string,
  ): Promise<Account | null> {
    const where: any = { email };
    if (role) {
      where.role = role;
    }
    return this.accountRepository.findOne({
      where,
    });
  }

  /**
   * Find Account by Phone Number
   *
   * Retrieves a single account by phone number.
   * Phone is a unique field in the database.
   *
   * Use Cases:
   * - Patient search for walk-in appointments
   * - Phone verification
   * - Duplicate account prevention
   *
   * @param {string} phone - Account phone number
   * @returns {Promise<Account | null>} Account entity or null if not found
   *
   * @example
   * ```typescript
   * const account = await repository.findByPhone('0912345678');
   * ```
   */
  async findByPhone(phone: string): Promise<Account | null> {
    return this.accountRepository.findOne({
      where: { phone },
    });
  }

  /**
   * Find Account by Email (Alias)
   *
   * Alias method for consistency with other find methods
   *
   * @param {string} email - Account email address
   * @returns {Promise<Account | null>} Account entity or null if not found
   */
  async findByEmail(email: string): Promise<Account | null> {
    return this.findAccountByEmail(email);
  }

  /**
   * Find Multiple Accounts by IDs using PostgreSQL ANY()
   *
   * Batch retrieval of accounts using SQL ANY() for type safety.
   * Efficient for loading multiple accounts at once.
   *
   * Performance:
   * - Single database query regardless of number of IDs
   * - Returns accounts in arbitrary order
   * - Missing IDs are silently ignored
   *
   * @param {string[]} ids - Array of account UUIDs
   * @returns {Promise<Account[]>} Array of found accounts (empty if no IDs or none found)
   *
   * @example
   * ```typescript
   * const accounts = await repository.findAccountsByIds(['id1', 'id2', 'id3']);
   * // Returns only existing accounts
   * ```
   */
  async findAccountsByIds(ids: string[]): Promise<Account[]> {
    if (!ids || ids.length === 0) {
      return [];
    }
    return this.accountRepository
      .createQueryBuilder('account')
      .leftJoinAndSelect(
        'account.clinicAdminInformation',
        'clinicAdminInformation',
      )
      .leftJoinAndSelect(
        'account.clinicManagerInformation',
        'clinicManagerInformation',
      )
      .leftJoinAndSelect('account.doctorInformation', 'doctorInformation')
      .leftJoinAndSelect(
        'account.clinicStaffInformation',
        'clinicStaffInformation',
      )
      .leftJoinAndSelect('account.generalAccount', 'generalAccount')
      .where('account._id = ANY(:ids)', { ids })
      .getMany();
  }

  /**
   * Create Account Entity
   *
   * Creates an Account entity instance without persisting to database.
   * Use saveAccount() to persist the created entity.
   *
   * Pattern:
   * - Create entity with data
   * - Modify as needed
   * - Save to database
   *
   * @param {DeepPartial<Account>} data - Account data (partial object)
   * @returns {Account} Unpersisted Account entity instance
   *
   * @example
   * ```typescript
   * const account = repository.createAccount({
   *   email: 'user@example.com',
   *   password: 'hashed',
   *   role: AccountRole.PATIENT
   * });
   * // Account exists in memory but not in database
   * await repository.saveAccount(account); // Now persisted
   * ```
   */
  createAccount(data: DeepPartial<Account>): Account {
    return this.accountRepository.create(data);
  }

  /**
   * Save Account Entity
   *
   * Persists an Account entity to the database.
   * Performs INSERT for new entities, UPDATE for existing entities.
   *
   * Behavior:
   * - Auto-generates UUID for new entities
   * - Updates timestamps (createdAt, updatedAt)
   * - Returns the saved entity with generated/updated fields
   *
   * @param {Account} account - Account entity to save
   * @returns {Promise<Account>} Saved Account entity with updated fields
   *
   * @example
   * ```typescript
   * const account = repository.createAccount({ ... });
   * const savedAccount = await repository.saveAccount(account);
   * // savedAccount.id is now populated
   * ```
   */
  async saveAccount(account: Account): Promise<Account> {
    return this.accountRepository.save(account);
  }

  /**
   * Find Accounts with Flexible Options
   */
  async findAccounts(options: any): Promise<Account[]> {
    return this.accountRepository.find(options);
  }

  /**
   * Create Query Builder for complex queries
   */
  createQueryBuilder(alias?: string) {
    return this.accountRepository.createQueryBuilder(alias);
  }

  /**
   * Soft Delete Account
   *
   * Marks an account as deleted by setting the deletedAt timestamp.
   * The record remains in the database for audit and recovery.
   *
   * Effects:
   * - Sets deletedAt to current timestamp
   * - Account excluded from default queries
   * - Can be recovered with restoreAccount()
   *
   * @param {string} id - Account UUID to soft delete
   * @returns {Promise<void>} No return value
   *
   * @example
   * ```typescript
   * await repository.softDeleteAccount('uuid-here');
   * // Account is soft-deleted but data is retained
   * ```
   */
  async softDeleteAccount(id: string): Promise<void> {
    await this.accountRepository.softDelete(id);
  }

  /**
   * Hard Delete Account
   *
   * Permanently removes an account from the database.
   * This operation is irreversible.
   *
   * WARNING: This is a destructive operation. Use soft delete for most cases.
   *
   * @param {string} id - Account UUID to permanently delete
   * @returns {Promise<number>} Number of affected rows (0 if not found, 1 if deleted)
   *
   * @example
   * ```typescript
   * const affected = await repository.deleteAccount('uuid-here');
   * if (affected === 0) {
   *   // Account not found
   * }
   * ```
   */
  async deleteAccount(id: string): Promise<number> {
    const result = await this.accountRepository.delete(id);
    return result.affected || 0;
  }

  /**
   * Restore Soft-Deleted Account
   *
   * Clears the deletedAt timestamp to restore a soft-deleted account.
   * The account becomes accessible again in default queries.
   *
   * Requirements:
   * - Account must have been soft-deleted (deletedAt IS NOT NULL)
   *
   * @param {string} id - Account UUID to restore
   * @returns {Promise<void>} No return value
   *
   * @example
   * ```typescript
   * await repository.restoreAccount('uuid-here');
   * // Account is now active again
   * ```
   */
  async restoreAccount(id: string): Promise<void> {
    await this.accountRepository.restore(id);
  }

  /**
   * Find Accounts by Role and Status with Pagination
   *
   * Retrieves accounts matching specific role and status with pagination support.
   *
   * @param {AccountRole} role - Account role to filter
   * @param {AccountStatus} status - Account status to filter
   * @param {number} skip - Number of records to skip
   * @param {number} take - Number of records to return
   * @returns {Promise<[Account[], number]>} Array of accounts and total count
   *
   * @example
   * ```typescript
   * const [clinics, total] = await repository.findByRoleAndStatus(
   *   AccountRole.CLINIC_MANAGER,
   *   AccountStatus.ACTIVE,
   *   0,
   *   10
   * );
   * ```
   */
  async findByRoleAndStatus(
    role: AccountRole,
    status: AccountStatus,
    skip: number = 0,
    take: number = 10,
  ): Promise<[Account[], number]> {
    const now = new Date();
    return this.accountRepository.findAndCount({
      where: { role, status },
      skip,
      take,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find Accounts by Parent ID and Role
   *
   * Retrieves accounts with specific parent and role.
   *
   * @param {string} parentId - Parent account ID
   * @param {AccountRole} role - Account role to filter
   * @returns {Promise<Account[]>} Array of accounts
   *
   * @example
   * ```typescript
   * const doctors = await repository.findByParentIdAndRole(
   *   'clinic-uuid',
   *   AccountRole.DOCTOR
   * );
   * ```
   */
  async findByParentIdAndRole(
    parentId: string,
    role: AccountRole,
  ): Promise<Account[]> {
    return this.accountRepository.find({
      where: { parentId, role },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find Clinics with Filters
   *
   * Retrieves clinic accounts with advanced filtering capabilities.
   * Supports search by clinic name/description, filtering by province, and filtering by specialty.
   *
   * Filtering Logic:
   * - search: Case-insensitive match (ILIKE) on clinic_manager_information.clinicBranchName AND clinic_manager_information.description
   * - province: Exact match on addresses.provinceName OR addresses.province
   * - specialty: JSONB containment query (@>) on clinic_manager_information.specializedIn
   * - All filters work together with AND logic
   *
   * Note: This method uses QueryBuilder for complex joins and JSONB operations.
   * The filtering is applied at the database level for performance.
   *
   * @param {AccountRole} role - Account role (typically CLINIC_MANAGER)
   * @param {AccountStatus} status - Account status (typically ACTIVE)
   * @param {number} skip - Number of records to skip (for pagination)
   * @param {number} take - Number of records to return (for pagination)
   * @param {string} [search] - Search keyword for clinic name or description
   * @param {string} [province] - Filter by province name or code
   * @param {string} [specialty] - Filter by medical specialization
   * @returns {Promise<[Account[], number]>} Array of clinic accounts and total count
   *
   * @example
   * ```typescript
   * // Find all dental clinics in Hanoi
   * const [clinics, total] = await repository.findClinicsWithFilters(
   *   AccountRole.CLINIC_MANAGER,
   *   AccountStatus.ACTIVE,
   *   0,
   *   10,
   *   undefined,
   *   'Hanoi',
   *   'Dental'
   * );
   *
   * // Find clinics with "Smile" in name
   * const [clinics, total] = await repository.findClinicsWithFilters(
   *   AccountRole.CLINIC_MANAGER,
   *   AccountStatus.ACTIVE,
   *   0,
   *   10,
   *   'Smile'
   * );
   * ```
   */
  async findClinicsWithFilters(
    role: AccountRole,
    status: AccountStatus,
    skip: number = 0,
    take: number = 10,
    search?: string,
    province?: string,
    specialty?: string,
  ): Promise<[Account[], number]> {
    const now = new Date();
    const queryBuilder = this.accountRepository
      .createQueryBuilder('account')
      .leftJoinAndSelect(
        'account.clinicManagerInformation',
        'clinicManagerInfo',
      )
      .leftJoinAndSelect('account.address', 'address')
      .leftJoinAndSelect('account.parent', 'parentAccount')
      .leftJoinAndSelect(
        'parentAccount.clinicAdminInformation',
        'clinicAdminInfo',
      )
      .innerJoin(
        'clinics_legal_documents',
        'legalDoc',
        'legalDoc.account_id = account._id',
      )
      .where('account.role = :role', { role })
      .andWhere('account.status = :status', { status })
      .andWhere('parentAccount.status = :status', { status })
      .andWhere('parentAccount.role = :parentRole', {
        parentRole: AccountRole.CLINIC_ADMIN,
      })
      .innerJoin(
        ClinicSubscription,
        'subscription',
        'subscription.clinic_id = parentAccount._id',
      )
      .andWhere('subscription.subscriptionStatus = :subStatus', {
        subStatus: RegistrationStatus.ACTIVE,
      })
      .andWhere('legalDoc.verification_status = :verifiedStatus', {
        verifiedStatus: LegalDocumentVerificationStatus.APPROVED,
      })
      // Functional Clinic Rule: Must have at least one active doctor/staff
      .andWhere(
        `EXISTS (
          SELECT 1 FROM accounts child
          WHERE child.parent_id = account._id
            AND child.role IN ('DOCTOR', 'CLINIC_STAFF')
            AND child.status = 'ACTIVE'
            AND child.deleted_at IS NULL
        )`,
      )
      // Functional Clinic Rule: Must have at least one active service
      .andWhere(
        `EXISTS (
          SELECT 1 FROM clinic_service_config csc
          WHERE csc.clinic_id = account._id
            AND csc.is_active = true
            AND csc.deleted_at IS NULL
        )`,
      )
      // Functional Clinic Rule: Must have at least one active schedule
      .andWhere(
        `EXISTS (
          SELECT 1 FROM employee_schedule es
          WHERE es.clinic_id = account._id
            AND es.deleted_at IS NULL
        )`,
      );

    // Apply advanced search filter for clinic admin + branch names + array fields
    if (search) {
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where('clinicAdminInfo.clinic_name ILIKE :search', {
            search: `%${search}%`,
          })
            .orWhere('clinicManagerInfo.clinic_branch_name ILIKE :search', {
              search: `%${search}%`,
            })
            .orWhere(
              "CONCAT(COALESCE(clinicAdminInfo.clinic_name, ''), ' - ', COALESCE(clinicManagerInfo.clinic_branch_name, '')) ILIKE :search",
              {
                search: `%${search}%`,
              },
            )
            .orWhere(
              `COALESCE(
                CASE 
                  WHEN jsonb_typeof(clinicAdminInfo.specialized_in) = 'array' THEN 
                    array_to_string(ARRAY(SELECT jsonb_array_elements_text(clinicAdminInfo.specialized_in)), ', ')
                  WHEN jsonb_typeof(clinicAdminInfo.specialized_in) = 'object' THEN 
                    clinicAdminInfo.specialized_in->>'desc'
                  ELSE ''
                END, 
                ''
              ) ILIKE :search`,
              {
                search: `%${search}%`,
              },
            )
            .orWhere(
              `COALESCE(
                CASE 
                  WHEN jsonb_typeof(clinicAdminInfo.pros) = 'array' THEN 
                    array_to_string(ARRAY(SELECT jsonb_array_elements_text(clinicAdminInfo.pros)), ', ')
                  WHEN jsonb_typeof(clinicAdminInfo.pros) = 'object' THEN 
                    clinicAdminInfo.pros->>'desc'
                  ELSE ''
                END, 
                ''
              ) ILIKE :search`,
              {
                search: `%${search}%`,
              },
            );
        }),
      );
    }

    // Apply province filter (exact match on provinceName OR province)
    if (province) {
      queryBuilder.andWhere(
        '(address.provinceName = :province OR address.province = :province)',
        { province },
      );
    }

    // Apply specialty filter (handles both legacy array and new object with desc)
    if (specialty) {
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where('clinicAdminInfo.specializedIn @> :specialtyArray', {
            specialtyArray: JSON.stringify([specialty]),
          }).orWhere('clinicAdminInfo.specializedIn->>\'desc\' ILIKE :specialtyText', {
            specialtyText: `%${specialty}%`,
          });
        }),
      );
    }

    // Apply pagination and ordering
    queryBuilder.skip(skip).take(take).orderBy('account.createdAt', 'DESC');

    return queryBuilder.getManyAndCount();
  }

  async findClinicsAdminWithFilters(
    role: AccountRole,
    skip: number = 0,
    take: number = 10,
    search?: string,
    province?: string,
    specialty?: string,
    includeEmptyClinics: boolean = false,
  ): Promise<[Account[], number]> {
    const now = new Date();
    const queryBuilder = this.accountRepository
      .createQueryBuilder('account')
      .leftJoinAndSelect('account.clinicAdminInformation', 'clinicAdminInfo')
      .leftJoinAndSelect('account.address', 'address')
      .innerJoinAndSelect('account.subscription', 'subscription')
      .where('account.role = :role', { role })
      .andWhere('subscription.subscriptionStatus = ANY(:validStatuses)', {
        validStatuses: [
          RegistrationStatus.ACTIVE,
          RegistrationStatus.NON_RENEWING,
        ],
      })
      .andWhere('subscription.expirationDate >= :now', { now });

    // Functional Clinic Rule: Only apply when includeEmptyClinics is false (default)
    // System admins can bypass this filter to manage newly created clinics
    if (!includeEmptyClinics) {
      queryBuilder
        // Must have at least one active branch (CLINIC_MANAGER)
        .andWhere(
          `EXISTS (
            SELECT 1 FROM accounts branch
            WHERE branch.parent_id = account._id
              AND branch.role = 'CLINIC_MANAGER'
              AND branch.status = 'ACTIVE'
              AND branch.deleted_at IS NULL
          )`,
        )
        // Must have at least one active service across branches
        .andWhere(
          `EXISTS (
            SELECT 1 FROM accounts branch
            INNER JOIN clinic_service_config csc ON csc.clinic_id = branch._id
            WHERE branch.parent_id = account._id
              AND csc.is_active = true
              AND csc.deleted_at IS NULL
          )`,
        )
        // Must have at least one active schedule across branches
        .andWhere(
          `EXISTS (
            SELECT 1 FROM accounts branch
            INNER JOIN employee_schedule es ON es.clinic_id = branch._id
            WHERE branch.parent_id = account._id
              AND es.deleted_at IS NULL
          )`,
        );
    }

    // Apply search filter (address, clinicName, clinicPhone, description, paraclinical, pros, specializedIn)
    if (search) {
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where('clinicAdminInfo.clinicName ILIKE :search', {
            search: `%${search}%`,
          })
            .orWhere('clinicAdminInfo.description ILIKE :search', {
              search: `%${search}%`,
            })
            .orWhere('clinicAdminInfo.clinicPhone ILIKE :search', {
              search: `%${search}%`,
            })
            .orWhere('address.address ILIKE :search', {
              search: `%${search}%`,
            })
            .orWhere('address.provinceName ILIKE :search', {
              search: `%${search}%`,
            })
            .orWhere('address.districtName ILIKE :search', {
              search: `%${search}%`,
            })
            .orWhere('address.wardName ILIKE :search', {
              search: `%${search}%`,
            })
            .orWhere(
              `COALESCE(
                CASE 
                  WHEN jsonb_typeof(clinicAdminInfo.specialized_in) = 'array' THEN 
                    array_to_string(ARRAY(SELECT jsonb_array_elements_text(clinicAdminInfo.specialized_in)), ', ')
                  WHEN jsonb_typeof(clinicAdminInfo.specialized_in) = 'object' THEN 
                    clinicAdminInfo.specialized_in->>'desc'
                  ELSE ''
                END, 
                ''
              ) ILIKE :search`,
              { search: `%${search}%` }
            )
            .orWhere(
              `COALESCE(
                CASE 
                  WHEN jsonb_typeof(clinicAdminInfo.pros) = 'array' THEN 
                    array_to_string(ARRAY(SELECT jsonb_array_elements_text(clinicAdminInfo.pros)), ', ')
                  WHEN jsonb_typeof(clinicAdminInfo.pros) = 'object' THEN 
                    clinicAdminInfo.pros->>'desc'
                  ELSE ''
                END, 
                ''
              ) ILIKE :search`,
              { search: `%${search}%` }
            )
            .orWhere(
              `COALESCE(
                CASE 
                  WHEN jsonb_typeof(clinicAdminInfo.paraclinical) = 'array' THEN 
                    array_to_string(ARRAY(SELECT jsonb_array_elements_text(clinicAdminInfo.paraclinical)), ', ')
                  WHEN jsonb_typeof(clinicAdminInfo.paraclinical) = 'object' THEN 
                    clinicAdminInfo.paraclinical->>'desc'
                  ELSE ''
                END, 
                ''
              ) ILIKE :search`,
              { search: `%${search}%` }
            );
        }),
      );
    }

    // Apply province filter (exact match on provinceName OR province)
    if (province) {
      queryBuilder.andWhere(
        '(address.provinceName = :province OR address.province = :province)',
        { province },
      );
    }

    // Apply specialty filter (handles both legacy array and new object with desc)
    if (specialty) {
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where('clinicAdminInfo.specializedIn @> :specialtyArray', {
            specialtyArray: JSON.stringify([specialty]),
          }).orWhere('clinicAdminInfo.specializedIn->>\'desc\' ILIKE :specialtyText', {
            specialtyText: `%${specialty}%`,
          });
        }),
      );
    }

    // Apply pagination and ordering
    queryBuilder.skip(skip).take(take).orderBy('account.createdAt', 'DESC');

    return queryBuilder.getManyAndCount();
  }

  /**
   * Count Accounts by Role
   *
   * Returns the number of accounts with a specific role.
   *
   * @param {AccountRole} role - Account role to count
   * @returns {Promise<number>} Number of accounts with the specified role
   *
   * @example
   * ```typescript
   * const adminCount = await repository.countByRole(AccountRole.ADMIN);
   * const patientCount = await repository.countByRole(AccountRole.PATIENT);
   * ```
   */
  async countByRole(role: AccountRole): Promise<number> {
    return this.accountRepository.count({
      where: { role },
    });
  }

  /**
   * Find Doctors with Filters
   *
   * Retrieves doctor accounts with advanced filtering capabilities.
   * Supports filtering by clinic (parentId) and gender.
   *
   * Data Sources:
   * - accounts table: Core account data (base table)
   * - doctor_information table: Doctor details (joined via accountId)
   * - clinic_manager_information table: Parent clinic details (joined via parentId)
   *
   * Filtering Logic:
   * - Always: role='DOCTOR', status='ACTIVE', deletedAt IS NULL
   * - Optional: parentId = clinicId (filter by specific clinic)
   * - Optional: doctorInformation.gender = gender (filter by gender)
   * - Always: doctorInformation.deletedAt IS NULL (exclude soft-deleted doctor profiles)
   *
   * @param {AccountRole} role - Account role (DOCTOR)
   * @param {AccountStatus} status - Account status (ACTIVE)
   * @param {number} skip - Number of records to skip (for pagination)
   * @param {number} take - Number of records to return (for pagination)
   * @param {string} [clinicId] - Filter by parent clinic ID
   * @param {string} [gender] - Filter by doctor gender (MALE|FEMALE|OTHER)
   * @returns {Promise<[Account[], number]>} Array of doctor accounts and total count
   *
   * @example
   * ```typescript
   * // Find all active doctors
   * const [doctors, total] = await repository.findDoctorsWithFilters(
   *   AccountRole.DOCTOR,
   *   AccountStatus.ACTIVE,
   *   0,
   *   10
   * );
   *
   * // Find female doctors at specific clinic
   * const [doctors, total] = await repository.findDoctorsWithFilters(
   *   AccountRole.DOCTOR,
   *   AccountStatus.ACTIVE,
   *   0,
   *   10,
   *   'clinic-uuid',
   *   'FEMALE'
   * );
   * ```
   */
  /**
   * Find Doctors with Filters
   *
   * Retrieves doctor accounts with advanced filtering capabilities.
   * Supports filtering by clinic (parentId), gender, academic degree, search term, and date range.
   *
   * @param {AccountRole} role - Account role (DOCTOR)
   * @param {AccountStatus} status - Account status (ACTIVE)
   * @param {number} skip - Number of records to skip
   * @param {number} take - Number of records to return
   * @param {string} [clinicId] - Filter by parent clinic ID
   * @param {string} [gender] - Filter by doctor gender
   * @param {string} [search] - Search keyword
   * @param {string} [academicDegree] - Filter by academic degree
   * @param {string} [fromDate] - Filter by creation date from
   * @param {string} [toDate] - Filter by creation date to
   * @returns {Promise<[Account[], number]>} Array of doctor accounts and total count
   */
  async findDoctorsWithFilters(
    role: AccountRole,
    status: AccountStatus | undefined,
    skip: number = 0,
    take: number = 10,
    clinicId?: string | string[],
    gender?: string,
    search?: string,
    academicDegree?: string,
    fromDate?: string,
    toDate?: string,
  ): Promise<[Account[], number]> {
    const now = new Date();
    const queryBuilder = this.accountRepository
      .createQueryBuilder('account')
      .leftJoinAndSelect('account.doctorInformation', 'doctorInfo')
      .leftJoinAndSelect('account.generalAccount', 'generalAccount')
      .where('account.role = :role', { role })
      .andWhere('account.deletedAt IS NULL');

    if (status) {
      queryBuilder.andWhere('account.status = :status', { status });
    }

    // Apply clinicId filter
    if (clinicId) {
      if (Array.isArray(clinicId)) {
        if (clinicId.length > 0) {
          queryBuilder.andWhere('account.parentId = ANY(:clinicId)', {
            clinicId,
          });
        } else {
          queryBuilder.andWhere('1 = 0');
        }
      } else {
        queryBuilder.andWhere('account.parentId = :clinicId', { clinicId });
      }
    }

    // Apply gender filter (now in SQL directly via join)
    if (gender) {
      queryBuilder.andWhere('doctorInfo.gender = :gender', { gender });
    }

    // Apply search filter
    if (search) {
      queryBuilder.andWhere(
        '(account.username ILIKE :search OR account.email ILIKE :search OR generalAccount.fullName ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Apply academic degree filter
    if (academicDegree) {
      queryBuilder.andWhere('doctorInfo.academicDegree ILIKE :academicDegree', {
        academicDegree: `%${academicDegree}%`,
      });
    }

    // Apply date range filter
    if (fromDate) {
      queryBuilder.andWhere('account.createdAt >= :fromDate', { fromDate });
    }
    if (toDate) {
      queryBuilder.andWhere('account.createdAt <= :toDate', { toDate });
    }

    // Apply pagination and ordering
    queryBuilder.skip(skip).take(take).orderBy('account.createdAt', 'DESC');

    return queryBuilder.getManyAndCount();
  }

  /**
   * Find Staff by Clinic with Filters
   *
   * Retrieves staff accounts for a specific clinic with filtering capabilities.
   *
   * @param {string} clinicId - Clinic ID (parentId)
   * @param {number} skip - Number of records to skip
   * @param {number} take - Number of records to return
   * @param {string} [search] - Search keyword
   * @param {ClinicRole} [role] - Filter by clinic role
   * @param {string} [fromDate] - Filter by creation date from
   * @param {string} [toDate] - Filter by creation date to
   * @returns {Promise<[Account[], number]>} Array of staff accounts and total count
   */
  async findStaffByClinicWithFilters(
    clinicId: string | string[],
    skip: number = 0,
    take: number = 10,
    search?: string,
    role?: ClinicRole,
    status?: AccountStatus,
    fromDate?: string,
    toDate?: string,
  ): Promise<[Account[], number]> {
    const now = new Date();
    const queryBuilder = this.accountRepository
      .createQueryBuilder('account')
      .leftJoinAndSelect('account.clinicStaffInformation', 'staffInfo')
      .leftJoinAndSelect('account.generalAccount', 'generalAccount');

    if (Array.isArray(clinicId)) {
      if (clinicId.length > 0) {
        queryBuilder.where('account.parentId = ANY(:clinicId)', { clinicId });
      } else {
        queryBuilder.where('1 = 0'); // Empty result if no parent IDs
      }
    } else {
      queryBuilder.where('account.parentId = :clinicId', { clinicId });
    }

    queryBuilder.andWhere('account.role = :accountRole', {
      accountRole: AccountRole.CLINIC_STAFF,
    });

    if (status) {
      queryBuilder.andWhere('account.status = :status', { status });
    }
    queryBuilder.andWhere('account.deletedAt IS NULL');

    // Apply search filter
    if (search) {
      queryBuilder.andWhere(
        '(account.username ILIKE :search OR account.email ILIKE :search OR generalAccount.fullName ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Apply clinic role filter
    if (role) {
      queryBuilder.andWhere('staffInfo.clinicRole = :role', { role });
    }

    // Apply date range filter
    if (fromDate) {
      queryBuilder.andWhere('account.createdAt >= :fromDate', { fromDate });
    }
    if (toDate) {
      queryBuilder.andWhere('account.createdAt <= :toDate', { toDate });
    }

    // Apply pagination and ordering
    queryBuilder.skip(skip).take(take).orderBy('account.createdAt', 'DESC');

    return queryBuilder.getManyAndCount();
  }

  /**
   * Find Employees by Clinic (Legacy/Simple)
   * Kept for backward compatibility if used elsewhere without pagination
   */
  async findEmployeesByClinicWithFilters(
    clinicId: string,
    role?: AccountRole,
    search?: string,
  ): Promise<Account[]> {
    const queryBuilder = this.accountRepository.createQueryBuilder('account');

    queryBuilder.leftJoinAndSelect('account.generalAccount', 'generalAccount');
    // Join with specific info tables for more detailed search if needed (optional)
    queryBuilder.leftJoinAndSelect(
      'account.clinicStaffInformation',
      'staffInfo',
    );
    queryBuilder.leftJoinAndSelect('account.doctorInformation', 'doctorInfo');

    queryBuilder.where('account.parentId = :clinicId', { clinicId });
    queryBuilder.andWhere('account.deletedAt IS NULL');

    if (role) {
      queryBuilder.andWhere('account.role = :role', { role });
    } else {
      queryBuilder.andWhere('account.role = ANY(:roles)', {
        roles: [AccountRole.DOCTOR, AccountRole.CLINIC_STAFF],
      });
    }

    if (search) {
      queryBuilder.andWhere(
        '(account.username ILIKE :search OR account.email ILIKE :search OR generalAccount.fullName ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    queryBuilder.orderBy('account.createdAt', 'DESC');

    return queryBuilder.getMany();
  }

  /**
   * Find Managers by Status
   * Utility method for filtering managers by status
   *
   * @param clinicAdminId - Parent admin ID
   * @param statuses - Array of statuses to filter
   * @returns Array of manager accounts
   */
  async findManagersByStatus(
    clinicAdminId: string,
    statuses: AccountStatus[],
  ): Promise<Account[]> {
    if (!statuses || statuses.length === 0) {
      return [];
    }
    return this.accountRepository
      .createQueryBuilder('account')
      .leftJoinAndSelect(
        'account.clinicManagerInformation',
        'clinicManagerInformation',
      )
      .where('account.parentId = :clinicAdminId', { clinicAdminId })
      .andWhere('account.role = :role', { role: AccountRole.CLINIC_MANAGER })
      .andWhere('account.status = ANY(:statuses)', { statuses })
      .andWhere('account.deletedAt IS NULL')
      .getMany();
  }

  /**
   * Count Personnel Under Manager
   * Counts Staff and Doctor accounts for a given manager
   *
   * @param managerId - Manager account ID
   * @returns Object with staffCount and doctorCount
   */
  async countPersonnelByManager(
    managerId: string,
  ): Promise<{ staffCount: number; doctorCount: number }> {
    const counts = await this.accountRepository
      .createQueryBuilder('account')
      .select(
        'COALESCE(SUM(CASE WHEN account.role = :staffRole THEN 1 ELSE 0 END), 0)',
        'staffCount',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN account.role = :doctorRole THEN 1 ELSE 0 END), 0)',
        'doctorCount',
      )
      .where('account.parent_id = :managerId', { managerId })
      .andWhere('account.deleted_at IS NULL')
      .setParameters({
        staffRole: AccountRole.CLINIC_STAFF,
        doctorRole: AccountRole.DOCTOR,
      })
      .getRawOne<{ staffCount: string; doctorCount: string }>();

    return {
      staffCount: parseInt(counts?.staffCount ?? '0', 10),
      doctorCount: parseInt(counts?.doctorCount ?? '0', 10),
    };
  }
}
