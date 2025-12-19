import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { GeneralAccount } from '../entities/general_accounts.entity';

/**
 * GeneralAccount Repository
 *
 * Handles all direct database operations for the GeneralAccount entity.
 * This layer is responsible for data access only, no business logic.
 */
@Injectable()
export class GeneralAccountRepository {
  constructor(
    @InjectRepository(GeneralAccount)
    private readonly repository: Repository<GeneralAccount>,
  ) {}

  /**
   * Find all general accounts
   */
  async findAll(includeDeleted: boolean = false): Promise<GeneralAccount[]> {
    return this.repository.find({
      withDeleted: includeDeleted,
    });
  }

  /**
   * Find general account by ID
   */
  async findById(id: string): Promise<GeneralAccount | null> {
    return this.repository.findOne({
      where: { id },
    });
  }

  /**
   * Find general account by account ID
   */
  async findByAccountId(accountId: string): Promise<GeneralAccount | null> {
    return this.repository.findOne({
      where: { generalAccId: accountId },
    });
  }

  /**
   * Find general account by account ID including soft-deleted
   */
  async findByAccountIdWithDeleted(
    accountId: string,
  ): Promise<GeneralAccount | null> {
    return this.repository.findOne({
      where: { generalAccId: accountId },
      withDeleted: true,
    });
  }

  /**
   * Create general account entity (without saving)
   */
  create(data: DeepPartial<GeneralAccount>): GeneralAccount {
    return this.repository.create(data);
  }

  /**
   * Save general account entity
   */
  async save(generalAccount: GeneralAccount): Promise<GeneralAccount> {
    return this.repository.save(generalAccount);
  }

  /**
   * Update general account by ID
   */
  async update(
    id: string,
    data: DeepPartial<GeneralAccount>,
  ): Promise<GeneralAccount | null> {
    await this.repository.update(id, data);
    return this.findById(id);
  }

  /**
   * Update general account by account ID
   */
  async updateByAccountId(
    accountId: string,
    data: DeepPartial<GeneralAccount>,
  ): Promise<GeneralAccount | null> {
    await this.repository.update({ generalAccId: accountId }, data);
    return this.findByAccountId(accountId);
  }

  /**
   * Soft delete general account
   */
  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }

  /**
   * Soft delete general account by account ID
   */
  async softDeleteByAccountId(accountId: string): Promise<void> {
    await this.repository.softDelete({ generalAccId: accountId });
  }

  /**
   * Hard delete general account
   */
  async delete(id: string): Promise<number> {
    const result = await this.repository.delete(id);
    return result.affected || 0;
  }

  /**
   * Hard delete general account by account ID
   */
  async deleteByAccountId(accountId: string): Promise<number> {
    const result = await this.repository.delete({ generalAccId: accountId });
    return result.affected || 0;
  }

  /**
   * Restore soft-deleted general account
   */
  async restore(id: string): Promise<void> {
    await this.repository.restore(id);
  }

  /**
   * Restore soft-deleted general account by account ID
   */
  async restoreByAccountId(accountId: string): Promise<void> {
    await this.repository.restore({ generalAccId: accountId });
  }

  /**
   * Check if general account exists by account ID
   */
  async existsByAccountId(accountId: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { generalAccId: accountId },
    });
    return count > 0;
  }
}
