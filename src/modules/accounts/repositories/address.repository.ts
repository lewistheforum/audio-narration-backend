import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial, In } from 'typeorm';
import { Address } from '../entities/addresses.entity';

/**
 * Address Repository
 *
 * Handles all direct database operations for the Address entity.
 * This layer is responsible for data access only, no business logic.
 */
@Injectable()
export class AddressRepository {
  constructor(
    @InjectRepository(Address)
    private readonly repository: Repository<Address>,
  ) {}

  /**
   * Find all addresses
   */
  async findAll(includeDeleted: boolean = false): Promise<Address[]> {
    return this.repository.find({
      withDeleted: includeDeleted,
    });
  }

  /**
   * Find address by ID
   */
  async findById(id: string): Promise<Address | null> {
    return this.repository.findOne({
      where: { _id: id },
    });
  }

  /**
   * Find addresses by account ID
   */
  async findByAccountId(accountId: string): Promise<Address[]> {
    return this.repository.find({
      where: { accountId },
    });
  }

  /**
   * Find addresses by account IDs
   */
  async findByAccountIds(accountIds: string[]): Promise<Address[]> {
    if (!accountIds || accountIds.length === 0) {
      return [];
    }
    return this.repository.find({
      where: { accountId: In(accountIds) },
    });
  }

  /**
   * Find addresses by province
   */
  async findByProvince(province: string): Promise<Address[]> {
    return this.repository.find({
      where: { province },
    });
  }

  /**
   * Find addresses by district
   */
  async findByDistrict(district: string): Promise<Address[]> {
    return this.repository.find({
      where: { district },
    });
  }

  /**
   * Create address entity (without saving)
   */
  create(data: DeepPartial<Address>): Address {
    return this.repository.create(data);
  }

  /**
   * Save address entity
   */
  async save(address: Address): Promise<Address> {
    return this.repository.save(address);
  }

  /**
   * Update address by ID
   */
  async update(
    id: string,
    data: DeepPartial<Address>,
  ): Promise<Address | null> {
    await this.repository.update(id, data);
    return this.findById(id);
  }

  /**
   * Soft delete address
   */
  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }

  /**
   * Soft delete addresses by account ID
   */
  async softDeleteByAccountId(accountId: string): Promise<void> {
    await this.repository.softDelete({ accountId });
  }

  /**
   * Hard delete address
   */
  async delete(id: string): Promise<number> {
    const result = await this.repository.delete(id);
    return result.affected || 0;
  }

  /**
   * Hard delete addresses by account ID
   */
  async deleteByAccountId(accountId: string): Promise<number> {
    const result = await this.repository.delete({ accountId });
    return result.affected || 0;
  }

  /**
   * Restore soft-deleted address
   */
  async restore(id: string): Promise<void> {
    await this.repository.restore(id);
  }

  /**
   * Check if address exists by ID
   */
  async existsById(id: string): Promise<boolean> {
    const count = await this.repository.count({ where: { _id: id } });
    return count > 0;
  }

  /**
   * Count addresses by account ID
   */
  async countByAccountId(accountId: string): Promise<number> {
    return this.repository.count({ where: { accountId } });
  }
}
