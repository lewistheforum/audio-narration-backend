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
}
