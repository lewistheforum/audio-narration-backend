import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { ClinicSubscription } from '../entities/clinic-subscription.entity';

/**
 * ClinicSubscription Repository
 *
 * Handles all direct database operations for ClinicSubscription entity.
 * This layer is responsible for data access only, no business logic.
 */
@Injectable()
export class ClinicSubscriptionRepository {
  constructor(
    @InjectRepository(ClinicSubscription)
    private readonly repository: Repository<ClinicSubscription>,
  ) {}

  /**
   * Find all clinic subscriptions
   */
  async findAll(
    includeDeleted: boolean = false,
  ): Promise<ClinicSubscription[]> {
    return this.repository.find({
      withDeleted: includeDeleted,
    });
  }

  /**
   * Find clinic subscription by ID
   */
  async findById(id: string): Promise<ClinicSubscription | null> {
    return this.repository.findOne({
      where: { _id: id },
    });
  }

  /**
   * Find clinic subscription by clinic ID
   */
  async findByClinicId(clinicId: string): Promise<ClinicSubscription | null> {
    return this.repository.findOne({
      where: { clinicId },
    });
  }

  /**
   * Find clinic subscription by clinic ID including soft-deleted
   */
  async findByClinicIdWithDeleted(
    clinicId: string,
  ): Promise<ClinicSubscription | null> {
    return this.repository.findOne({
      where: { clinicId },
      withDeleted: true,
    });
  }

  /**
   * Create clinic subscription entity (without saving)
   */
  create(data: DeepPartial<ClinicSubscription>): ClinicSubscription {
    return this.repository.create(data);
  }

  /**
   * Save clinic subscription entity
   */
  async save(subscription: ClinicSubscription): Promise<ClinicSubscription> {
    return this.repository.save(subscription);
  }

  /**
   * Update clinic subscription by ID
   */
  async update(
    id: string,
    data: DeepPartial<ClinicSubscription>,
  ): Promise<ClinicSubscription | null> {
    await this.repository.update(id, data);
    return this.findById(id);
  }

  /**
   * Update clinic subscription by clinic ID
   */
  async updateByClinicId(
    clinicId: string,
    data: DeepPartial<ClinicSubscription>,
  ): Promise<ClinicSubscription | null> {
    await this.repository.update({ clinicId }, data);
    return this.findByClinicId(clinicId);
  }

  /**
   * Soft delete clinic subscription
   */
  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }

  /**
   * Soft delete clinic subscription by clinic ID
   */
  async softDeleteByClinicId(clinicId: string): Promise<void> {
    await this.repository.softDelete({ clinicId });
  }

  /**
   * Hard delete clinic subscription
   */
  async delete(id: string): Promise<number> {
    const result = await this.repository.delete(id);
    return result.affected || 0;
  }

  /**
   * Hard delete clinic subscription by clinic ID
   */
  async deleteByClinicId(clinicId: string): Promise<number> {
    const result = await this.repository.delete({ clinicId });
    return result.affected || 0;
  }

  /**
   * Restore soft-deleted clinic subscription
   */
  async restore(id: string): Promise<void> {
    await this.repository.restore(id);
  }

  /**
   * Restore soft-deleted clinic subscription by clinic ID
   */
  async restoreByClinicId(clinicId: string): Promise<void> {
    await this.repository.restore({ clinicId });
  }

  /**
   * Check if clinic subscription exists by clinic ID
   */
  async existsByClinicId(clinicId: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { clinicId },
    });
    return count > 0;
  }

  /**
   * Get active subscription counts grouped by serviceId
   * Returns array of { serviceId, activeCount } ordered by count DESC
   */
  async getActiveCountByService(): Promise<
    Array<{ serviceId: string; activeCount: string }>
  > {
    return this.repository
      .createQueryBuilder('cs')
      .select('cs.service_id', 'serviceId')
      .addSelect('COUNT(*)', 'activeCount')
      .where('cs.subscription_status = :status', { status: 'ACTIVE' })
      .andWhere('cs.deleted_at IS NULL')
      .groupBy('cs.service_id')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany();
  }

  /**
   * Find all active clinic IDs
   */
  async findActiveClinicIds(): Promise<string[]> {
    const activeSubscriptions = await this.repository.find({
      where: { subscriptionStatus: 'ACTIVE' as any }, // Using 'ACTIVE' string to avoid import cycle
      select: ['clinicId'],
    });
    return activeSubscriptions.map((sub) => sub.clinicId);
  }
}
