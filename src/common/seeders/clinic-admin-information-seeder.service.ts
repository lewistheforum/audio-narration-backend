import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as dayjs from 'dayjs';
import { ClinicAdminInformation } from '../../modules/accounts/entities/clinic-admin-information.entity';
import { AccountRole } from '../../modules/accounts/enums';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { ClinicAdminInformationRepository } from '../../modules/accounts/repositories/clinic-admin-information.repository';
import {
  CLINIC_NAMES,
  SPECIALIZATIONS,
  PROS,
  PARACLINICAL,
  BANK_BRANCHES,
  DESCRIPTIONS,
} from '../constants/medical-terms';
import { getCurrentVietnamTime, VIETNAM_TIMEZONE } from '../utils/date.util';

/**
 * ClinicAdminInformation Seeder Service
 *
 * Seeds ClinicAdminInformation records for all CLINIC_ADMIN accounts.
 * Must run after AccountSeederService to ensure accounts exist.
 *
 * Idempotent: Uses check-then-insert pattern by account_id
 */
@Injectable()
export class ClinicAdminInformationSeederService {
  private readonly logger = new Logger(
    ClinicAdminInformationSeederService.name,
  );

  // Orthopedics-focused English clinic names
  private readonly CLINIC_NAMES = CLINIC_NAMES;

  // Orthopedics-only clinic specializations
  private readonly SPECIALIZATIONS = SPECIALIZATIONS;

  // Clinic pros/advantages (orthopedics-focused)
  private readonly PROS = PROS;

  // Orthopedics-focused paraclinical services
  private readonly PARACLINICAL = PARACLINICAL;

  private readonly BANK_NAMES = [
    'VPBank',
    'TPBank',
    'VietinBank',
    'BIDV',
    'MBBank',
    'OCB',
    'KienLongBank',
    'MSB',
  ];
  private readonly BANK_BRANCHES = BANK_BRANCHES;

  // Profile picture URLs for clinic admins
  private readonly PROFILE_PICTURE_URLS = [
    'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&h=400&fit=crop',
  ];

  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly clinicAdminInfoRepository: ClinicAdminInformationRepository,
  ) {}

  /**
   * Seed ClinicAdminInformation records for all CLINIC_ADMIN accounts
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
   */
  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed ClinicAdminInformation...');

      // Get all CLINIC_ADMIN accounts
      const clinicAdminAccounts =
        await this.accountRepository.findAllAccounts();
      const clinicAdmins = clinicAdminAccounts.filter(
        (acc) => acc.role === AccountRole.CLINIC_ADMIN,
      );

      if (clinicAdmins.length === 0) {
        this.logger.warn('No CLINIC_ADMIN accounts found. Skipping seeding.');
        return;
      }

      this.logger.log(`Found ${clinicAdmins.length} CLINIC_ADMIN accounts`);

      let createdCount = 0;

      for (const account of clinicAdmins) {
        const existing = await this.clinicAdminInfoRepository.findByAccountId(
          account._id,
        );

        if (existing) {
          continue;
        }

        const adminIndex = clinicAdmins.indexOf(account);
        const clinicAdminInfo = this.clinicAdminInfoRepository.create({
          _id: randomUUID(),
          accountId: account._id,
          clinicName: this.getRandomClinicName(),
          clinicPhone: this.randomVietnamPhone(),
          description: this.getRandomDescription(),
          specializedIn: this.getRandomSpecializations(),
          pros: this.getRandomPros(),
          paraclinical: this.getRandomParaclinical(),
          dob: this.generateDob(adminIndex),
          profilePicture: this.getRandomProfilePicture(adminIndex),
          bankName: this.getRandomBankName(),
          bankNumber: this.randomBankNumber(),
          bankBranch: this.getRandomBankBranch(),
          sepayVa: this.randomSePayVa(),
          isVerify: true,
        });

        await this.clinicAdminInfoRepository.save(clinicAdminInfo);
        createdCount++;
      }

      this.logger.log(
        `✅ Created ${createdCount} ClinicAdminInformation records`,
      );
    } catch (error) {
      this.logger.error('Failed to seed ClinicAdminInformation', error.stack);
      throw error;
    }
  }

  /**
   * Get random clinic name
   */
  private getRandomClinicName(): string {
    return this.CLINIC_NAMES[
      Math.floor(Math.random() * this.CLINIC_NAMES.length)
    ];
  }

  /**
   * Get random description (orthopedics-focused)
   */
  private getRandomDescription(): string {
    return DESCRIPTIONS[Math.floor(Math.random() * DESCRIPTIONS.length)];
  }

  /**
   * Get random specializations
   */
  private getRandomSpecializations(): string[] {
    return this.SPECIALIZATIONS[
      Math.floor(Math.random() * this.SPECIALIZATIONS.length)
    ];
  }

  /**
   * Get random pros/advantages
   */
  private getRandomPros(): string[] {
    return this.PROS[Math.floor(Math.random() * this.PROS.length)];
  }

  /**
   * Get random paraclinical services
   */
  private getRandomParaclinical(): string[] {
    return this.PARACLINICAL[
      Math.floor(Math.random() * this.PARACLINICAL.length)
    ];
  }

  /**
   * Get random bank name
   */
  private getRandomBankName(): string {
    return this.BANK_NAMES[Math.floor(Math.random() * this.BANK_NAMES.length)];
  }

  /**
   * Generate random bank number (10-15 digits)
   */
  private randomBankNumber(): string {
    const length = this.getRandomInt(10, 15);
    let number = '';
    for (let i = 0; i < length; i++) {
      number += Math.floor(Math.random() * 10);
    }
    return number;
  }

  /**
   * Get random bank branch
   */
  private getRandomBankBranch(): string {
    return this.BANK_BRANCHES[
      Math.floor(Math.random() * this.BANK_BRANCHES.length)
    ];
  }

  /**
   * Generate random SePay virtual account
   */
  private randomSePayVa(): string {
    return `VA${this.randomDigits(8)}`;
  }

  /**
   * Generate random Vietnamese local phone number
   */
  private randomVietnamPhone(): string {
    return `0${this.randomDigits(9)}`;
  }

  /**
   * Generate random digits string
   */
  private randomDigits(length: number): string {
    let digits = '';
    for (let i = 0; i < length; i++) {
      digits += Math.floor(Math.random() * 10);
    }
    return digits;
  }

  /**
   * Generate date of birth (deterministic based on index)
   * Clinic admins are typically 35-65 years old
   */
  private generateDob(index: number): Date {
    const age = 35 + (index % 31); // 35-65 years old
    const year = getCurrentVietnamTime().getFullYear() - age;
    const month = 1 + (index % 12);
    const day = 1 + (index % 28);
    return dayjs
      .tz(
        `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        VIETNAM_TIMEZONE,
      )
      .toDate();
  }

  /**
   * Get random profile picture URL (deterministic based on index)
   */
  private getRandomProfilePicture(index: number): string {
    return this.PROFILE_PICTURE_URLS[index % this.PROFILE_PICTURE_URLS.length];
  }

  /**
   * Get random integer between min and max (inclusive)
   */
  private getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
