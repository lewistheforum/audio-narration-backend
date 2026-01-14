import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ClinicManagerInformation } from '../../modules/accounts/entities/clinic_manager_information.entity';
import { AccountRole, Gender } from '../../modules/accounts/enums';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { ClinicManagerInformationRepository } from '../../modules/accounts/repositories/clinic-manager-information.repository';

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

  // Vietnamese clinic branch names
  private readonly CLINIC_BRANCH_NAMES = [
    'Chi nhánh Quận 1',
    'Chi nhánh Quận 3',
    'Chi nhánh Quận 5',
    'Chi nhánh Quận 7',
    'Chi nhánh Quận 10',
    'Chi nhánh Quận Tân Bình',
    'Chi nhánh Quận Bình Thạnh',
    'Chi nhánh Quận Gò Vấp',
    'Chi nhánh Quận Phú Nhuận',
    'Chi nhánh Quận Thủ Đức',
    'Chi nhánh Quận Ba Đình',
    'Chi nhánh Quận Hoàn Kiếm',
    'Chi nhánh Quận Hai Bà Trưng',
    'Chi nhánh Quận Đống Đa',
    'Chi nhánh Quận Cầu Giấy',
  ];

  // Vietnamese names
  private readonly VIETNAMESE_NAMES = {
    male: [
      'Nguyễn Văn An',
      'Trần Văn Bình',
      'Lê Văn Cường',
      'Phạm Văn Dũng',
      'Hoàng Văn Em',
      'Huỳnh Văn Giáp',
      'Phan Văn Hùng',
      'Vũ Văn Khôi',
      'Đặng Văn Long',
      'Đỗ Văn Minh',
    ],
    female: [
      'Nguyễn Thị Lan',
      'Trần Thị Mai',
      'Lê Thị Ngọc',
      'Phạm Thị Oanh',
      'Hoàng Thị Phương',
      'Huỳnh Thị Quỳnh',
      'Phan Thị Thu',
      'Vũ Thị Uyên',
      'Đặng Thị Vân',
      'Đỗ Thị Xuân',
    ],
  };

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
   * Get random Vietnamese name based on gender
   */
  private getRandomName(gender: Gender): string {
    const names =
      gender === Gender.MALE
        ? this.VIETNAMESE_NAMES.male
        : this.VIETNAMESE_NAMES.female;
    return names[Math.floor(Math.random() * names.length)];
  }
}
