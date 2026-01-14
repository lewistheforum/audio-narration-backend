import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DoctorInformation } from '../../modules/accounts/entities/doctor_information.entity';
import { AccountRole, Gender } from '../../modules/accounts/enums';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { DoctorInformationRepository } from '../../modules/accounts/repositories/doctor-information.repository';

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

  // Vietnamese doctor names
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

  // Academic degrees (orthopedics-relevant)
  private readonly ACADEMIC_DEGREES = [
    'Thạc sĩ Y khoa',
    'Tiến sĩ Y khoa',
    'Bác sĩ Chuyên khoa II Cơ Xương Khớp',
    'Bác sĩ Chuyên khoa I Chấn Thương Chỉnh Hình',
    'Bác sĩ Chuyên khoa I Vật Lý Trị Liệu',
  ];

  // Orthopedics-only medical specializations
  private readonly SPECIALIZATIONS = [
    'Cơ xương khớp',
    'Chấn thương chỉnh hình',
    'Vật lý trị liệu',
    'Phục hồi chức năng',
    'Thể thao y khoa',
    'Chấn thương thể thao',
    'Cột sống',
    'Đau lưng mạn tính',
    'Đầu gối',
    'Vai',
    'Gãy xương',
    'Viêm xương khớp',
    'Loãng xương',
    'Thoái hóa khớp',
  ];

  // Orthopedics-focused positions
  private readonly POSITIONS = [
    'Trưởng khoa Cơ Xương Khớp',
    'Phó trưởng khoa Chấn Thương Chỉnh Hình',
    'Bác sĩ chuyên khoa Cơ Xương Khớp',
    'Bác sĩ vật lý trị liệu',
    'Bác sĩ phục hồi chức năng',
  ];

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
   * Get random academic degree
   */
  private getRandomAcademicDegree(): string {
    return this.ACADEMIC_DEGREES[
      Math.floor(Math.random() * this.ACADEMIC_DEGREES.length)
    ];
  }

  /**
   * Get random experience (1-20 years)
   */
  private getRandomExperience(): string {
    const years = this.getRandomInt(1, 20);
    return `${years} năm kinh nghiệm`;
  }

  /**
   * Get random position
   */
  private getRandomPosition(): string {
    return this.POSITIONS[Math.floor(Math.random() * this.POSITIONS.length)];
  }

  /**
   * Get random introduction (orthopedics-focused)
   */
  private getRandomIntroduction(): string {
    const introductions = [
      'Bác sĩ chuyên khoa cơ xương khớp với nhiều năm kinh nghiệm trong chẩn đoán và điều trị các bệnh lý về xương, khớp, cột sống.',
      'Chuyên gia trong lĩnh vực chấn thương chỉnh hình và phẫu thuật nội soi khớp, cam kết mang lại kết quả điều trị tốt nhất cho người bệnh.',
      'Bác sĩ vật lý trị liệu và phục hồi chức năng, có chuyên môn cao trong điều trị các chấn thương thể thao và phục hồi sau phẫu thuật.',
      'Đội ngũ bác sĩ cơ xương khớp tận tâm, luôn cập nhật các phương pháp điều trị tiên tiến nhất như phẫu thuật nội soi và vật lý trị liệu.',
      'Chuyên gia về cột sống và đau lưng mạn tính, với kinh nghiệm lâu năm trong điều trị thoái hóa khớp và loãng xương.',
    ];
    return introductions[Math.floor(Math.random() * introductions.length)];
  }

  /**
   * Get random integer between min and max (inclusive)
   */
  private getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
