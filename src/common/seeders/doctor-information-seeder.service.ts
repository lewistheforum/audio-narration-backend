import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import dayjs from 'dayjs';
import { DoctorInformation } from '../../modules/accounts/entities/doctor_information.entity';
import { AccountRole, Gender } from '../../modules/accounts/enums';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { DoctorInformationRepository } from '../../modules/accounts/repositories/doctor-information.repository';
import { VIETNAMESE_NAMES } from '../constants/names';
import {
  ACADEMIC_DEGREES,
  MEDICAL_SPECIALIZATIONS,
  POSITIONS,
  INTRODUCTIONS,
  EXPERIENCE_YEARS,
  BANK_BRANCHES,
  NATIONALITIES,
  WORK_SPECIALTIES,
} from '../constants/medical-terms';
import { getCurrentVietnamTime, VIETNAM_TIMEZONE } from '../utils/date.util';

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

  // Vietnamese doctor names without diacritics (per system context)
  private readonly NAMES = VIETNAMESE_NAMES;
  private readonly ACADEMIC_DEGREES_TEMPLATES = ACADEMIC_DEGREES;
  private readonly SPECIALIZATIONS_TEMPLATES = MEDICAL_SPECIALIZATIONS;
  private readonly POSITIONS_TEMPLATES = POSITIONS;
  private readonly INTRODUCTIONS_TEMPLATES = INTRODUCTIONS;
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
  private readonly NATIONALITIES = NATIONALITIES;
  private readonly WORK_SPECIALTIES = WORK_SPECIALTIES;

  // Profile picture URLs for doctors
  private readonly PROFILE_PICTURE_URLS = [
    'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&h=400&fit=crop',
  ];

  private readonly SCIENCE_DIRECT_PAPER_URLS = [
    'https://www.sciencedirect.com/science/article/pii/S0957417424010339',
    'https://www.sciencedirect.com/science/article/pii/S2949882123000403',
    'https://www.sciencedirect.com/science/article/pii/S2949882124000318',
    'https://www.sciencedirect.com/science/article/pii/S2949882123000397',
    'https://www.sciencedirect.com/science/article/abs/pii/S0022347616300701',
  ];

  private readonly INTRODUCTION_IMAGE_URLS = [
    'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&h=400&fit=crop',
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
        const existing = await this.doctorInfoRepository.findByAccountId(
          account._id,
        );

        if (existing) {
          continue;
        }

        const gender = this.getRandomGender();
        const doctorIndex = doctors.indexOf(account);
        const doctorInfo = this.doctorInfoRepository.create({
          _id: randomUUID(),
          accountId: account._id,
          fullName: this.getRandomName(gender),
          gender,
          dob: this.generateDob(doctorIndex),
          profilePicture: this.getRandomProfilePicture(doctorIndex),
          academicDegree: this.getRandomAcademicDegree(),
          experience: this.getRandomExperience(),
          position: this.getRandomPosition(),
          introduction1: this.getRandomIntroduction(),
          workProcess2: this.generateWorkProcess(doctorIndex),
          studyProcess3: this.generateStudyProcess(doctorIndex),
          members4: this.generateMembers(doctorIndex),
          scientificWork5: this.generateScientificWork(doctorIndex),
          papers6: this.generatePapers(doctorIndex),
          introductionImage: this.getRandomIntroductionImage(doctorIndex),
          professionalLicense: this.generateProfessionalLicense(doctorIndex),
          certificatePracticalTraining:
            this.generateCertificatePracticalTraining(doctorIndex),
          medicalLicense: this.generateMedicalLicense(doctorIndex),
          identityNumber: this.generateIdentityNumber(doctorIndex),
          placeIdentityCard: this.generatePlaceIdentityCard(doctorIndex),
          identityDate: this.generateIdentityDate(doctorIndex),
          bankNumber: this.generateBankNumber(doctorIndex),
          bankName: this.getRandomBankName(),
          bankBranch: this.getRandomBankBranch(),
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
   * Get random Vietnamese name without diacritics based on gender
   */
  private getRandomName(gender: Gender): string {
    const names = gender === Gender.MALE ? this.NAMES.male : this.NAMES.female;
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
    return this.POSITIONS_TEMPLATES[
      Math.floor(Math.random() * this.POSITIONS_TEMPLATES.length)
    ];
  }

  /**
   * Get random introduction (orthopedics-focused)
   */
  private getRandomIntroduction(): string {
    return this.INTRODUCTIONS_TEMPLATES[
      Math.floor(Math.random() * this.INTRODUCTIONS_TEMPLATES.length)
    ];
  }

  /**
   * Generate date of birth (deterministic based on index)
   * Doctors are typically 30-60 years old
   */
  private generateDob(index: number): Date {
    const age = 30 + (index % 31); // 30-60 years old
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
   * Generate work process (deterministic based on index)
   */
  private generateWorkProcess(index: number): Record<string, any> {
    const startYear = 2010 + (index % 15);
    const hospital = this.getRandomClinicName(index);
    const position =
      this.POSITIONS_TEMPLATES[index % this.POSITIONS_TEMPLATES.length];

    return {
      list: [
        `Current: ${hospital}, Position: ${position} (since ${startYear})`,
        `Previous: ${this.getRandomClinicName((index + 1) % 5)}, Position: Orthopedic Surgeon (${startYear - 5}-${startYear})`,
      ],
    };
  }

  /**
   * Generate study process (deterministic based on index)
   */
  private generateStudyProcess(index: number): Record<string, any> {
    const degree =
      this.ACADEMIC_DEGREES_TEMPLATES[
        index % this.ACADEMIC_DEGREES_TEMPLATES.length
      ];
    const undergradStart = 2000 + (index % 10);
    const postgradStart = 2007 + (index % 10);

    return {
      list: [
        `Undergraduate: Hanoi Medical University, Doctor of Medicine (${undergradStart}-${undergradStart + 6})`,
        `Postgraduate: University of Medicine and Pharmacy, ${degree} (${postgradStart}-${postgradStart + 3})`,
      ],
    };
  }

  /**
   * Generate professional memberships (deterministic based on index)
   */
  private generateMembers(index: number): Record<string, any> {
    const memberships = [
      'Vietnam Orthopedic Association',
      'Asia Pacific Orthopedic Association',
      'International Society of Orthopedic Surgery',
      'Vietnamese Medical Association',
      'Sports Medicine Association',
    ];
    return {
      list: memberships.slice(0, 2 + (index % 3)),
    };
  }

  /**
   * Generate scientific work (deterministic based on index)
   */
  private generateScientificWork(index: number): Record<string, any> {
    const title = `Study on ${MEDICAL_SPECIALIZATIONS[index % MEDICAL_SPECIALIZATIONS.length]} Treatment`;
    const year = 2020 + (index % 5);
    return {
      list: [
        {
          title: `${title} (${year})`,
          link: 'https://vietnamorthopedicjournal.com/study-' + index,
        },
      ],
    };
  }

  /**
   * Generate published papers (deterministic based on index)
   */
  private generatePapers(index: number): Record<string, any> {
    const title = `Advanced Techniques in ${MEDICAL_SPECIALIZATIONS[index % MEDICAL_SPECIALIZATIONS.length]}`;
    const year = 2021 + (index % 4);
    return {
      list: [
        {
          title: `${title} (${year})`,
          link: this.SCIENCE_DIRECT_PAPER_URLS[
            index % this.SCIENCE_DIRECT_PAPER_URLS.length
          ],
        },
      ],
    };
  }

  /**
   * Get random introduction image URL (deterministic based on index)
   */
  private getRandomIntroductionImage(index: number): string {
    return this.INTRODUCTION_IMAGE_URLS[
      index % this.INTRODUCTION_IMAGE_URLS.length
    ];
  }

  /**
   * Generate professional license (deterministic based on index)
   */
  private generateProfessionalLicense(index: number): Record<string, any> {
    return {
      type: 'img',
      url: 'https://images.template.net/512709/Blank-Professional-License-Certificate-Template-edit-online.png',
    };
  }

  /**
   * Generate certificate of practical training (deterministic based on index)
   */
  private generateCertificatePracticalTraining(
    index: number,
  ): Record<string, any> {
    return {
      type: 'img',
      url: 'https://marketplace.canva.com/EAGpZi6tXeM/1/0/1600w/canva-blue-and-white-geometric-professional-completion-certificate-Q79VnHduaEI.jpg',
    };
  }

  /**
   * Generate medical license (deterministic based on index)
   */
  private generateMedicalLicense(index: number): Record<string, any> {
    return {
      type: 'img',
      url: 'https://imgv2-1-f.scribdassets.com/img/document/726825773/original/b764da97c8/1?v=1',
    };
  }

  /**
   * Generate identity number (deterministic based on index)
   */
  private generateIdentityNumber(index: number): string {
    return `${String(1970 + (index % 40))}${String(1 + (index % 12)).padStart(2, '0')}${String(1 + (index % 28)).padStart(2, '0')}${String(10000000 + index).slice(1)}`;
  }

  /**
   * Generate place of identity card (deterministic based on index)
   */
  private generatePlaceIdentityCard(index: number): string {
    const provinces = [
      'Hanoi',
      'Ho Chi Minh City',
      'Da Nang',
      'Hai Phong',
      'Can Tho',
    ];
    return `${provinces[index % provinces.length]} Police Department`;
  }

  /**
   * Generate identity card date (deterministic based on index)
   */
  private generateIdentityDate(index: number): Date {
    const year = 2015 + (index % 10);
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
   * Generate bank account number (deterministic based on index)
   */
  private generateBankNumber(index: number): string {
    const prefix = [1234, 5678, 9012, 3456, 7890];
    const suffix = String(100000000 + index).slice(1);
    return `${prefix[index % prefix.length]}${suffix}`;
  }

  /**
   * Get random bank name
   */
  private getRandomBankName(): string {
    return this.BANK_NAMES[Math.floor(Math.random() * this.BANK_NAMES.length)];
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
   * Get random clinic name (for work process)
   */
  private getRandomClinicName(index: number): string {
    const clinics = [
      'Hanoi General Hospital',
      'Cho Ray Hospital',
      'Da Nang Hospital',
      'Bach Mai Hospital',
      'Viet Duc Hospital',
    ];
    return clinics[index % clinics.length];
  }

  /**
   * Get random integer between min and max (inclusive)
   */
  private getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
