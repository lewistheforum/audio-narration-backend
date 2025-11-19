import { ApiProperty } from '@nestjs/swagger';
import { Profile, Gender, BloodType } from '../entities/profile.entity';

/**
 * Profile Response DTO
 * 
 * Sanitized profile data returned to clients
 * 
 * Usage:
 * - API responses for profile queries
 * - User profile information display
 */
export class ProfileResponseDto {
  @ApiProperty({
    description: 'Profile unique identifier',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  id: string;

  @ApiProperty({
    description: 'User ID associated with this profile',
    example: 'b2c3d4e5-f6a7-8901-2345-67890abcdef1',
  })
  userId: string;

  @ApiProperty({
    description: 'Phone number',
    example: '+1234567890',
    required: false,
    nullable: true,
  })
  phoneNumber?: string;

  @ApiProperty({
    description: 'Date of birth',
    example: '1990-01-15',
    type: Date,
    required: false,
    nullable: true,
  })
  dateOfBirth?: Date;

  @ApiProperty({
    description: 'Gender',
    enum: Gender,
    example: Gender.MALE,
    required: false,
    nullable: true,
  })
  gender?: Gender;

  @ApiProperty({
    description: 'Full address',
    example: '123 Main Street, Apt 4B',
    required: false,
    nullable: true,
  })
  address?: string;

  @ApiProperty({
    description: 'City',
    example: 'New York',
    required: false,
    nullable: true,
  })
  city?: string;

  @ApiProperty({
    description: 'State/Province',
    example: 'NY',
    required: false,
    nullable: true,
  })
  state?: string;

  @ApiProperty({
    description: 'Country',
    example: 'United States',
    required: false,
    nullable: true,
  })
  country?: string;

  @ApiProperty({
    description: 'Postal/ZIP code',
    example: '10001',
    required: false,
    nullable: true,
  })
  postalCode?: string;

  @ApiProperty({
    description: 'Blood type',
    enum: BloodType,
    example: BloodType.O_POSITIVE,
    required: false,
    nullable: true,
  })
  bloodType?: BloodType;

  @ApiProperty({
    description: 'Height in centimeters',
    example: 175.5,
    type: Number,
    required: false,
    nullable: true,
  })
  height?: number;

  @ApiProperty({
    description: 'Weight in kilograms',
    example: 70.5,
    type: Number,
    required: false,
    nullable: true,
  })
  weight?: number;

  @ApiProperty({
    description: 'Allergies (comma-separated)',
    example: 'Peanuts, Penicillin',
    required: false,
    nullable: true,
  })
  allergies?: string;

  @ApiProperty({
    description: 'Medical conditions (comma-separated)',
    example: 'Diabetes Type 2, Hypertension',
    required: false,
    nullable: true,
  })
  medicalConditions?: string;

  @ApiProperty({
    description: 'Current medications (comma-separated)',
    example: 'Metformin 500mg, Lisinopril 10mg',
    required: false,
    nullable: true,
  })
  currentMedications?: string;

  @ApiProperty({
    description: 'Emergency contact name',
    example: 'Jane Doe',
    required: false,
    nullable: true,
  })
  emergencyContactName?: string;

  @ApiProperty({
    description: 'Emergency contact phone number',
    example: '+1234567890',
    required: false,
    nullable: true,
  })
  emergencyContactPhone?: string;

  @ApiProperty({
    description: 'Emergency contact relationship',
    example: 'Spouse',
    required: false,
    nullable: true,
  })
  emergencyContactRelationship?: string;

  @ApiProperty({
    description: 'Insurance provider name',
    example: 'Blue Cross Blue Shield',
    required: false,
    nullable: true,
  })
  insuranceProvider?: string;

  @ApiProperty({
    description: 'Insurance policy number',
    example: 'BC12345678',
    required: false,
    nullable: true,
  })
  insurancePolicyNumber?: string;

  @ApiProperty({
    description: 'Short biography or description',
    example: 'Health enthusiast, yoga instructor',
    required: false,
    nullable: true,
  })
  bio?: string;

  @ApiProperty({
    description: 'Occupation',
    example: 'Software Engineer',
    required: false,
    nullable: true,
  })
  occupation?: string;

  @ApiProperty({
    description: 'Profile avatar/photo URL',
    example: 'https://res.cloudinary.com/example/image/upload/avatar.jpg',
    required: false,
    nullable: true,
  })
  avatar?: string;

  @ApiProperty({
    description: 'Whether profile is complete',
    example: true,
  })
  isProfileComplete: boolean;

  @ApiProperty({
    description: 'Profile creation timestamp',
    example: '2023-10-27T10:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2023-10-27T10:00:00.000Z',
  })
  updatedAt: Date;

  constructor(profile: Partial<Profile>) {
    this.id = profile.id;
    this.userId = profile.userId;
    this.phoneNumber = profile.phoneNumber;
    this.dateOfBirth = profile.dateOfBirth;
    this.gender = profile.gender;
    this.address = profile.address;
    this.city = profile.city;
    this.state = profile.state;
    this.country = profile.country;
    this.postalCode = profile.postalCode;
    this.bloodType = profile.bloodType;
    this.height = profile.height;
    this.weight = profile.weight;
    this.allergies = profile.allergies;
    this.medicalConditions = profile.medicalConditions;
    this.currentMedications = profile.currentMedications;
    this.emergencyContactName = profile.emergencyContactName;
    this.emergencyContactPhone = profile.emergencyContactPhone;
    this.emergencyContactRelationship = profile.emergencyContactRelationship;
    this.insuranceProvider = profile.insuranceProvider;
    this.insurancePolicyNumber = profile.insurancePolicyNumber;
    this.bio = profile.bio;
    this.occupation = profile.occupation;
    this.avatar = profile.avatar;
    this.isProfileComplete = profile.isProfileComplete ?? false;
    this.createdAt = profile.createdAt;
    this.updatedAt = profile.updatedAt;
  }
}
