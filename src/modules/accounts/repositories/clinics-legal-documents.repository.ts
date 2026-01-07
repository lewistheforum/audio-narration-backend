import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { ClinicsLegalDocuments } from '../entities/clinics_legal_documents.entity';

/**
 * ClinicsLegalDocuments Repository
 *
 * Handles all direct database operations for the ClinicsLegalDocuments entity.
 * This layer is responsible for data access only, no business logic.
 */
@Injectable()
export class ClinicsLegalDocumentsRepository {
  constructor(
    @InjectRepository(ClinicsLegalDocuments)
    private readonly repository: Repository<ClinicsLegalDocuments>,
  ) {}

  /**
   * Find all clinics legal documents
   */
  async findAll(
    includeDeleted: boolean = false,
  ): Promise<ClinicsLegalDocuments[]> {
    return this.repository.find({
      withDeleted: includeDeleted,
    });
  }

  /**
   * Find clinics legal documents by ID
   */
  async findById(id: string): Promise<ClinicsLegalDocuments | null> {
    return this.repository.findOne({
      where: { _id: id },
    });
  }

  /**
   * Find clinics legal documents by account ID
   */
  async findByAccountId(
    accountId: string,
  ): Promise<ClinicsLegalDocuments | null> {
    return this.repository.findOne({
      where: { accountId },
    });
  }

  /**
   * Find clinics legal documents by account ID including soft-deleted
   */
  async findByAccountIdWithDeleted(
    accountId: string,
  ): Promise<ClinicsLegalDocuments | null> {
    return this.repository.findOne({
      where: { accountId },
      withDeleted: true,
    });
  }

  /**
   * Create clinics legal documents entity (without saving)
   */
  create(data: DeepPartial<ClinicsLegalDocuments>): ClinicsLegalDocuments {
    return this.repository.create(data);
  }

  /**
   * Save clinics legal documents entity
   */
  async save(
    legalDocs: ClinicsLegalDocuments,
  ): Promise<ClinicsLegalDocuments> {
    return this.repository.save(legalDocs);
  }

  /**
   * Update clinics legal documents by ID
   */
  async update(
    id: string,
    data: DeepPartial<ClinicsLegalDocuments>,
  ): Promise<ClinicsLegalDocuments | null> {
    await this.repository.update(id, data);
    return this.findById(id);
  }

  /**
   * Update clinics legal documents by account ID
   */
  async updateByAccountId(
    accountId: string,
    data: DeepPartial<ClinicsLegalDocuments>,
  ): Promise<ClinicsLegalDocuments | null> {
    await this.repository.update({ accountId }, data);
    return this.findByAccountId(accountId);
  }

  /**
   * Soft delete clinics legal documents
   */
  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }

  /**
   * Soft delete clinics legal documents by account ID
   */
  async softDeleteByAccountId(accountId: string): Promise<void> {
    await this.repository.softDelete({ accountId });
  }

  /**
   * Hard delete clinics legal documents
   */
  async delete(id: string): Promise<number> {
    const result = await this.repository.delete(id);
    return result.affected || 0;
  }

  /**
   * Hard delete clinics legal documents by account ID
   */
  async deleteByAccountId(accountId: string): Promise<number> {
    const result = await this.repository.delete({ accountId });
    return result.affected || 0;
  }

  /**
   * Restore soft-deleted clinics legal documents
   */
  async restore(id: string): Promise<void> {
    await this.repository.restore(id);
  }

  /**
   * Restore soft-deleted clinics legal documents by account ID
   */
  async restoreByAccountId(accountId: string): Promise<void> {
    await this.repository.restore({ accountId });
  }

  /**
   * Check if clinics legal documents exists by account ID
   */
  async existsByAccountId(accountId: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { accountId },
    });
    return count > 0;
  }
}
