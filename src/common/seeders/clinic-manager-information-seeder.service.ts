import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ClinicManagerInformation } from '../../modules/accounts/entities/clinic_manager_information.entity';
import { AccountRole, Gender } from '../../modules/accounts/enums';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { ClinicManagerInformationRepository } from '../../modules/accounts/repositories/clinic-manager-information.repository';
import { ENGLISH_NAMES, BRANCH_NAMES } from '../constants/names';

/**
 * ClinicManagerInformation Seeder Service
 *
 * Seeds ClinicManagerInformation records for all CLINIC_MANAGER accounts.
 * Must run after AccountSeederService to ensure accounts exist.
 *
 * Idempotent: Uses check-then-insert pattern by account_id
 */
@Injectable()
export class ClinicManagerInformationSeederService {
  private readonly logger = new Logger(
    ClinicManagerInformationSeederService.name,
  );

  // English clinic branch names
  private readonly CLINIC_BRANCH_NAMES = BRANCH_NAMES;

  // English names
  private readonly NAMES = ENGLISH_NAMES;

  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly clinicManagerInfoRepository: ClinicManagerInformationRepository,
  ) {}

  /**
   * Seed ClinicManagerInformation records for all CLINIC_MANAGER accounts
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
   */
  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed ClinicManagerInformation...');

      // Get all CLINIC_MANAGER accounts
      const clinicManagerAccounts = await this.accountRepository.findAllAccounts();
      const clinicManagers = clinicManagerAccounts.filter(
        (acc) => acc.role === AccountRole.CLINIC_MANAGER,
      );

      if (clinicManagers.length === 0) {
        this.logger.warn(
          'No CLINIC_MANAGER accounts found. Skipping seeding.',
        );
        return;
      }

      this.logger.log(`Found ${clinicManagers.length} CLINIC_MANAGER accounts`);

      let createdCount = 0;

      for (const account of clinicManagers) {
        const existing = await this.clinicManagerInfoRepository.findByAccountId(
          account._id,
        );

        if (existing) {
          continue;
        }

        const gender = this.getRandomGender();
        const clinicManagerInfo = this.clinicManagerInfoRepository.create({
          _id: randomUUID(),
          accountId: account._id,
          clinicBranchName: this.getRandomClinicBranchName(),
          fullName: this.getRandomName(gender),
          gender,
        });

        await this.clinicManagerInfoRepository.save(clinicManagerInfo);
        createdCount++;
      }

      this.logger.log(
        `✅ Created ${createdCount} ClinicManagerInformation records`,
      );
    } catch (error) {
      this.logger.error('Failed to seed ClinicManagerInformation', error.stack);
      throw error;
    }
  }

  /**
   * Get random clinic branch name
   */
  private getRandomClinicBranchName(): string {
    return this.CLINIC_BRANCH_NAMES[
      Math.floor(Math.random() * this.CLINIC_BRANCH_NAMES.length)
    ];
  }

  /**
   * Get random gender
   */
  private getRandomGender(): Gender {
    const genders = Object.values(Gender);
    return genders[Math.floor(Math.random() * genders.length)];
  }

  /**
   * Get random English name based on gender
   */
  private getRandomName(gender: Gender): string {
    const names =
      gender === Gender.MALE
        ? this.NAMES.male
        : this.NAMES.female;
    return names[Math.floor(Math.random() * names.length)];
  }
}
