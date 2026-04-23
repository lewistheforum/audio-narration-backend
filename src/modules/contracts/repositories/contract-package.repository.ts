import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial, Brackets } from 'typeorm';
import { ContractPackage } from '../entities/contract-package.entity';
import { ContractStatus } from '../enums/contract-status.enum';

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
      relations: [
        'clinicAccount',
        'employeeAccount',
        'clinicContractInformation',
      ],
    });
  }

  /**
   * Find contract packages by clinic manager ID
   */
  async findByManagerId(clinicManagerId: string): Promise<ContractPackage[]> {
    return this.repository.find({
      where: { clinicManagerId },
      relations: ['clinicAccount', 'employeeAccount'],
    });
  }

  /**
   * Find contract packages by employee ID
   */
  async findByEmployeeId(employeeId: string): Promise<ContractPackage[]> {
    return this.repository.find({
      where: { employeeId },
      relations: ['clinicAccount', 'employeeAccount', 'clinicContractInformation'],
    });
  }

  /**
   * Find contract package by clinic manager ID and employee ID
   */
  async findByManagerAndEmployee(
    clinicManagerId: string,
    employeeId: string,
  ): Promise<ContractPackage | null> {
    return this.repository.findOne({
      where: { clinicManagerId, employeeId },
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
   * Check if contract package exists by clinic manager ID and employee ID
   */
  async existsByManagerAndEmployee(
    clinicManagerId: string,
    employeeId: string,
  ): Promise<boolean> {
    const count = await this.repository.count({
      where: { clinicManagerId, employeeId },
    });
    return count > 0;
  }

  /**
   * Count contract packages by clinic manager ID
   */
  async countByManagerId(clinicManagerId: string): Promise<number> {
    return this.repository.count({ where: { clinicManagerId } });
  }

  /**
   * Count contract packages by employee ID
   */
  async countByEmployeeId(employeeId: string): Promise<number> {
    return this.repository.count({ where: { employeeId } });
  }
  /**
   * Find Contract Packages by Clinic Manager ID with Filters and Pagination
   *
   * @param clinicManagerId - Filter by Clinic Manager ID
   * @param employeeName - Search by Employee Name (Optional)
   * @param page - Page number (Default 1)
   * @param limit - Limit per page (Default 10)
   */
  async findPackagesByManagerWithFilters(
    clinicManagerId: string,
    employeeName?: string,
    page: number = 1,
    limit: number = 10,
    status?: string,
  ): Promise<[ContractPackage[], number]> {
    const queryBuilder = this.repository.createQueryBuilder('contractPackage');

    // Join relations
    queryBuilder
      .leftJoinAndSelect('contractPackage.clinicAccount', 'clinic')
      .leftJoinAndSelect('contractPackage.employeeAccount', 'employee')
      .leftJoinAndSelect('contractPackage.clinicContractInformation', 'info')
      .leftJoinAndSelect('employee.generalAccount', 'generalAccount'); // Assuming name is in generalAccount

    // Filter by Clinic Manager ID
    queryBuilder.where('contractPackage.clinicManagerId = :clinicManagerId', {
      clinicManagerId,
    });

    // Optional Filter: Employee Name, Email or Username search
    if (employeeName) {
      const name = `%${employeeName.trim().toLowerCase()}%`;
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where('LOWER(employee.email) LIKE :name', { name })
            .orWhere('LOWER(employee.username) LIKE :name', { name })
            .orWhere('LOWER(generalAccount.fullName) LIKE :name', { name });
        }),
      );
    }

    // Optional Filter: Contract Status
    if (status) {
      queryBuilder.andWhere('info.contractStatus = :status', { status });
    }

    // Pagination
    queryBuilder.skip((page - 1) * limit).take(limit);

    // Order by created date (Newest first)
    queryBuilder.orderBy('contractPackage.createdAt', 'DESC');

    return queryBuilder.getManyAndCount();
  }

  /**
   * Find Contract Packages by Employee ID with Filters and Pagination
   *
   * @param employeeId - Filter by Employee ID
   * @param clinicName - Search by Clinic Name (Optional)
   * @param page - Page number (Default 1)
   * @param limit - Limit per page (Default 10)
   */
  async findPackagesByEmployeeWithFilters(
    employeeId: string,
    clinicName?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<[ContractPackage[], number]> {
    const queryBuilder = this.repository.createQueryBuilder('contractPackage');

    // Join relations
    queryBuilder
      .leftJoinAndSelect('contractPackage.clinicAccount', 'clinic')
      .leftJoinAndSelect('contractPackage.employeeAccount', 'employee')
      .leftJoinAndSelect('contractPackage.clinicContractInformation', 'info')
      .leftJoinAndSelect('clinic.generalAccount', 'clinicGeneralAccount'); // Assuming name is in generalAccount

    // Filter by Employee ID and exclude DRAFT status
    queryBuilder
      .where('contractPackage.employeeId = :employeeId', { employeeId })
      .andWhere('info.contractStatus != :draftStatus', {
        draftStatus: ContractStatus.DRAFT,
      });

    // Optional Filter: Clinic Name or Email search
    if (clinicName) {
      const name = `%${clinicName.trim()}%`;
      queryBuilder.andWhere(
        '(clinicGeneralAccount.fullName ILIKE :name OR clinic.email ILIKE :name)',
        { name },
      );
    }

    // Pagination
    queryBuilder.skip((page - 1) * limit).take(limit);

    // Order by created date (Newest first)
    queryBuilder.orderBy('contractPackage.createdAt', 'DESC');

    return queryBuilder.getManyAndCount();
  }

  /**
   * Find the newest Contract Package by Employee ID
   *
   * @param employeeId - Filter by Employee ID
   * @returns The newest ContractPackage entity with clinicContractInformation or null
   */
  async findNewestByEmployeeId(
    employeeId: string,
  ): Promise<ContractPackage | null> {
    return this.repository
      .createQueryBuilder('contractPackage')
      .leftJoinAndSelect('contractPackage.clinicContractInformation', 'info')
      .where('contractPackage.employeeId = :employeeId', { employeeId })
      .orderBy('contractPackage.createdAt', 'DESC')
      .getOne();
  }
}
