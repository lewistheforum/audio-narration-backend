import { ApiProperty } from '@nestjs/swagger';

/**
 * ERM X-ray Detail DTO
 * 
 * Response DTO for X-ray examination records
 */
export class ERMXrayDto {
  @ApiProperty({
    description: 'X-ray record ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  _id: string;

  @ApiProperty({
    description: 'ERM record ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  erm_id: string;

  @ApiProperty({
    description: 'Anatomical region scanned',
    example: 'Lumbar Spine',
    required: false,
  })
  region?: string;

  @ApiProperty({
    description: 'X-ray projection type (e.g., AP, Lateral)',
    example: 'AP and Lateral',
    required: false,
  })
  projection?: string;

  @ApiProperty({
    description: 'Clinical indication for X-ray',
    example: 'Lower back pain for 2 weeks',
    required: false,
  })
  indication?: string;

  @ApiProperty({
    description: 'Imaging technique used',
    example: 'Standard digital radiography',
    required: false,
  })
  technique?: string;

  @ApiProperty({
    description: 'Radiological findings',
    example: 'Mild degenerative changes at L4-L5',
    required: false,
  })
  findings?: string;

  @ApiProperty({
    description: 'Osteoarthritis grade (if applicable)',
    example: 'Grade 2',
    required: false,
  })
  osteoarthritis_grade?: string;

  @ApiProperty({
    description: 'Radiological conclusion',
    example: 'Mild lumbar spondylosis',
    required: false,
  })
  conclusion?: string;

  @ApiProperty({
    description: 'Clinical recommendations',
    example: 'Physiotherapy recommended',
    required: false,
  })
  recommendations?: string;

  @ApiProperty({
    description: 'Array of X-ray image URLs',
    example: ['https://storage.example.com/xray1.jpg', 'https://storage.example.com/xray2.jpg'],
    required: false,
  })
  image_urls?: any;

  @ApiProperty({
    description: 'Record creation timestamp',
    example: '2026-03-01T10:30:00Z',
  })
  created_at: Date;
}
