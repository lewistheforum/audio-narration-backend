import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { GoogleIframe } from '../entities/google_iframe.entity';

/**
 * GoogleIframe Repository
 *
 * Handles all direct database operations for the GoogleIframe entity.
 * This layer is responsible for data access only, no business logic.
 */
@Injectable()
export class GoogleIframeRepository {
  constructor(
    @InjectRepository(GoogleIframe)
    private readonly repository: Repository<GoogleIframe>,
  ) {}

  /**
   * Find all google iframe records
   */
  async findAll(includeDeleted: boolean = false): Promise<GoogleIframe[]> {
    return this.repository.find({
      withDeleted: includeDeleted,
    });
  }

  /**
   * Find google iframe by ID
   */
  async findById(id: string): Promise<GoogleIframe | null> {
    return this.repository.findOne({
      where: { _id: id },
    });
  }

  /**
   * Find google iframe by address ID
   */
  async findByAddressId(addressId: string): Promise<GoogleIframe | null> {
    return this.repository.findOne({
      where: { addressId },
    });
  }

  /**
   * Find google iframe by address ID including soft-deleted
   */
  async findByAddressIdWithDeleted(
    addressId: string,
  ): Promise<GoogleIframe | null> {
    return this.repository.findOne({
      where: { addressId },
      withDeleted: true,
    });
  }

  /**
   * Create google iframe entity (without saving)
   */
  create(data: DeepPartial<GoogleIframe>): GoogleIframe {
    return this.repository.create(data);
  }

  /**
   * Save google iframe entity
   */
  async save(googleIframe: GoogleIframe): Promise<GoogleIframe> {
    return this.repository.save(googleIframe);
  }

  /**
   * Update google iframe by ID
   */
  async update(
    id: string,
    data: DeepPartial<GoogleIframe>,
  ): Promise<GoogleIframe | null> {
    await this.repository.update(id, data);
    return this.findById(id);
  }

  /**
   * Update google iframe by address ID
   */
  async updateByAddressId(
    addressId: string,
    data: DeepPartial<GoogleIframe>,
  ): Promise<GoogleIframe | null> {
    await this.repository.update({ addressId }, data);
    return this.findByAddressId(addressId);
  }

  /**
   * Soft delete google iframe
   */
  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }

  /**
   * Soft delete google iframe by address ID
   */
  async softDeleteByAddressId(addressId: string): Promise<void> {
    await this.repository.softDelete({ addressId });
  }

  /**
   * Hard delete google iframe
   */
  async delete(id: string): Promise<number> {
    const result = await this.repository.delete(id);
    return result.affected || 0;
  }

  /**
   * Hard delete google iframe by address ID
   */
  async deleteByAddressId(addressId: string): Promise<number> {
    const result = await this.repository.delete({ addressId });
    return result.affected || 0;
  }

  /**
   * Restore soft-deleted google iframe
   */
  async restore(id: string): Promise<void> {
    await this.repository.restore(id);
  }

  /**
   * Restore soft-deleted google iframe by address ID
   */
  async restoreByAddressId(addressId: string): Promise<void> {
    await this.repository.restore({ addressId });
  }

  /**
   * Check if google iframe exists by address ID
   */
  async existsByAddressId(addressId: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { addressId },
    });
    return count > 0;
  }
}
