import { ApiProperty } from '@nestjs/swagger';

/**
 * Patient Address DTO
 *
 * Contains patient address information
 */
export class PatientAddressDto {
  @ApiProperty({
    description: 'Full address',
    example: '123 Đường ABC',
  })
  address: string;

  @ApiProperty({
    description: 'Ward code',
    example: '00001',
  })
  ward: string;

  @ApiProperty({
    description: 'Ward name',
    example: 'Phường Bến Nghé',
  })
  wardName: string;

  @ApiProperty({
    description: 'District code',
    example: '001',
  })
  district: string;

  @ApiProperty({
    description: 'District name',
    example: 'Quận 1',
  })
  districtName: string;

  @ApiProperty({
    description: 'Province code',
    example: '79',
  })
  province: string;

  @ApiProperty({
    description: 'Province name',
    example: 'Thành phố Hồ Chí Minh',
  })
  provinceName: string;
}

/**
 * Patient Info DTO
 *
 * Contains patient information for doctor's view
 */
export class PatientInfoDto {
  @ApiProperty({
    description: 'Patient ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  patientId: string;

  @ApiProperty({
    description: 'Patient full name',
    example: 'Nguyễn Văn A',
  })
  fullName: string;

  @ApiProperty({
    description: 'Date of birth',
    example: '1990-01-15',
    nullable: true,
  })
  dateOfBirth?: string | null;

  @ApiProperty({
    description: 'Gender',
    example: 'Male',
    nullable: true,
  })
  gender?: string | null;

  @ApiProperty({
    description: 'Phone number',
    example: '0901234567',
    nullable: true,
  })
  phone?: string | null;

  @ApiProperty({
    description: 'Email address',
    example: 'patient@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Profile picture URL',
    example: 'https://example.com/profile.jpg',
    nullable: true,
  })
  profilePicture?: string | null;

  @ApiProperty({
    description: 'Patient address',
    type: PatientAddressDto,
    nullable: true,
  })
  address?: PatientAddressDto | null;
}
