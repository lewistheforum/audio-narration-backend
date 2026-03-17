import { ApiProperty } from '@nestjs/swagger';

/**
 * Public Clinic Info DTO
 *
 * Clinic information for doctor details (public view)
 */
export class PublicClinicInfo {
  @ApiProperty({
    description: 'Clinic account ID',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  id: string;

  @ApiProperty({
    description: 'Clinic name',
    example: 'City Medical Clinic',
  })
  clinicName: string;

  @ApiProperty({
    description: 'Clinic phone number',
    example: '+84987654321',
    required: false,
    nullable: true,
  })
  phone?: string;

  constructor(clinicInfo: any) {
    this.id = clinicInfo._id;
    this.clinicName = clinicInfo.clinicName;
    this.phone = clinicInfo.phone;
  }
}
