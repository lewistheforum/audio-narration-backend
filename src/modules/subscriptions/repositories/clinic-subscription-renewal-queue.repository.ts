import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ClinicSubscriptionRenewalQueue } from '../entities/clinic-subscription-renewal-queue.entity';

@Injectable()
export class ClinicSubscriptionRenewalQueueRepository extends Repository<ClinicSubscriptionRenewalQueue> {
    constructor(private dataSource: DataSource) {
        super(ClinicSubscriptionRenewalQueue, dataSource.createEntityManager());
    }

    /**
     * Create a renewal queue record
     *
     * @param {Partial<ClinicSubscriptionRenewalQueue>} queueData - Queue data
     * @returns {Promise<ClinicSubscriptionRenewalQueue>} Created queue record
     */
    async createQueueRecord(
        queueData: Partial<ClinicSubscriptionRenewalQueue>,
    ): Promise<ClinicSubscriptionRenewalQueue> {
        const queueRecord = this.create(queueData);
        return this.save(queueRecord);
    }

    /**
     * Find a renewal queue record by clinic ID
     *
     * @param {string} clinicId - Clinic account UUID
     * @returns {Promise<ClinicSubscriptionRenewalQueue | null>} Queue record
     */
    async findByClinicId(
        clinicId: string,
    ): Promise<ClinicSubscriptionRenewalQueue | null> {
        return this.findOne({
            where: { clinicId },
            relations: ['nextService'],
        });
    }

    /**
     * Delete a renewal queue record by clinic ID
     *
     * @param {string} clinicId - Clinic account UUID
     * @returns {Promise<void>}
     */
    async deleteByClinicId(clinicId: string): Promise<void> {
        await this.delete({ clinicId });
    }
}
