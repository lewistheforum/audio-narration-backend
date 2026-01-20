import { Injectable, Logger } from '@nestjs/common';
import { Account } from '../../modules/accounts/entities/accounts.entity';
import { AccountRole } from '../../modules/accounts/enums/account-role.enum';
import { ContractRole } from '../../modules/contracts/enums/contract-role.enum';
import { ContractPackage } from '../../modules/contracts/entities/contract-package.entity';
import { ContractPackageRepository } from '../../modules/contracts/repositories/contract-package.repository';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { CLINIC_REPRESENTATIVES } from '../constants/names';
import { CLINIC_POSITIONS } from '../constants/medical-terms';
import { HEADER_ADDRESSES } from '../constants/locations';

/**
 * ContractPackage Seeder Service
 *
 * Seeds contract packages for CLINIC_STAFF and DOCTOR accounts.
 *
 * Seeding Rules:
 * - For each CLINIC_STAFF and DOCTOR account, create 1 ContractPackage record.
 * - clinicId must equal the parentId of the staff/doctor account.
 * - Must be idempotent (re-run safe).
 * - Seed realistic orthopedics clinic contract data.
 *
 * Idempotent: Uses check-then-insert pattern by (clinicId, employeeId)
 */
@Injectable()
export class ContractPackageSeederService {
  private readonly logger = new Logger(ContractPackageSeederService.name);

  // Orthopedics clinic-specific contract header data
  private readonly CLINIC_REPRESENTATIVES_TEMPLATES = CLINIC_REPRESENTATIVES;
  private readonly POSITIONS_TEMPLATES = CLINIC_POSITIONS;
  private readonly HEADER_ADDRESSES_TEMPLATES = HEADER_ADDRESSES;

  constructor(
    private readonly contractPackageRepository: ContractPackageRepository,
    private readonly accountRepository: AccountRepository,
  ) { }

  /**
   * Seed contract packages for CLINIC_STAFF and DOCTOR accounts
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
   */
  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed contract packages...');

      // Get all CLINIC_STAFF and DOCTOR accounts
      const staffAndDoctors = await this.accountRepository.findAllAccounts().then(
        (accounts) =>
          accounts.filter(
            (acc) =>
              acc.role === AccountRole.CLINIC_STAFF ||
              acc.role === AccountRole.DOCTOR,
          ),
      );

      if (staffAndDoctors.length === 0) {
        this.logger.warn(
          'No CLINIC_STAFF or DOCTOR accounts found. Skipping seeding.',
        );
        return;
      }

      let createdCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      for (const employee of staffAndDoctors) {
        // Validate that employee has a parent (clinic manager)
        if (!employee.parentId) {
          this.logger.warn(
            `Account ${employee.username} (${employee.role}) has no parentId. Skipping contract package creation.`,
          );
          errorCount++;
          continue;
        }

        // Verify that parent account exists
        const parentAccount = await this.accountRepository.findAccountById(employee.parentId);
        if (!parentAccount) {
          this.logger.warn(
            `Parent account not found for ${employee.username}. Skipping contract package creation.`,
          );
          errorCount++;
          continue;
        }

        // Check if contract package already exists for this clinic-employee pair
        const existing =
          await this.contractPackageRepository.existsByClinicAndEmployee(
            employee.parentId,
            employee._id,
          );

        if (existing) {
          skippedCount++;
          continue;
        }

        // Determine contract role based on account role
        const contractRole =
          employee.role === AccountRole.DOCTOR
            ? ContractRole.DOCTOR
            : ContractRole.STAFF;

        // Create contract package with realistic orthopedics clinic data
        const contractPackage = this.contractPackageRepository.create({
          clinicId: employee.parentId, // This is the CLINIC_MANAGER account
          employeeId: employee._id,
          role: contractRole,
          headerAddress: this.getRandomHeaderAddress(),
          headerDate: this.getRandomHeaderDate(),
          clinicRepresentative: this.getRandomClinicRepresentative(),
          position: this.getRandomPosition(),
        });

        await this.contractPackageRepository.save(contractPackage);
        createdCount++;
      }

      this.logger.log(
        `✅ ContractPackage seeding completed: ${createdCount} created, ${skippedCount} skipped, ${errorCount} errors`,
      );
    } catch (error) {
      this.logger.error('Failed to seed contract packages', error.stack);
      throw error;
    }
  }

  /**
   * Get random header address
   */
  private getRandomHeaderAddress(): string {
    return this.HEADER_ADDRESSES_TEMPLATES[
      Math.floor(Math.random() * this.HEADER_ADDRESSES_TEMPLATES.length)
    ];
  }

  /**
   * Get random header date (within last 6 months)
   */
  private getRandomHeaderDate(): Date {
    const now = new Date();
    const sixMonthsAgo = new Date(
      now.getFullYear(),
      now.getMonth() - 6,
      now.getDate(),
    );
    const randomTime =
      sixMonthsAgo.getTime() +
      Math.random() * (now.getTime() - sixMonthsAgo.getTime());
    return new Date(randomTime);
  }

  /**
   * Get random clinic representative
   */
  private getRandomClinicRepresentative(): string {
    return this.CLINIC_REPRESENTATIVES_TEMPLATES[
      Math.floor(Math.random() * this.CLINIC_REPRESENTATIVES_TEMPLATES.length)
    ];
  }

  /**
   * Get random position
   */
  private getRandomPosition(): string {
    return this.POSITIONS_TEMPLATES[Math.floor(Math.random() * this.POSITIONS_TEMPLATES.length)];
  }
}
