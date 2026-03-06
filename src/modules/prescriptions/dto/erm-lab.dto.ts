import { ApiProperty } from '@nestjs/swagger';
import { PanelName } from '../enums';

/**
 * ERM Lab Detail DTO
 * 
 * Response DTO for laboratory test records
 */
export class ERMLabDto {
  @ApiProperty({
    description: 'Lab record ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  _id: string;

  @ApiProperty({
    description: 'ERM record ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  erm_id: string;

  @ApiProperty({
    description: 'Lab panel name',
    enum: PanelName,
    example: PanelName.INFLAMMATION,
  })
  panel_name: PanelName;

  @ApiProperty({
    description: 'Specimen type (e.g., blood, urine)',
    example: 'Blood',
  })
  specimen_type: string;

  @ApiProperty({
    description: 'Specimen collection timestamp',
    example: '2026-03-01T08:00:00Z',
  })
  collected_at: Date;

  @ApiProperty({
    description: 'Lab receipt timestamp',
    example: '2026-03-01T09:00:00Z',
  })
  received_at: Date;

  @ApiProperty({
    description: 'Results report timestamp',
    example: '2026-03-01T14:00:00Z',
  })
  reported_at: Date;

  @ApiProperty({
    description: 'Lab test results (structured JSON)',
    example: {
      CRP: { value: 5.2, unit: 'mg/L', referenceRange: '0-5', status: 'ABNORMAL' },
      ESR: { value: 15, unit: 'mm/hr', referenceRange: '0-20', status: 'NORMAL' },
    },
  })
  results: any;

  @ApiProperty({
    description: 'Flag indicating if any results are abnormal',
    example: true,
  })
  abnormal_summary: boolean;

  @ApiProperty({
    description: 'Lab conclusion',
    example: 'Mild inflammation detected',
  })
  conclusion: string;

  @ApiProperty({
    description: 'Clinical recommendations',
    example: 'Repeat test in 2 weeks',
  })
  recommendations: string;

  @ApiProperty({
    description: 'Record creation timestamp',
    example: '2026-03-01T14:30:00Z',
  })
  created_at: Date;
}
