import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial, LessThan, MoreThan } from 'typeorm';
import { CodeVerification } from '../entities/code_verification.entity';
import { VerificationType } from '../enums';

/**
 * CodeVerification Repository
 *
 * Handles all direct database operations for the CodeVerification entity.
 * This layer is responsible for data access only, no business logic.
 */
@Injectable()
export class CodeVerificationRepository {
  constructor(
    @InjectRepository(CodeVerification)
    private readonly repository: Repository<CodeVerification>,
  ) {}

  /**
   * Find all code verification records
   */
  async findAll(
    includeDeleted: boolean = false,
  ): Promise<CodeVerification[]> {
    return this.repository.find({
      withDeleted: includeDeleted,
    });
  }

  /**
   * Find code verification by ID
   */
  async findById(id: string): Promise<CodeVerification | null> {
    return this.repository.findOne({
      where: { _id: id },
    });
  }

  /**
   * Find code verification by user ID and code
   */
  async findByUserIdAndCode(
    userId: string,
    code: string,
  ): Promise<CodeVerification | null> {
    return this.repository.findOne({
      where: { userId, code },
    });
  }

  /**
   * Find code verification by user ID, code and type
   */
  async findByUserIdCodeAndType(
    userId: string,
    code: string,
    type: VerificationType,
  ): Promise<CodeVerification | null> {
    return this.repository.findOne({
      where: { userId, code, type },
    });
  }

  /**
   * Find valid (unused and not expired) code verification by user ID and code
   */
  async findValidByUserIdAndCode(
    userId: string,
    code: string,
    type: VerificationType,
  ): Promise<CodeVerification | null> {
    return this.repository.findOne({
      where: {
        userId,
        code,
        type,
        used: false,
        expiredAt: MoreThan(new Date()),
      },
    });
  }

  /**
   * Find all code verifications by user ID
   */
  async findByUserId(userId: string): Promise<CodeVerification[]> {
    return this.repository.find({
      where: { userId },
    });
  }

  /**
   * Find all code verifications by user ID and type
   */
  async findByUserIdAndType(
    userId: string,
    type: VerificationType,
  ): Promise<CodeVerification[]> {
    return this.repository.find({
      where: { userId, type },
    });
  }

  /**
   * Create code verification entity (without saving)
   */
  create(data: DeepPartial<CodeVerification>): CodeVerification {
    // Validate required fields to prevent NULL values in database
    if (!data.code) {
      throw new Error('CodeVerification: code field is required and cannot be empty');
    }
    if (!data.userId) {
      throw new Error('CodeVerification: userId field is required');
    }
    if (!data.expiredAt) {
      throw new Error('CodeVerification: expiredAt field is required');
    }
    if (!data.type) {
      throw new Error('CodeVerification: type field is required');
    }
    
    return this.repository.create(data);
  }

  /**
   * Save code verification entity
   */
  async save(codeVerification: CodeVerification): Promise<CodeVerification> {
    return this.repository.save(codeVerification);
  }

  /**
   * Update code verification by ID
   */
  async update(
    id: string,
    data: DeepPartial<CodeVerification>,
  ): Promise<CodeVerification | null> {
    // Validate that if code is being updated, it's not empty
    if ('code' in data && !data.code) {
      throw new Error('CodeVerification: code field cannot be empty');
    }
    
    await this.repository.update(id, data);
    return this.findById(id);
  }

  /**
   * Mark code as used
   */
  async markAsUsed(id: string): Promise<void> {
    await this.repository.update(id, { used: true });
  }

  /**
   * Soft delete code verification
   */
  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }

  /**
   * Soft delete all code verifications by user ID
   */
  async softDeleteByUserId(userId: string): Promise<void> {
    await this.repository.softDelete({ userId });
  }

  /**
   * Hard delete code verification
   */
  async delete(id: string): Promise<number> {
    const result = await this.repository.delete(id);
    return result.affected || 0;
  }

  /**
   * Hard delete all code verifications by user ID
   */
  async deleteByUserId(userId: string): Promise<number> {
    const result = await this.repository.delete({ userId });
    return result.affected || 0;
  }

  /**
   * Delete expired code verifications
   */
  async deleteExpired(): Promise<number> {
    const result = await this.repository.delete({
      expiredAt: LessThan(new Date()),
    });
    return result.affected || 0;
  }

  /**
   * Restore soft-deleted code verification
   */
  async restore(id: string): Promise<void> {
    await this.repository.restore(id);
  }

  /**
   * Check if valid code exists for user
   */
  async hasValidCode(
    userId: string,
    type: VerificationType,
  ): Promise<boolean> {
    const count = await this.repository.count({
      where: {
        userId,
        type,
        used: false,
        expiredAt: MoreThan(new Date()),
      },
    });
    return count > 0;
  }
}
