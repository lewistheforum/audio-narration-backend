import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import dayjs from 'dayjs';
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

  // Clinic names based on location - mapped to the 7 real addresses
  private readonly CLINIC_NAMES_BY_LOCATION = [
    'Bonix Ho Chi Minh - D1',
    'Bonix Ho Chi Minh - D4',
    'Bonix Hanoi - Dong Da',
    'Bonix Hanoi - Hoan Kiem',
    'Bonix Nha Trang',
    'Bonix Da Nang',
    'Bonix Can Tho',
  ];

  private readonly ADMIN_CLINIC_MAPPING = [0, 1, 2, 3, 4, 5, 6, 0, 1, 2];

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
    'https://images.pexels.com/photos/13176452/pexels-photo-13176452.jpeg',
    'https://images.pexels.com/photos/7789603/pexels-photo-7789603.jpeg',
    'https://penviet.com/wp-content/uploads/2022/10/Thiet-ke-phong-kham-7-e1665647035285.png',
    'https://pendecor.vn/uploads/files/2025/04/20/thiet-ke-phong-kham-noi-khoa-1.jpeg',
    'https://bizweb.dktcdn.net/100/515/519/files/noi-that-benh-vien.jpg?v=1734251928637',
    'https://dongkhoi.vn/vnt_upload/news/09_2022/cach_bo_tri_phong_kham_2.jpg',
    'https://anviethouse.vn/wp-content/uploads/2021/07/Thiet-ke-quay-le-tan-va-khu-vuc-cho-phong-kham.jpg',
    'https://ykhoacantho.com/wp-content/uploads/2022/09/kham-benh-xuong-khop-can-tho-2022-13.jpg',
    'https://acc.vn/wp-content/uploads/2023/08/1.png',
    'https://acc.vn/wp-content/uploads/2026/02/gallery-hcm-7.png',
    'https://www.docosan.com/blog/wp-content/uploads/2021/06/samsungbestclinic.jpg',
    'https://penviet.com/wp-content/uploads/2022/10/Thiet-ke-phong-kham-2-e1665646837372.png',
    'https://pendecor.vn/uploads/files/2025/04/20/thiet-ke-phong-kham-tham-my-1.jpg',
    'https://pendecor.vn/uploads/files/2022/08/30/thiet-ke-phong-kham-mat-1.jpg',
    'https://anlocgroup.com/wp-content/uploads/2023/01/thiet-ke-phong-kham-23.jpg',
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

        // Special Seepay config for Admin 1 (index 0) - Clinic Manager 1
        let bankName: string;
        let bankNumber: string;
        let sepayVa: string;
        let sepayKey: string;

        if (adminIndex === 0) {
          // Admin 1 gets specific Seepay configuration for testing booking flow
          bankName = 'MBbank';
          bankNumber = '0779822327';
          sepayVa = 'VQRQAFHMW1685';
          sepayKey = 'MEDICARE_TEST';
        } else {
          bankName = this.getRandomBankName();
          bankNumber = this.randomBankNumber();
          sepayVa = this.randomSePayVa();
          sepayKey = this.randomSepayKey();
        }

        const clinicAdminInfo = this.clinicAdminInfoRepository.create({
          _id: randomUUID(),
          accountId: account._id,
          clinicName: this.getClinicNameByIndex(adminIndex),
          clinicPhone: this.randomVietnamPhone(),
          description: this.getRandomDescription(),
          specializedIn: { desc: this.getRandomSpecializations().join(', ') },
          pros: { desc: this.getRandomPros().join(', ') },
          paraclinical: { desc: this.getRandomParaclinical().join(', ') },
          dob: this.generateDob(adminIndex),
          profilePicture: this.getRandomProfilePicture(adminIndex),
          bankName,
          bankNumber,
          bankBranch: this.getRandomBankBranch(),
          sepayVa,
          sepayKey,
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
   * Get clinic name based on admin index (location-based)
   */
  private getClinicNameByIndex(adminIndex: number): string {
    const locationIndex = this.ADMIN_CLINIC_MAPPING[adminIndex] || 0;
    return this.CLINIC_NAMES_BY_LOCATION[locationIndex];
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
   * Generate random SePay API key
   */
  private randomSepayKey(): string {
    return `sepay_test_key_${this.randomDigits(12)}`;
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
