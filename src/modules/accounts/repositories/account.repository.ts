import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DeepPartial, FindOptionsWhere } from 'typeorm';
import { Account } from '../entities/accounts.entity';
import { AccountRole, AccountStatus } from '../enums';

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
    return this.accountRepository.findOne({
      where: { _id: id },
    });
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
  async findAccountByEmail(email: string): Promise<Account | null> {
    return this.accountRepository.findOne({
      where: { email },
    });
  }

  /**
   * Find Multiple Accounts by IDs
   *
   * Batch retrieval of accounts using SQL IN clause.
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
    return this.accountRepository.find({
      where: { _id: In(ids) },
    });
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
   * - search: Case-insensitive match (ILIKE) on clinic_information.clinicName AND clinic_information.description
   * - province: Exact match on addresses.provinceName OR addresses.province
   * - specialty: JSONB containment query (@>) on clinic_information.specializedIn
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
    const queryBuilder = this.accountRepository
      .createQueryBuilder('account')
      .leftJoinAndSelect(
        'account.clinicInformation',
        'clinicInfo',
      )
      .leftJoinAndSelect('account.addresses', 'address')
      .where('account.role = :role', { role })
      .andWhere('account.status = :status', { status });

    // Apply search filter (ILIKE on clinicName AND description)
    if (search) {
      queryBuilder.andWhere(
        '(clinicInfo.clinicName ILIKE :search OR clinicInfo.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Apply province filter (exact match on provinceName OR province)
    if (province) {
      queryBuilder.andWhere(
        '(address.provinceName = :province OR address.province = :province)',
        { province },
      );
    }

    // Apply specialty filter (JSONB containment query on specializedIn)
    if (specialty) {
      queryBuilder.andWhere(
        'clinicInfo.specializedIn @> :specialty',
        { specialty: JSON.stringify([specialty]) },
      );
    }

    // Apply pagination and ordering
    queryBuilder
      .skip(skip)
      .take(take)
      .orderBy('account.createdAt', 'DESC');

    return queryBuilder.getManyAndCount();
  }
}
