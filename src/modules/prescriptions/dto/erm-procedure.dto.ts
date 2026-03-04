import { ApiProperty } from '@nestjs/swagger';
import { BodySide, ImmediateOutcome } from '../enums';

/**
 * ERM Procedure Detail DTO
 * 
 * Response DTO for medical procedure records
 */
export class ERMProcedureDto {
  @ApiProperty({
    description: 'Procedure record ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  _id: string;

  @ApiProperty({
    description: 'ERM record ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  erm_id: string;

  @ApiProperty({
    description: 'Procedure code',
    example: 'INJECT-CORTICO',
    required: false,
  })
  procedure_code?: string;

  @ApiProperty({
    description: 'Clinical indication',
    example: 'Chronic shoulder pain, unresponsive to conservative treatment',
    required: false,
  })
  indication?: string;

  @ApiProperty({
    description: 'Body site of procedure',
    example: 'Right shoulder joint',
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
    description: 'Anesthesia type',
    example: 'Local anesthetic',
    required: false,
  })
  anesthesia_type?: string;

  @ApiProperty({
    description: 'Procedure start timestamp',
    example: '2026-03-01T13:00:00Z',
    required: false,
  })
  performed_start?: Date;

  @ApiProperty({
    description: 'Procedure end timestamp',
    example: '2026-03-01T13:15:00Z',
    required: false,
  })
  performed_end?: Date;

  @ApiProperty({
    description: 'Medications used (structured JSON)',
    example: [
      { name: 'Triamcinolone', dose: '40mg', route: 'Intra-articular' },
      { name: 'Lidocaine', dose: '2ml', route: 'Local' },
    ],
    required: false,
  })
  medications?: any;

  @ApiProperty({
    description: 'Devices or equipment used',
    example: 'Ultrasound-guided injection',
    required: false,
  })
  devices?: string;

  @ApiProperty({
    description: 'Procedure description',
    example: 'Ultrasound-guided corticosteroid injection into glenohumeral joint',
    required: false,
  })
  description?: string;

  @ApiProperty({
    description: 'Pain score before procedure (0-10)',
    example: 8,
    required: false,
  })
  pain_score_before?: number;

  @ApiProperty({
    description: 'Pain score after procedure (0-10)',
    example: 3,
    required: false,
  })
  pain_score_after?: number;

  @ApiProperty({
    description: 'Immediate outcome',
    enum: ImmediateOutcome,
    example: 'GOOD',
    required: false,
  })
  immediate_outcome?: ImmediateOutcome;

  @ApiProperty({
    description: 'Complications (structured JSON)',
    example: { occurred: false, details: 'None' },
    required: false,
  })
  complications?: any;

  @ApiProperty({
    description: 'Post-procedure care instructions',
    example: 'Rest for 24 hours, ice pack 3x daily, avoid strenuous activity for 1 week',
    required: false,
  })
  post_care_instructions?: string;

  @ApiProperty({
    description: 'Follow-up plan',
    example: 'Review in 2 weeks',
    required: false,
  })
  follow_up_plan?: string;

  @ApiProperty({
    description: 'Record creation timestamp',
    example: '2026-03-01T13:30:00Z',
  })
  created_at: Date;
}
