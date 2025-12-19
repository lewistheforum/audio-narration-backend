import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DeepPartial } from 'typeorm';
import { Account } from '../entities/accounts.entity';
import { AccountRole } from '../enums';

/**
 * Account Repository
 *
 * Handles all direct database operations for the Account entity.
 * This layer is responsible for data access only, no business logic.
 */
@Injectable()
export class AccountRepository {
  constructor(
    @InjectRepository(Account)
    private readonly repository: Repository<Account>,
  ) {}

  /**
   * Find all accounts with optional soft-deleted inclusion
   */
  async findAll(includeDeleted: boolean = false): Promise<Account[]> {
    return this.repository.find({
      withDeleted: includeDeleted,
    });
  }

  /**
   * Find account by ID
   */
  async findById(id: string): Promise<Account | null> {
    return this.repository.findOne({
      where: { id },
    });
  }

  /**
   * Find account by ID including soft-deleted
   */
  async findByIdWithDeleted(id: string): Promise<Account | null> {
    return this.repository.findOne({
      where: { id },
      withDeleted: true,
    });
  }

  /**
   * Find account by email
   */
  async findByEmail(email: string): Promise<Account | null> {
    return this.repository.findOne({
      where: { email },
    });
  }

  /**
   * Find account by email including soft-deleted
   */
  async findByEmailWithDeleted(email: string): Promise<Account | null> {
    return this.repository.findOne({
      where: { email },
      withDeleted: true,
    });
  }

  /**
   * Find multiple accounts by IDs
   */
  async findByIds(ids: string[]): Promise<Account[]> {
    if (!ids || ids.length === 0) {
      return [];
    }
    return this.repository.find({
      where: { id: In(ids) },
    });
  }

  /**
   * Find accounts by parent ID
   */
  async findByParentId(parentId: string): Promise<Account[]> {
    return this.repository.find({
      where: { parentId },
    });
  }

  /**
   * Find accounts by role
   */
  async findByRole(role: AccountRole): Promise<Account[]> {
    return this.repository.find({
      where: { role },
    });
  }

  /**
   * Create account entity (without saving)
   */
  create(data: DeepPartial<Account>): Account {
    return this.repository.create(data);
  }

  /**
   * Save account entity
   */
  async save(account: Account): Promise<Account> {
    return this.repository.save(account);
  }

  /**
   * Update account by ID
   */
  async update(
    id: string,
    data: DeepPartial<Account>,
  ): Promise<Account | null> {
    await this.repository.update(id, data);
    return this.findById(id);
  }

  /**
   * Soft delete account
   */
  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }

  /**
   * Hard delete account
   */
  async delete(id: string): Promise<number> {
    const result = await this.repository.delete(id);
    return result.affected || 0;
  }

  /**
   * Restore soft-deleted account
   */
  async restore(id: string): Promise<void> {
    await this.repository.restore(id);
  }

  /**
   * Count accounts
   */
  async count(): Promise<number> {
    return this.repository.count();
  }

  /**
   * Check if account exists by ID
   */
  async existsById(id: string): Promise<boolean> {
    const count = await this.repository.count({ where: { id } });
    return count > 0;
  }

  /**
   * Check if account exists by email
   */
  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.repository.count({ where: { email } });
    return count > 0;
  }
}
