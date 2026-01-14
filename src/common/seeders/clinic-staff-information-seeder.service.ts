import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ClinicStaffInformation } from '../../modules/accounts/entities/clinic_staff_information.entity';
import { AccountRole, Gender, ClinicRole } from '../../modules/accounts/enums';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { ClinicStaffInformationRepository } from '../../modules/accounts/repositories/clinic-staff-information.repository';

/**
 * ClinicStaffInformation Seeder Service
 *
 * Seeds ClinicStaffInformation records for all CLINIC_STAFF accounts.
 * Must run after AccountSeederService to ensure accounts exist.
 *
 * Idempotent: Uses check-then-insert pattern by account_id
 */
@Injectable()
export class ClinicStaffInformationSeederService {
  private readonly logger = new Logger(ClinicStaffInformationSeederService.name);

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
      'Ngô Văn Nam',
      'Đinh Văn Phúc',
      'Bùi Văn Quân',
      'Dương Văn Sáng',
      'Trương Văn Tùng',
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
      'Ngô Thị Yến',
      'Đinh Thị Ánh',
      'Bùi Thị Chi',
      'Dương Thị Dung',
      'Trương Thị Hương',
    ],
  };

  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly clinicStaffInfoRepository: ClinicStaffInformationRepository,
  ) {}

  /**
   * Seed ClinicStaffInformation records for all CLINIC_STAFF accounts
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
   */
  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed ClinicStaffInformation...');

      // Get all CLINIC_STAFF accounts
      const clinicStaffAccounts = await this.accountRepository.findAllAccounts();
      const clinicStaff = clinicStaffAccounts.filter(
        (acc) => acc.role === AccountRole.CLINIC_STAFF,
      );

      if (clinicStaff.length === 0) {
        this.logger.warn('No CLINIC_STAFF accounts found. Skipping seeding.');
        return;
      }

      this.logger.log(`Found ${clinicStaff.length} CLINIC_STAFF accounts`);

      let createdCount = 0;

      for (const account of clinicStaff) {
        const existing = await this.clinicStaffInfoRepository.findByClinicAccountId(
          account._id,
        );

        if (existing) {
          continue;
        }

        const gender = this.getRandomGender();
        const clinicStaffInfo = this.clinicStaffInfoRepository.create({
          _id: randomUUID(),
          accountId: account._id,
          fullName: this.getRandomName(gender),
          gender,
          clinicRole: this.getRandomClinicRole(),
        });

        await this.clinicStaffInfoRepository.save(clinicStaffInfo);
        createdCount++;
      }

      this.logger.log(
        `✅ Created ${createdCount} ClinicStaffInformation records`,
      );
    } catch (error) {
      this.logger.error('Failed to seed ClinicStaffInformation', error.stack);
      throw error;
    }
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

  /**
   * Get random clinic role
   */
  private getRandomClinicRole(): ClinicRole {
    const roles = Object.values(ClinicRole);
    return roles[Math.floor(Math.random() * roles.length)];
  }
}
