import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { ContractPackage } from '../entities/contract-package.entity';

/**
 * ContractPackage Repository
 *
 * Handles all direct database operations for ContractPackage entity.
 * This layer is responsible for data access only, no business logic.
 */
@Injectable()
export class ContractPackageRepository {
  constructor(
    @InjectRepository(ContractPackage)
    private readonly repository: Repository<ContractPackage>,
  ) {}

  /**
   * Find all contract packages
   */
  async findAll(includeDeleted: boolean = false): Promise<ContractPackage[]> {
    return this.repository.find({
      withDeleted: includeDeleted,
      relations: ['clinicAccount', 'employeeAccount'],
    });
  }

  /**
   * Find contract package by ID
   */
  async findById(id: string): Promise<ContractPackage | null> {
    return this.repository.findOne({
      where: { _id: id },
      relations: ['clinicAccount', 'employeeAccount'],
    });
  }

  /**
   * Find contract packages by clinic ID
   */
  async findByClinicId(clinicId: string): Promise<ContractPackage[]> {
    return this.repository.find({
      where: { clinicId },
      relations: ['clinicAccount', 'employeeAccount'],
    });
  }

  /**
   * Find contract packages by employee ID
   */
  async findByEmployeeId(employeeId: string): Promise<ContractPackage[]> {
    return this.repository.find({
      where: { employeeId },
      relations: ['clinicAccount', 'employeeAccount'],
    });
  }

  /**
   * Find contract package by clinic ID and employee ID
   */
  async findByClinicAndEmployee(
    clinicId: string,
    employeeId: string,
  ): Promise<ContractPackage | null> {
    return this.repository.findOne({
      where: { clinicId, employeeId },
      relations: ['clinicAccount', 'employeeAccount'],
    });
  }

  /**
   * Create contract package entity (without saving)
   */
  create(data: DeepPartial<ContractPackage>): ContractPackage {
    return this.repository.create(data);
  }

  /**
   * Save contract package entity
   */
  async save(contractPackage: ContractPackage): Promise<ContractPackage> {
    return this.repository.save(contractPackage);
  }

  /**
   * Update contract package by ID
   */
  async update(
    id: string,
    data: DeepPartial<ContractPackage>,
  ): Promise<ContractPackage | null> {
    await this.repository.update(id, data);
    return this.findById(id);
  }

  /**
   * Soft delete contract package
   */
  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }

  /**
   * Hard delete contract package
   */
  async delete(id: string): Promise<number> {
    const result = await this.repository.delete(id);
    return result.affected || 0;
  }

  /**
   * Restore soft-deleted contract package
   */
  async restore(id: string): Promise<void> {
    await this.repository.restore(id);
  }

  /**
   * Check if contract package exists by clinic ID and employee ID
   */
  async existsByClinicAndEmployee(
    clinicId: string,
    employeeId: string,
  ): Promise<boolean> {
    const count = await this.repository.count({
      where: { clinicId, employeeId },
    });
    return count > 0;
  }

  /**
   * Count contract packages by clinic ID
   */
  async countByClinicId(clinicId: string): Promise<number> {
    return this.repository.count({ where: { clinicId } });
  }

  /**
   * Count contract packages by employee ID
   */
  async countByEmployeeId(employeeId: string): Promise<number> {
    return this.repository.count({ where: { employeeId } });
  }
}
