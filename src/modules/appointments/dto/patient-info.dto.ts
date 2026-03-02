import { ApiProperty } from '@nestjs/swagger';

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
    description: 'Medical history summary',
    example: 'Tiền sử bệnh tim mạch',
    nullable: true,
  })
  medicalHistory?: string | null;
}
