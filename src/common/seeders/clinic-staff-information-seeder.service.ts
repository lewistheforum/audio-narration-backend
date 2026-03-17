import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ClinicStaffInformation } from '../../modules/accounts/entities/clinic_staff_information.entity';
import { AccountRole, Gender, ClinicRole } from '../../modules/accounts/enums';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { ClinicStaffInformationRepository } from '../../modules/accounts/repositories/clinic-staff-information.repository';
import { ENGLISH_NAMES } from '../constants/names';

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
  private readonly logger = new Logger(
    ClinicStaffInformationSeederService.name,
  );

  // English names
  private readonly NAMES = ENGLISH_NAMES;

  // Profile picture URLs for clinic staff
  private readonly PROFILE_PICTURE_URLS = [
    'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&h=400&fit=crop',
  ];

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
      const clinicStaffAccounts =
        await this.accountRepository.findAllAccounts();
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
        const existing = await this.clinicStaffInfoRepository.findByAccountId(
          account._id,
        );

        if (existing) {
          continue;
        }

        const gender = this.getRandomGender();
        const staffIndex = clinicStaff.indexOf(account);
        const clinicStaffInfo = this.clinicStaffInfoRepository.create({
          _id: randomUUID(),
          accountId: account._id,
          fullName: this.getRandomName(gender),
          gender,
          dob: this.generateDob(staffIndex),
          profilePicture: this.getRandomProfilePicture(staffIndex),
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
   * Get random clinic role
   */
  private getRandomClinicRole(): ClinicRole {
    const roles = Object.values(ClinicRole);
    return roles[Math.floor(Math.random() * roles.length)];
  }

  /**
   * Generate date of birth (deterministic based on index)
   * Clinic staff are typically 22-50 years old
   */
  private generateDob(index: number): Date {
    const age = 22 + (index % 29); // 22-50 years old
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
