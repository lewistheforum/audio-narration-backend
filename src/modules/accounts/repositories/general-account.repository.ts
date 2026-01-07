import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { GeneralAccount } from '../entities/general_accounts.entity';

/**
 * GeneralAccount Repository
 *
 * Data access layer for GeneralAccount entity.
 * Implements the Repository Pattern to separate data access logic from business logic.
 *
 * Responsibilities:
 * - Direct database operations (CRUD) for GeneralAccount entity
 * - Query construction and execution
 * - No business logic (handled by AccountsService)
 * - No validation (handled by DTOs and Service)
 *
 * Architecture:
 * - Uses TypeORM Repository pattern
 * - Single entity: GeneralAccount
 * - Provides both individual and bulk operations
 * - Implements soft delete functionality
 *
 * Design Principles:
 * - Single Responsibility: Only handles GeneralAccount data access
 * - Separation of Concerns: No business logic
 * - Testability: Easy to mock for unit tests
 * - Maintainability: Centralized query logic
 *
 * @class GeneralAccountRepository
 * @injectable
 */
@Injectable()
export class GeneralAccountRepository {
  /**
   * Constructs the GeneralAccountRepository with TypeORM repository
   *
   * @param {Repository<GeneralAccount>} generalAccountRepository - TypeORM repository for GeneralAccount entity
   */
  constructor(
    @InjectRepository(GeneralAccount)
    private readonly generalAccountRepository: Repository<GeneralAccount>,
  ) {}

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
