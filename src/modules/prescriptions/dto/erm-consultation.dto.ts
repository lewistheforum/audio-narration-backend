import { ApiProperty } from '@nestjs/swagger';
import { VisitType, Severity } from '../enums';

/**
 * ERM Consultation Detail DTO
 * 
 * Response DTO for medical consultation records
 */
export class ERMConsultationDto {
  @ApiProperty({
    description: 'Consultation record ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  _id: string;

  @ApiProperty({
    description: 'ERM record ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  erm_id: string;

  @ApiProperty({
    description: 'Visit type',
    enum: VisitType,
    example: 'INITIAL',
  })
  visit_type: VisitType;

  @ApiProperty({
    description: 'Main service code',
    example: 'CONSULT-001',
    required: false,
  })
  main_service_code?: string;

  @ApiProperty({
    description: 'Chief complaint',
    example: 'Lower back pain',
    required: false,
  })
  chief_complaint?: string;

  @ApiProperty({
    description: 'Onset and duration',
    example: '2 weeks',
    required: false,
  })
  onset_duration?: string;

  @ApiProperty({
    description: 'Pain location',
    example: 'L4-L5 region',
    required: false,
  })
  pain_location?: string;

  @ApiProperty({
    description: 'Pain character',
    example: 'Sharp, stabbing',
    required: false,
  })
  pain_character?: string;

  @ApiProperty({
    description: 'Pain intensity (0-10)',
    example: 7,
    required: false,
  })
  pain_intensity?: number;

  @ApiProperty({
    description: 'Aggravating factors',
    example: 'Bending forward, prolonged sitting',
    required: false,
  })
  aggravating_factors?: string;

  @ApiProperty({
    description: 'Relieving factors',
    example: 'Rest, lying down',
    required: false,
  })
  relieving_factors?: string;

  @ApiProperty({
    description: 'Functional limitations',
    example: 'Difficulty walking > 15 minutes',
    required: false,
  })
  functional_limitations?: string;

  @ApiProperty({
    description: 'Past musculoskeletal history',
    example: 'Previous right knee injury 5 years ago',
    required: false,
  })
  past_msk_history?: string;

  @ApiProperty({
    description: 'Past medical history',
    example: 'Hypertension, Type 2 DM',
    required: false,
  })
  past_medical_history?: string;

  @ApiProperty({
    description: 'Medication history',
    example: 'Metformin 500mg twice daily',
    required: false,
  })
  medication_history?: string;

  @ApiProperty({
    description: 'Family history',
    example: 'Father had osteoarthritis',
    required: false,
  })
  family_history?: string;

  @ApiProperty({
    description: 'Red flags (structured JSON)',
    example: { fever: false, weightLoss: false, trauma: false },
    required: false,
  })
  red_flags?: any;

  @ApiProperty({
    description: 'Vital signs (structured JSON)',
    example: { BP: '130/85', HR: 78, Temp: 36.8 },
    required: false,
  })
  vital_signs?: any;

  @ApiProperty({
    description: 'Inspection findings',
    example: 'Normal posture, no visible deformities',
    required: false,
  })
  inspection_findings?: string;

  @ApiProperty({
    description: 'Palpation findings',
    example: 'Tenderness over L4-L5',
    required: false,
  })
  palpation_findings?: string;

  @ApiProperty({
    description: 'Range of motion findings (structured JSON)',
    example: { flexion: '70 degrees', extension: '20 degrees' },
    required: false,
  })
  range_of_motion?: any;

  @ApiProperty({
    description: 'Special tests results (structured JSON)',
    example: { straightLegRaise: 'Positive at 45 degrees' },
    required: false,
  })
  special_tests?: any;

  @ApiProperty({
    description: 'Neurological examination findings',
    example: 'Reflexes intact, no motor deficits',
    required: false,
  })
  neuro_exam?: string;

  @ApiProperty({
    description: 'Gait assessment',
    example: 'Antalgic gait noted',
    required: false,
  })
  gait_assessment?: string;

  @ApiProperty({
    description: 'Working diagnosis (structured JSON)',
    example: { primary: 'Lumbar disc herniation', secondary: 'Muscle strain' },
    required: false,
  })
  working_diagnosis?: any;

  @ApiProperty({
    description: 'Severity assessment',
    enum: Severity,
    example: Severity.MODERATE,
    required: false,
  })
  severity?: Severity;

  @ApiProperty({
    description: 'Comorbid impact',
    example: 'Diabetes may affect healing',
    required: false,
  })
  comorbid_impact?: string;

  @ApiProperty({
    description: 'Risk factors',
    example: 'Sedentary lifestyle, obesity',
    required: false,
  })
  risk_factors?: string;

  @ApiProperty({
    description: 'Physiotherapy plan (structured JSON)',
    example: { exercises: ['Core strengthening', 'Stretching'], frequency: '3x per week' },
    required: false,
  })
  physiotherapy_plan?: any;

  @ApiProperty({
    description: 'Education and advice provided',
    example: 'Posture correction, ergonomic workplace setup',
    required: false,
  })
  education_advice?: string;

  @ApiProperty({
    description: 'Follow-up date',
    example: '2026-03-15',
    required: false,
  })
  follow_up_date?: string;

  @ApiProperty({
    description: 'Condition for follow-up',
    example: 'If pain persists or worsens',
    required: false,
  })
  follow_up_condition?: string;

  @ApiProperty({
    description: 'Record creation timestamp',
    example: '2026-03-01T10:30:00Z',
  })
  created_at: Date;
}
