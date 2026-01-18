import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { GeneralAccount } from '../../modules/accounts/entities/general_accounts.entity';
import { AccountRole, Gender } from '../../modules/accounts/enums';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { GeneralAccountRepository } from '../../modules/accounts/repositories/general-account.repository';
import { ENGLISH_NAMES } from '../constants/names';

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

  // English names
  private readonly NAMES = ENGLISH_NAMES;

  // Profile picture URLs for patients
  private readonly PROFILE_PICTURE_URLS = [
    'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&h=400&fit=crop',
  ];

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
      this.logger.log('Starting to seed GeneralAccount for PATIENT accounts...');

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
        const patientIndex = patients.indexOf(account);
        const generalAccount = this.generalAccountRepository.createGeneralAccount({
          _id: randomUUID(),
          accountId: account._id,
          fullName: this.getRandomName(gender),
          gender,
          dob: this.generateDob(patientIndex),
          profilePicture: this.getRandomProfilePicture(patientIndex),
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
   * Get random English name based on gender
   */
  private getRandomName(gender: Gender): string {
    const names =
      gender === Gender.MALE
        ? this.NAMES.male
        : this.NAMES.female;
    return names[Math.floor(Math.random() * names.length)];
  }

  /**
   * Generate date of birth (deterministic based on index)
   * Patients are typically 18-80 years old
   */
  private generateDob(index: number): Date {
    const age = 18 + (index % 63); // 18-80 years old
    const year = new Date().getFullYear() - age;
    const month = 1 + (index % 12);
    const day = 1 + (index % 28);
    return new Date(year, month, day);
  }

  /**
   * Get random profile picture URL (deterministic based on index)
   */
  private getRandomProfilePicture(index: number): string {
    return this.PROFILE_PICTURE_URLS[index % this.PROFILE_PICTURE_URLS.length];
  }
}
