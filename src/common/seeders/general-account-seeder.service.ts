import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { GeneralAccount } from '../../modules/accounts/entities/general_accounts.entity';
import { AccountRole, Gender } from '../../modules/accounts/enums';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { GeneralAccountRepository } from '../../modules/accounts/repositories/general-account.repository';

/**
 * GeneralAccount Seeder Service
 *
 * Seeds GeneralAccount records for PATIENT accounts only.
 * Must run after AccountSeederService to ensure PATIENT accounts exist.
 *
 * Idempotent: Uses check-then-insert pattern by account_id
 */
@Injectable()
export class GeneralAccountSeederService {
  private readonly logger = new Logger(GeneralAccountSeederService.name);

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
    private readonly generalAccountRepository: GeneralAccountRepository,
  ) {}

  /**
   * Seed GeneralAccount records for PATIENT accounts only
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
   */
  async seed(): Promise<void> {
    try {
      this.logger.log(
        'Starting to seed GeneralAccount for PATIENT accounts...',
      );

      // Get all PATIENT accounts
      const patientAccounts = await this.accountRepository.findAllAccounts();
      const patients = patientAccounts.filter(
        (acc) => acc.role === AccountRole.PATIENT,
      );

      if (patients.length === 0) {
        this.logger.warn('No PATIENT accounts found. Skipping seeding.');
        return;
      }

      this.logger.log(`Found ${patients.length} PATIENT accounts`);

      let createdCount = 0;

      for (const account of patients) {
        const existing =
          await this.generalAccountRepository.findGeneralAccountByUserId(
            account._id,
          );

        if (existing) {
          continue;
        }

        const gender = this.getRandomGender();
        const generalAccount =
          this.generalAccountRepository.createGeneralAccount({
            _id: randomUUID(),
            accountId: account._id,
            fullName: this.getRandomName(gender),
            gender,
          });

        await this.generalAccountRepository.saveGeneralAccount(generalAccount);
        createdCount++;
      }

      this.logger.log(`✅ Created ${createdCount} GeneralAccount records`);
    } catch (error) {
      this.logger.error('Failed to seed GeneralAccount', error.stack);
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
}
