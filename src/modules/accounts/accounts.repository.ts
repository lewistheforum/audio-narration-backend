import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, FindOptionsWhere, DeepPartial } from 'typeorm';
import { Account } from './entities/accounts.entity';
import { GeneralAccount } from './entities/general_accounts.entity';

/**
 * Accounts Repository
 *
 * Data access layer for Account and GeneralAccount entities.
 * Implements the Repository Pattern to separate data access logic from business logic.
 *
 * Responsibilities:
 * - Direct database operations (CRUD)
 * - Query construction and execution
 * - No business logic (handled by AccountsService)
 * - No validation (handled by DTOs and Service)
 *
 * Architecture:
 * - Uses TypeORM Repository pattern
 * - Supports two entities: Account and GeneralAccount
 * - Provides both individual and bulk operations
 * - Implements soft delete functionality
 *
 * Design Principles:
 * - Single Responsibility: Only handles data access
 * - Separation of Concerns: No business logic
 * - Testability: Easy to mock for unit tests
 * - Maintainability: Centralized query logic
 *
 * @class AccountsRepository
 * @injectable
 */
@Injectable()
export class AccountsRepository {
  /**
   * Constructs the AccountsRepository with TypeORM repositories
   *
   * @param {Repository<Account>} accountRepository - TypeORM repository for Account entity
   * @param {Repository<GeneralAccount>} generalAccountRepository - TypeORM repository for GeneralAccount entity
   */
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(GeneralAccount)
    private readonly generalAccountRepository: Repository<GeneralAccount>,
  ) {}

  // ==================== ACCOUNT ENTITY OPERATIONS ====================

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
   * const activeAccounts = await repository.findAllUsers();
   * const allAccounts = await repository.findAllUsers(true);
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
      where: { id },
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
      where: { id },
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
      where: { id: In(ids) },
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

  // ==================== GENERAL ACCOUNT ENTITY OPERATIONS ====================

  /**
   * Find GeneralAccount by User ID
   *
   * Retrieves the GeneralAccount entity associated with an Account.
   * Returns null if no GeneralAccount exists for the given user.
   *
   * Use Cases:
   * - Loading extended profile data (fullName, gender)
   * - Building complete user profiles
   * - Profile display in UI
   *
   * Note:
   * - Not all accounts have a GeneralAccount (optional relationship)
   * - Accounts created before GeneralAccount feature may return null
   *
   * @param {string} userId - Account UUID (matches generalAccId in GeneralAccount)
   * @returns {Promise<GeneralAccount | null>} GeneralAccount entity or null if not found
   *
   * @example
   * ```typescript
   * const generalAccount = await repository.findGeneralAccountByUserId('uuid');
   * if (generalAccount) {
   *   console.log(generalAccount.fullName, generalAccount.gender);
   * }
   * ```
   */
  async findGeneralAccountByUserId(
    userId: string,
  ): Promise<GeneralAccount | null> {
    return this.generalAccountRepository.findOne({
      where: { generalAccId: userId },
    });
  }

  /**
   * Create GeneralAccount Entity
   *
   * Creates a GeneralAccount entity instance without persisting to database.
   * Use saveGeneralAccount() to persist the created entity.
   *
   * Pattern:
   * - Create entity with data
   * - Modify as needed
   * - Save to database
   *
   * @param {DeepPartial<GeneralAccount>} data - GeneralAccount data (partial object)
   * @returns {GeneralAccount} Unpersisted GeneralAccount entity instance
   *
   * @example
   * ```typescript
   * const generalAccount = repository.createGeneralAccount({
   *   generalAccId: 'account-uuid',
   *   fullName: 'John Doe',
   *   gender: Gender.MALE
   * });
   * await repository.saveGeneralAccount(generalAccount);
   * ```
   */
  createGeneralAccount(data: DeepPartial<GeneralAccount>): GeneralAccount {
    return this.generalAccountRepository.create(data);
  }

  /**
   * Save GeneralAccount Entity
   *
   * Persists a GeneralAccount entity to the database.
   * Performs INSERT for new entities, UPDATE for existing entities.
   *
   * Behavior:
   * - Updates timestamps (createdAt, updatedAt)
   * - Returns the saved entity with updated fields
   * - generalAccId must match an existing Account.id (foreign key)
   *
   * @param {GeneralAccount} generalAccount - GeneralAccount entity to save
   * @returns {Promise<GeneralAccount>} Saved GeneralAccount entity
   *
   * @example
   * ```typescript
   * const generalAccount = repository.createGeneralAccount({ ... });
   * const saved = await repository.saveGeneralAccount(generalAccount);
   * ```
   */
  async saveGeneralAccount(
    generalAccount: GeneralAccount,
  ): Promise<GeneralAccount> {
    return this.generalAccountRepository.save(generalAccount);
  }

  /**
   * Soft Delete GeneralAccount
   *
   * Marks a GeneralAccount as deleted by setting the deletedAt timestamp.
   * Typically called when soft-deleting the parent Account.
   *
   * Effects:
   * - Sets deletedAt to current timestamp
   * - GeneralAccount excluded from default queries
   * - Can be recovered with restoreGeneralAccount()
   *
   * @param {string} userId - Account UUID (generalAccId)
   * @returns {Promise<void>} No return value
   *
   * @example
   * ```typescript
   * await repository.softDeleteGeneralAccount('account-uuid');
   * ```
   */
  async softDeleteGeneralAccount(userId: string): Promise<void> {
    await this.generalAccountRepository.softDelete({ generalAccId: userId });
  }

  /**
   * Hard Delete GeneralAccount
   *
   * Permanently removes a GeneralAccount from the database.
   * This operation is irreversible.
   *
   * WARNING:
   * - Call this BEFORE deleting the parent Account (foreign key constraint)
   * - Use soft delete for most cases
   *
   * @param {string} userId - Account UUID (generalAccId)
   * @returns {Promise<void>} No return value
   *
   * @example
   * ```typescript
   * // Delete order for foreign keys:
   * await repository.deleteGeneralAccount('account-uuid');
   * await repository.deleteUser('account-uuid');
   * ```
   */
  async deleteGeneralAccount(userId: string): Promise<void> {
    await this.generalAccountRepository.delete({ generalAccId: userId });
  }

  /**
   * Restore Soft-Deleted GeneralAccount
   *
   * Clears the deletedAt timestamp to restore a soft-deleted GeneralAccount.
   * Typically called when restoring the parent Account.
   *
   * Requirements:
   * - GeneralAccount must have been soft-deleted (deletedAt IS NOT NULL)
   *
   * @param {string} userId - Account UUID (generalAccId)
   * @returns {Promise<void>} No return value
   *
   * @example
   * ```typescript
   * // Restore order:
   * await repository.restoreUser('account-uuid');
   * await repository.restoreGeneralAccount('account-uuid');
   * ```
   */
  async restoreGeneralAccount(userId: string): Promise<void> {
    await this.generalAccountRepository.restore({ generalAccId: userId });
  }
}
