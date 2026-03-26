import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ClinicSubscriptionHistory } from '../entities/clinic-subscription-history.entity';

@Injectable()
export class ClinicSubscriptionHistoryRepository extends Repository<ClinicSubscriptionHistory> {
  constructor(private dataSource: DataSource) {
    super(ClinicSubscriptionHistory, dataSource.createEntityManager());
  }

  /**
   * Find all subscription history records for a specific clinic
   *
   * @param {string} clinicId - Clinic account UUID
   * @returns {Promise<ClinicSubscriptionHistory[]>} History records
   */
  async findByClinicId(clinicId: string): Promise<ClinicSubscriptionHistory[]> {
    return this.find({
      where: { clinicId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find the most recent subscription history for a clinic
   *
   * @param {string} clinicId - Clinic account UUID
   * @returns {Promise<ClinicSubscriptionHistory | null>} Most recent history record
   */
  async findLatestByClinicId(
    clinicId: string,
  ): Promise<ClinicSubscriptionHistory | null> {
    return this.findOne({
      where: { clinicId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Create a history record for subscription status change
   *
   * @param {Partial<ClinicSubscriptionHistory>} historyData - History data
   * @returns {Promise<ClinicSubscriptionHistory>} Created history record
   */
  async createHistoryRecord(
    historyData: Partial<ClinicSubscriptionHistory>,
  ): Promise<ClinicSubscriptionHistory> {
    const historyRecord = this.create(historyData);
    return this.save(historyRecord);
  }

  /**
   * Find paginated history with services joined (optimized for N+1 prevention)
   * Fetches history records and services in a single query using LEFT JOIN
   *
   * @param {string} clinicId - Clinic account UUID
   * @param {number} skip - Number of records to skip
   * @param {number} take - Number of records to return
   * @returns {Promise<[ClinicSubscriptionHistory[], number]>} History records with total count
   */
  async findWithServicesByClinicId(
    clinicId: string,
    skip: number,
    take: number,
  ): Promise<[ClinicSubscriptionHistory[], number]> {
    const queryBuilder = this.createQueryBuilder('history')
      .leftJoinAndSelect('history.service', 'service')
      .where('history.clinicId = :clinicId', { clinicId })
      .andWhere('history.deletedAt IS NULL')
      .orderBy('history.createdAt', 'DESC')
      .skip(skip)
      .take(take);

    return queryBuilder.getManyAndCount();
  }
}
