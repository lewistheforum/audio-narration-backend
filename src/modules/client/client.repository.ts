import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, FindOptionsWhere, DeepPartial } from 'typeorm';
import { User } from './entities/accounts.entity';
import { GeneralAccount } from './entities/general_accounts.entity';

/**
 * Client Repository
 *
 * Handles all direct database operations for User and GeneralAccount entities.
 * This layer is responsible for data access only, no business logic.
 */
@Injectable()
export class ClientRepository {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(GeneralAccount)
    private readonly generalAccountRepository: Repository<GeneralAccount>,
  ) {}

  // ==================== USER ENTITY OPERATIONS ====================

  /**
   * Find all users with optional soft-deleted inclusion
   */
  async findAllUsers(includeDeleted: boolean = false): Promise<User[]> {
    return this.userRepository.find({
      withDeleted: includeDeleted,
    });
  }

  /**
   * Find user by ID
   */
  async findUserById(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
    });
  }

  /**
   * Find user by ID including soft-deleted
   */
  async findUserByIdWithDeleted(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      withDeleted: true,
    });
  }

  /**
   * Find user by email
   */
  async findUserByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
    });
  }

  /**
   * Find multiple users by IDs
   */
  async findUsersByIds(ids: string[]): Promise<User[]> {
    if (!ids || ids.length === 0) {
      return [];
    }
    return this.userRepository.find({
      where: { id: In(ids) },
    });
  }

  /**
   * Create user entity (without saving)
   */
  createUser(data: DeepPartial<User>): User {
    return this.userRepository.create(data);
  }

  /**
   * Save user entity
   */
  async saveUser(user: User): Promise<User> {
    return this.userRepository.save(user);
  }

  /**
   * Soft delete user
   */
  async softDeleteUser(id: string): Promise<void> {
    await this.userRepository.softDelete(id);
  }

  /**
   * Hard delete user
   */
  async deleteUser(id: string): Promise<number> {
    const result = await this.userRepository.delete(id);
    return result.affected || 0;
  }

  /**
   * Restore soft-deleted user
   */
  async restoreUser(id: string): Promise<void> {
    await this.userRepository.restore(id);
  }

  // ==================== GENERAL ACCOUNT ENTITY OPERATIONS ====================

  /**
   * Find general account by user ID
   */
  async findGeneralAccountByUserId(
    userId: string,
  ): Promise<GeneralAccount | null> {
    return this.generalAccountRepository.findOne({
      where: { generalAccId: userId },
    });
  }

  /**
   * Create general account entity (without saving)
   */
  createGeneralAccount(data: DeepPartial<GeneralAccount>): GeneralAccount {
    return this.generalAccountRepository.create(data);
  }

  /**
   * Save general account entity
   */
  async saveGeneralAccount(
    generalAccount: GeneralAccount,
  ): Promise<GeneralAccount> {
    return this.generalAccountRepository.save(generalAccount);
  }

  /**
   * Soft delete general account
   */
  async softDeleteGeneralAccount(userId: string): Promise<void> {
    await this.generalAccountRepository.softDelete({ generalAccId: userId });
  }

  /**
   * Hard delete general account
   */
  async deleteGeneralAccount(userId: string): Promise<void> {
    await this.generalAccountRepository.delete({ generalAccId: userId });
  }

  /**
   * Restore soft-deleted general account
   */
  async restoreGeneralAccount(userId: string): Promise<void> {
    await this.generalAccountRepository.restore({ generalAccId: userId });
  }
}
