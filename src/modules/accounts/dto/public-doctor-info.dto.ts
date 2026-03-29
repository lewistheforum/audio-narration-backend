import { ApiProperty } from '@nestjs/swagger';
import { Gender } from '../enums/gender.enum';

/**
 * Public Doctor Info DTO
 *
 * Doctor information for public view with security controls.
 * Uses allowlist approach to prevent sensitive data leakage.
 * Only includes non-encrypted fields and permitted encrypted fields.
 */
export class PublicDoctorInfo {
  @ApiProperty({
    description: 'Doctor information ID',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  id: string;

  @ApiProperty({
    description: 'Doctor full name',
    example: 'Dr. John Smith',
  })
  fullName: string;

  @ApiProperty({
    description: 'Doctor gender',
    enum: Gender,
    example: Gender.MALE,
    required: false,
    nullable: true,
  })
  gender?: Gender;

  @ApiProperty({
    description: 'Doctor academic degree',
    example: 'MD, PhD',
    required: false,
    nullable: true,
  })
  academicDegree?: string;

  @ApiProperty({
    description: 'Doctor work process / experience',
    example: '10 years of experience in cardiology',
    required: false,
    nullable: true,
  })
  experience?: string;

  @ApiProperty({
    description: 'Doctor position',
    example: 'Senior Cardiologist',
    required: false,
    nullable: true,
  })
  position?: string;

  @ApiProperty({
    description: 'Doctor introduction',
    example: 'Specialized in treating heart diseases with modern techniques',
    required: false,
    nullable: true,
  })
  introduction1?: string;

  @ApiProperty({
    description: 'Doctor work process details',
    example: { hospitals: ['City Hospital', 'General Hospital'] },
    required: false,
    nullable: true,
  })
  workProcess2?: Record<string, any>;

  @ApiProperty({
    description: 'Doctor study process details',
    example: { degrees: ['MD', 'PhD'], schools: ['Medical University'] },
    required: false,
    nullable: true,
  })
  studyProcess3?: Record<string, any>;

  @ApiProperty({
    description: 'Doctor membership details',
    example: { associations: ['Medical Association'] },
    required: false,
    nullable: true,
  })
  members4?: Record<string, any>;

  @ApiProperty({
    description: 'Doctor scientific work details',
    example: { publications: 10, research: 'Cardiology' },
    required: false,
    nullable: true,
  })
  scientificWork5?: Record<string, any>;

  @ApiProperty({
    description: 'Doctor papers details',
    example: { count: 5, journals: ['Medical Journal'] },
    required: false,
    nullable: true,
  })
  papers6?: Record<string, any>;

  @ApiProperty({
    description: 'Doctor introduction image URL',
    example: 'https://example.com/doctor-intro.jpg',
    required: false,
    nullable: true,
  })
  introductionImage?: string;

  @ApiProperty({
    description: 'Professional license (encrypted)',
    example: 'https://example.com/professional-license.pdf',
    required: false,
    nullable: true,
  })
  professionalLicense?: Record<string, any>;

  @ApiProperty({
    description: 'Certificate of practical training (encrypted)',
    example: 'https://example.com/practical-training.pdf',
    required: false,
    nullable: true,
  })
  certificatePracticalTraining?: Record<string, any>;

  @ApiProperty({
    description: 'Medical license (encrypted)',
    example: 'https://example.com/medical-license.pdf',
    required: false,
    nullable: true,
  })
  medicalLicense?: Record<string, any>;

  constructor(doctorInfo: any) {
    this.id = doctorInfo._id;
    this.fullName = doctorInfo.fullName;
    this.gender = doctorInfo.gender;
    this.academicDegree = doctorInfo.academicDegree;
    this.experience = doctorInfo.experience;
    this.position = doctorInfo.position;
    this.introduction1 = doctorInfo.introduction1;
    this.workProcess2 = doctorInfo.workProcess2;
    this.studyProcess3 = doctorInfo.studyProcess3;
    this.members4 = doctorInfo.members4;
    this.scientificWork5 = doctorInfo.scientificWork5;
    this.papers6 = doctorInfo.papers6;
    this.introductionImage = doctorInfo.introductionImage;
    this.professionalLicense = doctorInfo.professionalLicense;
    this.certificatePracticalTraining = doctorInfo.certificatePracticalTraining;
    this.medicalLicense = doctorInfo.medicalLicense;
  }
}
