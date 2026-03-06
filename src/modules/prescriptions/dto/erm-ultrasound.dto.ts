import { ApiProperty } from '@nestjs/swagger';
import { BodySide } from '../enums';

/**
 * ERM Ultrasound Detail DTO
 * 
 * Response DTO for ultrasound examination records
 */
export class ERMUltrasoundDto {
  @ApiProperty({
    description: 'Ultrasound record ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  _id: string;

  @ApiProperty({
    description: 'ERM record ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  erm_id: string;

  @ApiProperty({
    description: 'Service code',
    example: 'US-SHOULDER',
    required: false,
  })
  service_code?: string;

  @ApiProperty({
    description: 'Clinical indication',
    example: 'Shoulder pain with suspected rotator cuff injury',
    required: false,
  })
  indication?: string;

  @ApiProperty({
    description: 'Body site examined',
    example: 'Right shoulder',
    required: false,
  })
  body_site?: string;

  @ApiProperty({
    description: 'Body side',
    enum: BodySide,
    example: BodySide.RIGHT,
    required: false,
  })
  side?: BodySide;

  @ApiProperty({
    description: 'Imaging technique',
    example: 'High-frequency linear probe',
    required: false,
  })
  technique?: string;

  @ApiProperty({
    description: 'Ultrasound findings',
    example: 'Partial-thickness tear of supraspinatus tendon',
    required: false,
  })
  findings?: string;

  @ApiProperty({
    description: 'Measurements (structured JSON)',
    example: { tendonThickness: '8mm', fluidCollection: '5ml' },
    required: false,
  })
  measurements?: any;

  @ApiProperty({
    description: 'Clinical conclusion',
    example: 'Rotator cuff tendinopathy with partial tear',
    required: false,
  })
  conclusion?: string;

  @ApiProperty({
    description: 'Clinical recommendations',
    example: 'Consider MRI for surgical planning',
    required: false,
  })
  recommendations?: string;

  @ApiProperty({
    description: 'Array of ultrasound image URLs',
    example: ['https://storage.example.com/us1.jpg'],
    required: false,
  })
  image_urls?: any;

  @ApiProperty({
    description: 'Procedure performed timestamp',
    example: '2026-03-01T11:00:00Z',
  })
  performed_at: Date;
}
