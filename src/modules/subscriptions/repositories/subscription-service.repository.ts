import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { SubscriptionService } from '../entities/subscription-service.entity';
import { SubscriptionServiceStatus } from '../enums/subscription-service-status.enum';

/**
 * SubscriptionService Repository
 *
 * Handles all direct database operations for SubscriptionService entity.
 * This layer is responsible for data access only, no business logic.
 */
@Injectable()
export class SubscriptionServiceRepository {
  constructor(
    @InjectRepository(SubscriptionService)
    private readonly repository: Repository<SubscriptionService>,
  ) {}

  /**
   * Find all subscription services
   */
  async findAll(
    includeDeleted: boolean = false,
    status?: SubscriptionServiceStatus,
  ): Promise<SubscriptionService[]> {
    const where: any = {};

    if (status) {
      where.status = status;
    }

    return this.repository.find({
      where,
      withDeleted: includeDeleted,
    });
  }

  /**
   * Find subscription service by ID
   */
  async findById(id: string): Promise<SubscriptionService | null> {
    return this.repository.findOne({
      where: { _id: id },
    });
  }

  /**
   * Find subscription service by ID including soft-deleted
   */
  async findByIdWithDeleted(id: string): Promise<SubscriptionService | null> {
    return this.repository.findOne({
      where: { _id: id },
      withDeleted: true,
    });
  }

  /**
   * Create subscription service entity (without saving)
   */
  create(data: DeepPartial<SubscriptionService>): SubscriptionService {
    return this.repository.create(data);
  }

  /**
   * Save subscription service entity
   */
  async save(service: SubscriptionService): Promise<SubscriptionService> {
    return this.repository.save(service);
  }

  /**
   * Update subscription service by ID
   */
  async update(
    id: string,
    data: DeepPartial<SubscriptionService>,
  ): Promise<SubscriptionService | null> {
    await this.repository.update(id, data);
    return this.findById(id);
  }

  /**
   * Soft delete subscription service
   */
  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }

  /**
   * Hard delete subscription service
   */
  async delete(id: string): Promise<number> {
    const result = await this.repository.delete(id);
    return result.affected || 0;
  }

  /**
   * Restore soft-deleted subscription service
   */
  async restore(id: string): Promise<void> {
    await this.repository.restore(id);
  }

  /**
   * Check if subscription service exists by ID
   */
  async existsById(id: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { _id: id },
    });
    return count > 0;
  }

  /**
   * Count All Subscription Services
   *
   * Returns the total number of subscription services.
   *
   * @returns {Promise<number>} Number of subscription services
   */
  async count(): Promise<number> {
    return this.repository.count();
  }

  /**
   * Reset all is_popular to false
   */
  async resetAllPopular(): Promise<void> {
    await this.repository.update({ isPopular: true }, { isPopular: false });
  }

  /**
   * Set is_popular to true for specific service
   */
  async setPopular(serviceId: string): Promise<void> {
    await this.repository.update({ _id: serviceId }, { isPopular: true });
  }
}
