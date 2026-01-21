import { Injectable, Logger } from '@nestjs/common';
import { Account } from '../../modules/accounts/entities/accounts.entity';
import { AccountRole } from '../../modules/accounts/enums/account-role.enum';
import { ContractType } from '../../modules/accounts/enums/contract-type.enum';
import { SalaryPaymentMethod } from '../../modules/accounts/enums/salary-payment-method.enum';
import { ContractStatus } from '../../modules/accounts/enums/contract-status.enum';
import { ClinicContractInformation } from '../../modules/accounts/entities/clinic-contract-information.entity';
import { ClinicContractInformationRepository } from '../../modules/accounts/repositories/clinic-contract-information.repository';
import { ContractPackageRepository } from '../../modules/accounts/repositories/contract-package.repository';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import {
  DOCTOR_SPECIALTIES,
  NATIONALITIES,
  WORK_SPECIALTIES,
  JOB_DESCRIPTIONS,
  REST_POLICIES,
  LEAVE_POLICIES,
  ALLOWANCES,
  PERFORMANCE_BONUSES,
  SALARY_PAYMENT_CYCLES,
  PARTY_A_SIGNERS,
  PARTY_B_SIGNERS,
} from '../constants/medical-terms';
import { PROVINCES } from '../constants/locations';

/**
 * ClinicContractInformation Seeder Service
 *
 * Seeds contract information for CLINIC_STAFF and DOCTOR accounts.
 *
 * Seeding Rules:
 * - For each CLINIC_STAFF and DOCTOR account, create 1 ClinicContractInformation record.
 * - clinic_id must equal the parentId of the staff/doctor account (FK to accounts.id).
 * - Must be idempotent (re-run safe).
 * - Seed realistic orthopedics clinic contract data.
 *
 * Idempotent: Uses check-then-insert pattern by contractId
 */
@Injectable()
export class ClinicContractInformationSeederService {
  private readonly logger = new Logger(
    ClinicContractInformationSeederService.name,
  );

  // Orthopedics clinic-specific contract data
  private readonly DOCTOR_SPECIALTIES = DOCTOR_SPECIALTIES;
  private readonly NATIONALITIES = NATIONALITIES;
  private readonly CURRENT_LIVING = PROVINCES.map((p) => p.name);
  private readonly WORK_SPECIALTY_AT_CLINIC = WORK_SPECIALTIES;
  private readonly JOB_DESCRIPTIONS = JOB_DESCRIPTIONS;
  private readonly REST_POLICIES = REST_POLICIES;
  private readonly LEAVE_POLICIES = LEAVE_POLICIES;
  private readonly ALLOWANCES = ALLOWANCES;
  private readonly PERFORMANCE_BONUSES = PERFORMANCE_BONUSES;
  private readonly SALARY_PAYMENT_CYCLES = SALARY_PAYMENT_CYCLES;
  private readonly PARTY_A_SIGNERS = PARTY_A_SIGNERS;
  private readonly PARTY_B_SIGNERS = PARTY_B_SIGNERS;

  constructor(
    private readonly clinicContractInformationRepository: ClinicContractInformationRepository,
    private readonly contractPackageRepository: ContractPackageRepository,
    private readonly accountRepository: AccountRepository,
  ) {}

  /**
   * Seed clinic contract information for CLINIC_STAFF and DOCTOR accounts
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
   */
  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed clinic contract information...');

