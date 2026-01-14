import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ClinicAdminInformation } from '../../modules/accounts/entities/clinic-admin-information.entity';
import { AccountRole, BankName } from '../../modules/accounts/enums';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { ClinicAdminInformationRepository } from '../../modules/accounts/repositories/clinic-admin-information.repository';

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

  // Orthopedics-focused Vietnamese clinic names
  private readonly CLINIC_NAMES = [
    'Phòng Khám Cơ Xương Khớp Bonix Hà Nội',
    'Phòng Khám Chấn Thương Chỉnh Hình Bonix TP.HCM',
    'Phòng Khám Vật Lý Trị Liệu Bonix Đà Nẵng',
    'Phòng Khám Thể Thao Y Khoa Bonix Cần Thơ',
    'Phòng Khám Cột Sống Bonix Hải Phòng',
  ];

  // Orthopedics-only clinic specializations
  private readonly SPECIALIZATIONS = [
    ['Cơ xương khớp', 'Chấn thương chỉnh hình'],
    ['Vật lý trị liệu', 'Phục hồi chức năng'],
    ['Thể thao y khoa', 'Chấn thương thể thao'],
    ['Cột sống', 'Đau lưng mạn tính'],
    ['Đầu gối/Vai', 'Gãy xương'],
  ];

  // Clinic pros/advantages (orthopedics-focused)
  private readonly PROS = [
    [
      'Đội ngũ bác sĩ chấn thương chỉnh hình chuyên môn cao',
      'Thiết bị X-quang, MRI hiện đại',
    ],
    ['Phương pháp vật lý trị liệu tiên tiến', 'Đo loãng xương chuẩn quốc tế'],
    [
      'Chuyên gia cột sống và khớp nhân tạo',
      'Phẫu thuật nội soi tối thiểu xâm lấn',
    ],
    [
      'Chương trình phục hồi chức năng toàn diện',
      'Điều trị chấn thương thể thao chuyên sâu',
    ],
    ['Cơ sở vật chất khang trang', 'Bảo hiểm y tế và chi phí hợp lý'],
  ];

  // Orthopedics-focused paraclinical services
  private readonly PARACLINICAL = [
    ['X-quang khớp', 'Siêu âm cơ xương khớp'],
    ['MRI cột sống', 'CT Scanner xương'],
    ['Đo mật độ xương', 'Điện cơ đồ EMG'],
    ['Siêu âm cơ bắp', 'X-quang chức năng khớp'],
  ];

  private readonly BANK_NAMES = Object.values(BankName);

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

        const clinicAdminInfo = this.clinicAdminInfoRepository.create({
          _id: randomUUID(),
          accountId: account._id,
          clinicName: this.getRandomClinicName(),
          clinicPhone: `+84${this.randomPhoneDigits()}`,
          description: this.getRandomDescription(),
          specializedIn: this.getRandomSpecializations(),
          pros: this.getRandomPros(),
          paraclinical: this.getRandomParaclinical(),
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
    const descriptions = [
      'Phòng khám chuyên sâu về cơ xương khớp và chấn thương chỉnh hình với đội ngũ bác sĩ chuyên môn cao.',
      'Cung cấp dịch vụ chẩn đoán và điều trị các bệnh lý về xương, khớp, cột sống với trang thiết bị hiện đại.',
      'Chuyên gia trong điều trị chấn thương thể thao và phục hồi chức năng toàn diện cho người bệnh.',
      'Phòng khám đạt chuẩn quốc tế về vật lý trị liệu và phục hồi chức năng cơ xương khớp.',
      'Đội ngũ bác sĩ giàu kinh nghiệm trong phẫu thuật nội soi khớp và cột sống, cam kết mang lại hiệu quả điều trị tốt nhất.',
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
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
  private getRandomBankName(): BankName {
    return this.BANK_NAMES[Math.floor(Math.random() * this.BANK_NAMES.length)];
  }

  /**
   * Generate random bank number (10-15 digits)
   */
  private randomBankNumber(): number {
    const length = this.getRandomInt(10, 15);
    let number = '';
    for (let i = 0; i < length; i++) {
      number += Math.floor(Math.random() * 10);
    }
    return parseInt(number, 10);
  }

  /**
   * Get random bank branch
   */
  private getRandomBankBranch(): string {
    const branches = [
      'Chi nhánh Hà Nội',
      'Chi nhánh TP.HCM',
      'Chi nhánh Đà Nẵng',
      'Chi nhánh Cần Thơ',
      'Chi nhánh Hải Phòng',
    ];
    return branches[Math.floor(Math.random() * branches.length)];
  }

  /**
   * Generate random SePay virtual account
   */
  private randomSePayVa(): string {
    return `VA${this.randomDigits(8)}`;
  }

  /**
   * Generate random 9-digit phone number
   */
  private randomPhoneDigits(): string {
    return this.randomDigits(9);
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
   * Get random integer between min and max (inclusive)
   */
  private getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
