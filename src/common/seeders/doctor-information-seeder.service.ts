import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DoctorInformation } from '../../modules/accounts/entities/doctor_information.entity';
import { AccountRole, Gender } from '../../modules/accounts/enums';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { DoctorInformationRepository } from '../../modules/accounts/repositories/doctor-information.repository';
import { ENGLISH_NAMES } from '../constants/names';
import {
  ACADEMIC_DEGREES,
  MEDICAL_SPECIALIZATIONS,
  POSITIONS,
  INTRODUCTIONS,
  EXPERIENCE_YEARS,
} from '../constants/medical-terms';

/**
 * DoctorInformation Seeder Service
 *
 * Seeds DoctorInformation records for all DOCTOR accounts.
 * Must run after AccountSeederService to ensure accounts exist.
 *
 * Idempotent: Uses check-then-insert pattern by account_id
 */
@Injectable()
export class DoctorInformationSeederService {
  private readonly logger = new Logger(DoctorInformationSeederService.name);

  // English doctor names
  private readonly NAMES = ENGLISH_NAMES;
  private readonly ACADEMIC_DEGREES_TEMPLATES = ACADEMIC_DEGREES;
  private readonly SPECIALIZATIONS_TEMPLATES = MEDICAL_SPECIALIZATIONS;
  private readonly POSITIONS_TEMPLATES = POSITIONS;
  private readonly INTRODUCTIONS_TEMPLATES = INTRODUCTIONS;

  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly doctorInfoRepository: DoctorInformationRepository,
  ) {}

  /**
   * Seed DoctorInformation records for all DOCTOR accounts
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
   */
  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed DoctorInformation...');

      // Get all DOCTOR accounts
      const doctorAccounts = await this.accountRepository.findAllAccounts();
      const doctors = doctorAccounts.filter(
        (acc) => acc.role === AccountRole.DOCTOR,
      );

      if (doctors.length === 0) {
        this.logger.warn('No DOCTOR accounts found. Skipping seeding.');
        return;
      }

      this.logger.log(`Found ${doctors.length} DOCTOR accounts`);

      let createdCount = 0;

      for (const account of doctors) {
        const existing = await this.doctorInfoRepository.findByDoctorAccountId(
          account._id,
        );

        if (existing) {
          continue;
        }

        const gender = this.getRandomGender();
        const doctorInfo = this.doctorInfoRepository.create({
          _id: randomUUID(),
          accountId: account._id,
          fullName: this.getRandomName(gender),
          gender,
          academicDegree: this.getRandomAcademicDegree(),
          experience: this.getRandomExperience(),
          position: this.getRandomPosition(),
          introduction1: this.getRandomIntroduction(),
        });

        await this.doctorInfoRepository.save(doctorInfo);
        createdCount++;
      }

      this.logger.log(`✅ Created ${createdCount} DoctorInformation records`);
    } catch (error) {
      this.logger.error('Failed to seed DoctorInformation', error.stack);
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
   * Get random academic degree
   */
  private getRandomAcademicDegree(): string {
    return this.ACADEMIC_DEGREES_TEMPLATES[
      Math.floor(Math.random() * this.ACADEMIC_DEGREES_TEMPLATES.length)
    ];
  }

  /**
   * Get random experience (1-20 years)
   */
  private getRandomExperience(): string {
    const years = this.getRandomInt(1, 20);
    return EXPERIENCE_YEARS(years);
  }

  /**
   * Get random position
   */
  private getRandomPosition(): string {
    return this.POSITIONS_TEMPLATES[Math.floor(Math.random() * this.POSITIONS_TEMPLATES.length)];
  }

  /**
   * Get random introduction (orthopedics-focused)
   */
  private getRandomIntroduction(): string {
    return this.INTRODUCTIONS_TEMPLATES[Math.floor(Math.random() * this.INTRODUCTIONS_TEMPLATES.length)];
  }

  /**
   * Get random integer between min and max (inclusive)
   */
  private getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