      // Get all CLINIC_STAFF and DOCTOR accounts
      const staffAndDoctors = await this.accountRepository
        .findAllAccounts()
        .then((accounts) =>
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
            `Account ${employee.username} (${employee.role}) has no parentId. Skipping contract information creation.`,
          );
          errorCount++;
          continue;
        }

        // Verify that parent account exists
        const parentAccount = await this.accountRepository.findAccountById(
          employee.parentId,
        );
        if (!parentAccount) {
          this.logger.warn(
            `Parent account not found for ${employee.username}. Skipping contract information creation.`,
          );
          errorCount++;
          continue;
        }

        // Find existing contract package for this employee
        const contractPackage =
          await this.contractPackageRepository.findByClinicAndEmployee(
            employee.parentId,
            employee._id,
          );

        if (!contractPackage) {
          this.logger.warn(
            `No ContractPackage found for ${employee.username}. Skipping contract information creation.`,
          );
          errorCount++;
          continue;
        }

        // Check if clinic contract information already exists for this contract
        const existing =
          await this.clinicContractInformationRepository.existsByContractId(
            contractPackage._id,
          );

        if (existing) {
          skippedCount++;
          continue;
        }

        // Create clinic contract information with realistic orthopedics clinic data
        const contractInfo = this.clinicContractInformationRepository.create({
          contractId: contractPackage._id,
          doctorSpecialty: this.getRandomDoctorSpecialty(),
          nationality: this.getRandomNationality(),
          currentLiving: this.getRandomCurrentLiving(),
          workSpecialtyAtClinic: this.getRandomWorkSpecialtyAtClinic(),
          contractStartDate: this.getRandomContractStartDate(),
          contractEndDate: this.getRandomContractEndDate(),
          contractType: this.getRandomContractType(),
          jobDescription: this.getRandomJobDescription(),
          workingTime: this.getRandomWorkingTime(),
          restPolicy: this.getRandomRestPolicy(),
          leavePolicy: this.getRandomLeavePolicy(),
          baseSalary: this.getRandomBaseSalary(),
          allowances: this.getRandomAllowances(),
          performanceBonus: this.getRandomPerformanceBonus(),
          salaryPaymentMethod: this.getRandomSalaryPaymentMethod(),
          salaryPaymentCycle: this.getRandomSalaryPaymentCycle(),
          effectiveFrom: this.getRandomEffectiveFrom(),
          effectiveTo: this.getRandomEffectiveTo(),
          partyASignerName: this.getRandomPartyASignerName(),
          partyBSignerName: this.getRandomPartyBSignerName(),
          contractFile: this.getRandomContractFile(),
          contractStatus: this.getRandomContractStatus(),
        });

        await this.clinicContractInformationRepository.save(contractInfo);
        createdCount++;
      }

      this.logger.log(
        `✅ ClinicContractInformation seeding completed: ${createdCount} created, ${skippedCount} skipped, ${errorCount} errors`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to seed clinic contract information',
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get random doctor specialty
   */
  private getRandomDoctorSpecialty(): string {
    return this.DOCTOR_SPECIALTIES[
      Math.floor(Math.random() * this.DOCTOR_SPECIALTIES.length)
    ];
  }

  /**
   * Get random nationality
   */
  private getRandomNationality(): string {
    return this.NATIONALITIES[
      Math.floor(Math.random() * this.NATIONALITIES.length)
    ];
  }

  /**
   * Get random current living
   */
  private getRandomCurrentLiving(): string {
    return this.CURRENT_LIVING[
      Math.floor(Math.random() * this.CURRENT_LIVING.length)
    ];
  }

  /**
   * Get random work specialty at clinic
   */
  private getRandomWorkSpecialtyAtClinic(): string {
    return this.WORK_SPECIALTY_AT_CLINIC[
      Math.floor(Math.random() * this.WORK_SPECIALTY_AT_CLINIC.length)
    ];
  }

  /**
   * Get random contract start date (within last 6 months)
   */
  private getRandomContractStartDate(): Date {
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
   * Get random contract end date (1-2 years after start date)
   */
  private getRandomContractEndDate(): Date {
    const startDate = this.getRandomContractStartDate();
    const monthsToAdd = 12 + Math.floor(Math.random() * 12); // 12-24 months
    const endDate = new Date(
      startDate.getFullYear(),
      startDate.getMonth() + monthsToAdd,
      startDate.getDate(),
    );
    return endDate;
  }

  /**
   * Get random contract type
   */
  private getRandomContractType(): ContractType {
    const types = Object.values(ContractType);
    return types[Math.floor(Math.random() * types.length)];
  }

  /**
   * Get random job description
   */
  private getRandomJobDescription(): string {
    return this.JOB_DESCRIPTIONS[
      Math.floor(Math.random() * this.JOB_DESCRIPTIONS.length)
    ];
  }

  /**
   * Get random working time (8:00 AM - 5:00 PM range)
   */
  private getRandomWorkingTime(): Date {
    const hour = 8 + Math.floor(Math.random() * 9); // 8-16 hours
    const minute = Math.floor(Math.random() * 60);
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    return date;
  }

  /**
   * Get random rest policy
   */
  private getRandomRestPolicy(): string {
    return this.REST_POLICIES[
      Math.floor(Math.random() * this.REST_POLICIES.length)
    ];
  }

  /**
   * Get random leave policy
   */
  private getRandomLeavePolicy(): string {
    return this.LEAVE_POLICIES[
      Math.floor(Math.random() * this.LEAVE_POLICIES.length)
    ];
  }

  /**
   * Get random base salary (10,000,000 - 50,000,000 VND)
   */
  private getRandomBaseSalary(): number {
    const salary = 10000000 + Math.floor(Math.random() * 40000000); // 10M-50M VND
    return salary;
  }

  /**
   * Get random allowances
   */
  private getRandomAllowances(): string {
    const allowances = [];
    const numAllowances = 1 + Math.floor(Math.random() * 3); // 1-3 allowances
    for (let i = 0; i < numAllowances; i++) {
      allowances.push(
        this.ALLOWANCES[Math.floor(Math.random() * this.ALLOWANCES.length)],
      );
    }
    return allowances.join(', ');
  }

  /**
   * Get random performance bonus
   */
  private getRandomPerformanceBonus(): string {
    return this.PERFORMANCE_BONUSES[
      Math.floor(Math.random() * this.PERFORMANCE_BONUSES.length)
    ];
  }

  /**
   * Get random salary payment method
   */
  private getRandomSalaryPaymentMethod(): SalaryPaymentMethod {
    const methods = Object.values(SalaryPaymentMethod);
    return methods[Math.floor(Math.random() * methods.length)];
  }

  /**
   * Get random salary payment cycle
   */
  private getRandomSalaryPaymentCycle(): string {
    return this.SALARY_PAYMENT_CYCLES[
      Math.floor(Math.random() * this.SALARY_PAYMENT_CYCLES.length)
    ];
  }

  /**
   * Get random effective from date (same as contract start date)
   */
  private getRandomEffectiveFrom(): Date {
    return this.getRandomContractStartDate();
  }

  /**
   * Get random effective to date (same as contract end date)
   */
  private getRandomEffectiveTo(): Date {
    return this.getRandomContractEndDate();
  }

  /**
   * Get random party A signer name
   */
  private getRandomPartyASignerName(): string {
    return this.PARTY_A_SIGNERS[
      Math.floor(Math.random() * this.PARTY_A_SIGNERS.length)
    ];
  }

  /**
   * Get random party B signer name
   */
  private getRandomPartyBSignerName(): string {
    return this.PARTY_B_SIGNERS[
      Math.floor(Math.random() * this.PARTY_B_SIGNERS.length)
    ];
  }

  /**
   * Get random contract file path or URL (nullable)
   */
  private getRandomContractFile(): string | null {
    const contractFiles = [
      '/contracts/contract_' + Math.floor(Math.random() * 10000) + '.pdf',
      '/contracts/employment_agreement_' +
        Math.floor(Math.random() * 10000) +
        '.pdf',
      'https://storage.medicare.vn/contracts/contract_' +
        Math.floor(Math.random() * 10000) +
        '.pdf',
      'https://s3.medicare.vn/contracts/employment_' +
        Math.floor(Math.random() * 10000) +
        '.pdf',
      null, // 20% chance of no contract file
      null,
    ];
    return contractFiles[Math.floor(Math.random() * contractFiles.length)];
  }

  /**
   * Get random contract status
   */
  private getRandomContractStatus(): ContractStatus {
    const statuses = [ContractStatus.CURRENT, ContractStatus.OLD];
    return statuses[Math.floor(Math.random() * statuses.length)];
  }
}
