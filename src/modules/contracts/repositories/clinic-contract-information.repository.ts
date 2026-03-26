import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { ClinicContractInformation } from '../entities/clinic-contract-information.entity';
import { ContractStatus } from '../enums/contract-status.enum';

/**
 * ClinicContractInformation Repository
 *
 * Handles all direct database operations for ClinicContractInformation entity.
 * This layer is responsible for data access only, no business logic.
 */
@Injectable()
export class ClinicContractInformationRepository {
  constructor(
    @InjectRepository(ClinicContractInformation)
    private readonly repository: Repository<ClinicContractInformation>,
  ) { }

  /**
   * Find all clinic contract information records
   */
  async findAll(includeDeleted: boolean = false): Promise<ClinicContractInformation[]> {
    return this.repository.find({
      withDeleted: includeDeleted,
      relations: ['contractPackage'],
    });
  }

  /**
   * Find clinic contract information by ID
   */
  async findById(id: string): Promise<ClinicContractInformation | null> {
    return this.repository.findOne({
      where: { _id: id },
      relations: ['contractPackage'],
    });
  }

  /**
   * Find clinic contract information by contract ID
   */
  async findByContractId(
    contractId: string,
  ): Promise<ClinicContractInformation | null> {
    return this.repository.findOne({
      where: { contractId },
      relations: ['contractPackage'],
    });
  }

  /**
   * Create clinic contract information entity (without saving)
   */
  create(data: DeepPartial<ClinicContractInformation>): ClinicContractInformation {
    return this.repository.create(data);
  }

  /**
   * Save clinic contract information entity
   */
  async save(
    contractInfo: ClinicContractInformation,
  ): Promise<ClinicContractInformation> {
    return this.repository.save(contractInfo);
  }

  /**
   * Update clinic contract information by ID
   */
  async update(
    id: string,
    data: DeepPartial<ClinicContractInformation>,
  ): Promise<ClinicContractInformation | null> {
    await this.repository.update(id, data);
    return this.findById(id);
  }

  /**
   * Update clinic contract information by contract ID
   */
  async updateByContractId(
    contractId: string,
    data: DeepPartial<ClinicContractInformation>,
  ): Promise<ClinicContractInformation | null> {
    await this.repository.update({ contractId }, data);
    return this.findByContractId(contractId);
  }

  /**
   * Soft delete clinic contract information
   */
  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }

  /**
   * Hard delete clinic contract information
   */
  async delete(id: string): Promise<number> {
    const result = await this.repository.delete(id);
    return result.affected || 0;
  }

  /**
   * Restore soft-deleted clinic contract information
   */
  async restore(id: string): Promise<void> {
    await this.repository.restore(id);
  }

  /**
   * Check if clinic contract information exists by contract ID
   */
  async existsByContractId(contractId: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { contractId },
    });
    return count > 0;
  }

  /**
   * Count clinic contract information records
   */
  async count(): Promise<number> {
    return this.repository.count();
  }

  /**
   * Find expired contracts that are currently active
   */
  async findExpiredCurrentContracts(currentDate: Date): Promise<ClinicContractInformation[]> {
    return this.repository
      .createQueryBuilder('contractInfo')
      .where('contractInfo.contractStatus = :status', { status: 'CURRENT' })
      .andWhere('contractInfo.contractEndDate < :currentDate', { currentDate })
      .getMany();
  }

  /**
   * Bulk update contract status
   */
async updateStatusBulk(ids: string[], status: string): Promise<number> {
        if (!ids || ids.length === 0) return 0;

        const result = await this.repository
          .createQueryBuilder()
          .update(ClinicContractInformation)
          .set({ contractStatus: status as ContractStatus })
          .where('_id = ANY(:ids)', { ids })
          .execute();

        return result.affected || 0;
    }
}

