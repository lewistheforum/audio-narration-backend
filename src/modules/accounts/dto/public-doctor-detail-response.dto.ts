import { ApiProperty } from '@nestjs/swagger';
import { PublicDoctorDetailData } from './public-doctor-detail-data.dto';

/**
 * Public Doctor Detail Response DTO
 *
 * Response wrapper for public doctor details.
 * Uses allowlist approach to prevent sensitive data leakage.
 */
export class PublicDoctorDetailResponseDto {
  @ApiProperty({
    description: 'Response message',
    example: 'Doctor details retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Doctor details data (public view)',
    type: PublicDoctorDetailData,
  })
  data: PublicDoctorDetailData;

  constructor(data: PublicDoctorDetailData) {
    this.message = 'Doctor details retrieved successfully';
    this.data = data;
  }
}
