import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
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

  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly doctorInfoRepository: DoctorInformationRepository,
  ) { }

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
        const existing = await this.doctorInfoRepository.findByAccountId(account._id);

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
          certificatePracticalTraining: this.generateCertificatePracticalTraining(doctorIndex),
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
   * Generate date of birth (deterministic based on index)
   * Doctors are typically 30-60 years old
   */
  private generateDob(index: number): Date {
    const age = 30 + (index % 31); // 30-60 years old
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

  /**
   * Generate work process (deterministic based on index)
   */
  private generateWorkProcess(index: number): Record<string, any> {
    const startYear = 2010 + (index % 15);
    return {
      current: {
        hospital: this.getRandomClinicName(index),
        position: this.POSITIONS_TEMPLATES[index % this.POSITIONS_TEMPLATES.length],
        startYear: startYear,
      },
      previous: [
        {
          hospital: this.getRandomClinicName((index + 1) % 5),
          position: 'Orthopedic Surgeon',
          startYear: startYear - 5,
          endYear: startYear,
        },
      ],
    };
  }

  /**
   * Generate study process (deterministic based on index)
   */
  private generateStudyProcess(index: number): Record<string, any> {
    return {
      undergraduate: {
        university: 'Hanoi Medical University',
        degree: 'Doctor of Medicine',
        startYear: 2000 + (index % 10),
        endYear: 2006 + (index % 10),
      },
      postgraduate: {
        university: 'University of Medicine and Pharmacy',
        degree: this.ACADEMIC_DEGREES_TEMPLATES[index % this.ACADEMIC_DEGREES_TEMPLATES.length],
        startYear: 2007 + (index % 10),
        endYear: 2010 + (index % 10),
      },
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
      memberships: memberships.slice(0, 2 + (index % 3)),
    };
  }

  /**
   * Generate scientific work (deterministic based on index)
   */
  private generateScientificWork(index: number): Record<string, any> {
    return {
      research: [
        {
          title: `Study on ${MEDICAL_SPECIALIZATIONS[index % MEDICAL_SPECIALIZATIONS.length]} Treatment`,
          year: 2020 + (index % 5),
          journal: 'Vietnamese Journal of Orthopedics',
        },
      ],
    };
  }

  /**
   * Generate published papers (deterministic based on index)
   */
  private generatePapers(index: number): Record<string, any> {
    return {
      papers: [
        {
          title: `Advanced Techniques in ${MEDICAL_SPECIALIZATIONS[index % MEDICAL_SPECIALIZATIONS.length]}`,
          year: 2021 + (index % 4),
          conference: 'International Orthopedic Conference',
        },
      ],
    };
  }

  /**
   * Get random introduction image URL (deterministic based on index)
   */
  private getRandomIntroductionImage(index: number): string {
    return `https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&h=400&fit=crop&sig=${index}`;
  }

  /**
   * Generate professional license (deterministic based on index)
   */
  private generateProfessionalLicense(index: number): Record<string, any> {
    return {
      licenseNumber: `PL-${20200000 + index}`,
      issuedBy: 'Ministry of Health',
      issuedDate: this.generateIdentityDate(index),
      expiryDate: new Date(2030 + (index % 10), 0, 1),
    };
  }

  /**
   * Generate certificate of practical training (deterministic based on index)
   */
  private generateCertificatePracticalTraining(index: number): Record<string, any> {
    return {
      certificateNumber: `CPT-${20210000 + index}`,
      institution: 'Hanoi Medical University Hospital',
      issuedDate: this.generateIdentityDate(index),
      duration: '12 months',
    };
  }

  /**
   * Generate medical license (deterministic based on index)
   */
  private generateMedicalLicense(index: number): Record<string, any> {
    return {
      licenseNumber: `ML-${20220000 + index}`,
      specialization: MEDICAL_SPECIALIZATIONS[index % MEDICAL_SPECIALIZATIONS.length],
      issuedBy: 'Ministry of Health',
      issuedDate: this.generateIdentityDate(index),
      validUntil: new Date(2035 + (index % 10), 0, 1),
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
    const provinces = ['Hanoi', 'Ho Chi Minh City', 'Da Nang', 'Hai Phong', 'Can Tho'];
    return `${provinces[index % provinces.length]} Police Department`;
  }

  /**
   * Generate identity card date (deterministic based on index)
   */
  private generateIdentityDate(index: number): Date {
    const year = 2015 + (index % 10);
    const month = 1 + (index % 12);
    const day = 1 + (index % 28);
    return new Date(year, month, day);
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
    return this.BANK_BRANCHES[Math.floor(Math.random() * this.BANK_BRANCHES.length)];
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
