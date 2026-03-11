import { ApiProperty } from '@nestjs/swagger';

/**
 * ==========================================
 * CONSULTATION ERM DATA
 * ==========================================
 */

export class VitalSignsDto {
  @ApiProperty({ description: 'Blood pressure', example: '120/80', nullable: true })
  blood_pressure?: string | null;

  @ApiProperty({ description: 'Heart rate (bpm)', example: 72, nullable: true })
  heart_rate?: number | null;

  @ApiProperty({ description: 'Temperature (°C)', example: 36.5, nullable: true })
  temperature?: number | null;

  @ApiProperty({ description: 'Respiratory rate (breaths/min)', example: 18, nullable: true })
  respiratory_rate?: number | null;
}

export class ConsultationDataDto {
  @ApiProperty({
    description: 'Visit type',
    example: 'FIRST_VISIT',
    enum: ['FIRST_VISIT', 'FOLLOW_UP', 'POST_PROCEDURE', 'ROUTINE', 'ONLINE', 'EMERGENCY'],
  })
  visit_type: string;

  @ApiProperty({ description: 'Main service code', example: 'CONS001', nullable: true })
  main_service_code: string | null;

  @ApiProperty({ description: 'Chief complaint', example: 'Đau lưng', nullable: true })
  chief_complaint: string | null;

  @ApiProperty({ description: 'Onset duration', example: '2 tuần', nullable: true })
  onset_duration: string | null;

  @ApiProperty({ description: 'Pain location', example: 'Vùng thắt lưng', nullable: true })
  pain_location: string | null;

  @ApiProperty({ description: 'Pain character', example: 'Đau âm ỉ', nullable: true })
  pain_character: string | null;

  @ApiProperty({ description: 'Pain intensity (0-10)', example: 6, nullable: true })
  pain_intensity: number | null;

  @ApiProperty({ description: 'Aggravating factors', example: 'Ngồi lâu', nullable: true })
  aggravating_factors: string | null;

  @ApiProperty({ description: 'Relieving factors', example: 'Nghỉ ngơi', nullable: true })
  relieving_factors: string | null;

  @ApiProperty({ description: 'Functional limitations', example: 'Khó cúi xuống', nullable: true })
  functional_limitations: string | null;

  @ApiProperty({ description: 'Past MSK history', nullable: true })
  pastMsk_history: string | null;

  @ApiProperty({ description: 'Past medical history', nullable: true })
  pastMedical_history: string | null;

  @ApiProperty({ description: 'Medication history', nullable: true })
  medication_history: string | null;

  @ApiProperty({ description: 'Family history', nullable: true })
  family_history: string | null;

  @ApiProperty({ description: 'Red flags (JSONB)', nullable: true })
  red_flags: any;

  @ApiProperty({ description: 'Vital signs', type: VitalSignsDto, nullable: true })
  vital_signs: VitalSignsDto | null;

  @ApiProperty({ description: 'Inspection findings', nullable: true })
  inspection_findings: string | null;

  @ApiProperty({ description: 'Palpation findings', nullable: true })
  palpation_findings: string | null;

  @ApiProperty({ description: 'Range of motion (JSONB)', nullable: true })
  range_of_motion: any;

  @ApiProperty({ description: 'Special tests (JSONB)', nullable: true })
  special_tests: any;

  @ApiProperty({ description: 'Neurological exam', nullable: true })
  neuro_exam: string | null;

  @ApiProperty({ description: 'Gait assessment', nullable: true })
  gait_assessment: string | null;

  @ApiProperty({ description: 'Working diagnosis (JSONB)', nullable: true })
  working_diagnosis: any;

  @ApiProperty({
    description: 'Severity',
    example: 'MODERATE',
    enum: ['MILD', 'MODERATE', 'SEVERE'],
    nullable: true,
  })
  severity: string | null;

  @ApiProperty({ description: 'Comorbid impact', nullable: true })
  comorbid_impact: string | null;

  @ApiProperty({ description: 'Risk factors', nullable: true })
  risk_factors: string | null;

  @ApiProperty({ description: 'Physiotherapy plan (JSONB)', nullable: true })
  physiotherapy_plan: any;

  @ApiProperty({ description: 'Education and advice', nullable: true })
  education_advice: string | null;

  @ApiProperty({ description: 'Follow-up date', nullable: true })
  follow_up_date: string | null;

  @ApiProperty({ description: 'Follow-up condition', nullable: true })
  follow_up_condition: string | null;
}

/**
 * ==========================================
 * XRAY ERM DATA
 * ==========================================
 */

export class ImageUrlDto {
  @ApiProperty({ description: 'Image URL', example: 'https://...' })
  url: string;

  @ApiProperty({ description: 'Thumbnail URL', example: 'https://...', nullable: true })
  thumbnail_url: string | null;

  @ApiProperty({ description: 'Uploaded at', example: '2026-03-08T10:00:00Z', nullable: true })
  uploaded_at: string | null;
}

export class XrayDataDto {
  @ApiProperty({ description: 'Region', example: 'Spine - Lumbar', nullable: true })
  region: string | null;

  @ApiProperty({ description: 'Projection', example: 'AP/Lateral', nullable: true })
  projection: string | null;

  @ApiProperty({ description: 'Indication', nullable: true })
  indication: string | null;

  @ApiProperty({ description: 'Technique', nullable: true })
  technique: string | null;

  @ApiProperty({ description: 'Findings', nullable: true })
  findings: string | null;

  @ApiProperty({ description: 'Osteoarthritis grade', nullable: true })
  osteoarthritis_grade: string | null;

  @ApiProperty({ description: 'Conclusion', nullable: true })
  conclusion: string | null;

  @ApiProperty({ description: 'Recommendations', nullable: true })
  recommendations: string | null;

  @ApiProperty({ description: 'Image URLs', type: [ImageUrlDto], nullable: true })
  image_urls: ImageUrlDto[] | null;
}

/**
 * ==========================================
 * ULTRASOUND ERM DATA
 * ==========================================
 */

export class UltrasoundDataDto {
  @ApiProperty({ description: 'Service code', example: 'US001', nullable: true })
  service_code: string | null;

  @ApiProperty({ description: 'Indication', nullable: true })
  indication: string | null;

  @ApiProperty({ description: 'Body site', nullable: true })
  body_site: string | null;

  @ApiProperty({
    description: 'Side',
    example: 'LEFT',
    enum: ['LEFT', 'RIGHT', 'BILATERAL'],
    nullable: true,
  })
  side: string | null;

  @ApiProperty({ description: 'Technique', nullable: true })
  technique: string | null;

  @ApiProperty({ description: 'Findings', nullable: true })
  findings: string | null;

  @ApiProperty({ description: 'Measurements (JSONB)', nullable: true })
  measurements: any;

  @ApiProperty({ description: 'Conclusion', nullable: true })
  conclusion: string | null;

  @ApiProperty({ description: 'Recommendations', nullable: true })
  recommendations: string | null;

  @ApiProperty({ description: 'Image URLs', type: [ImageUrlDto], nullable: true })
  image_urls: ImageUrlDto[] | null;

  @ApiProperty({ description: 'Performed at', example: '2026-03-08T10:00:00Z' })
  performed_at: Date;
}

/**
 * ==========================================
 * LAB ERM DATA
 * ==========================================
 */

export class LabDataDto {
  @ApiProperty({
    description: 'Panel name',
    example: 'INFLAMMATION',
    enum: ['INFLAMMATION', 'GOUT', 'METABOLIC', 'AUTOIMMUNE'],
  })
  panel_name: string;

  @ApiProperty({ description: 'Specimen type', example: 'Blood' })
  specimen_type: string;

  @ApiProperty({ description: 'Collected at', example: '2026-03-08T08:00:00Z' })
  collected_at: Date;

  @ApiProperty({ description: 'Received at', example: '2026-03-08T08:30:00Z' })
  received_at: Date;

  @ApiProperty({ description: 'Reported at', example: '2026-03-08T10:00:00Z' })
  reported_at: Date;

  @ApiProperty({ description: 'Test results (JSONB)' })
  results: any;

  @ApiProperty({ description: 'Abnormal summary flag' })
  abnormal_summary: boolean;

  @ApiProperty({ description: 'Conclusion' })
  conclusion: string;

  @ApiProperty({ description: 'Recommendations' })
  recommendations: string;
}

/**
 * ==========================================
 * PROCEDURE ERM DATA
 * ==========================================
 */

export class ProcedureDataDto {
  @ApiProperty({ description: 'Procedure code', nullable: true })
  procedure_code: string | null;

  @ApiProperty({ description: 'Indication', nullable: true })
  indication: string | null;

  @ApiProperty({ description: 'Body site', nullable: true })
  body_site: string | null;

  @ApiProperty({
    description: 'Side',
    example: 'LEFT',
    enum: ['LEFT', 'RIGHT', 'BILATERAL'],
    nullable: true,
  })
  side: string | null;

  @ApiProperty({ description: 'Anesthesia type', nullable: true })
  anesthesia_type: string | null;

  @ApiProperty({ description: 'Performed start time', nullable: true })
  performed_start: Date | null;

  @ApiProperty({ description: 'Performed end time', nullable: true })
  performed_end: Date | null;

  @ApiProperty({ description: 'Medications used (JSONB)', nullable: true })
  medications: any;

  @ApiProperty({ description: 'Devices used', nullable: true })
  devices: string | null;

  @ApiProperty({ description: 'Procedure description', nullable: true })
  description: string | null;

  @ApiProperty({ description: 'Pain score before (0-10)', nullable: true })
  pain_score_before: number | null;

  @ApiProperty({ description: 'Pain score after (0-10)', nullable: true })
  pain_score_after: number | null;

  @ApiProperty({
    description: 'Immediate outcome',
    example: 'GOOD',
    enum: ['GOOD', 'FAIR', 'POOR'],
    nullable: true,
  })
  immediate_outcome: string | null;

  @ApiProperty({ description: 'Complications (JSONB)', nullable: true })
  complications: any;

  @ApiProperty({ description: 'Post-care instructions', nullable: true })
  post_care_instructions: string | null;

  @ApiProperty({ description: 'Follow-up plan', nullable: true })
  follow_up_plan: string | null;
}

/**
 * ==========================================
 * BONE DENSITY ERM DATA
 * ==========================================
 */

export class BoneDensityDataDto {
  @ApiProperty({
    description: 'Scan site',
    example: 'LUMBAR_SPINE',
    enum: ['LUMBAR_SPINE', 'TOTAL_HIP', 'FEMORAL_NECK', 'FOREARM'],
  })
  site: string;

  @ApiProperty({ description: 'BMD value', nullable: true })
  bmd_value: string | null;

  @ApiProperty({ description: 'BMD unit', nullable: true })
  bmd_unit: string | null;

  @ApiProperty({ description: 'T-Score', nullable: true })
  t_score: number | null;

  @ApiProperty({ description: 'Z-Score', nullable: true })
  z_score: number | null;

  @ApiProperty({
    description: 'WHO category',
    example: 'OSTEOPENIA',
    enum: ['NORMAL', 'OSTEOPENIA', 'OSTEOPOROSIS'],
    nullable: true,
  })
  who_category: string | null;

  @ApiProperty({ description: 'Fracture risk comment', nullable: true })
  fracture_risk_comment: string | null;

  @ApiProperty({ description: 'Recommendations', nullable: true })
  recommendations: string | null;
}

/**
 * ==========================================
 * MAIN RESPONSE DTO
 * ==========================================
 */

export class DoctorERMDetailResponseDto {
  @ApiProperty({ description: 'ERM UUID', example: '123e4567-e89b-12d3-a456-426614174000' })
  erm_id: string;

  @ApiProperty({
    description: 'Service appointment UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  service_appointment_id: string;

  @ApiProperty({ description: 'Appointment UUID', example: '123e4567-e89b-12d3-a456-426614174000' })
  appointment_id: string;

  @ApiProperty({
    description: 'Record type',
    example: 'CONSULTATION',
    enum: ['CONSULTATION', 'XRAY', 'ULTRASOUND', 'LAB', 'PROCEDURE', 'BONE_DENSITY'],
  })
  record_type: string;

  @ApiProperty({ description: 'Service code', example: 'CONS001', nullable: true })
  service_code: string | null;

  @ApiProperty({ description: 'Service name', example: 'Khám tư vấn', nullable: true })
  service_name: string | null;

  @ApiProperty({ description: 'ERM status', example: 'COMPLETED' })
  status: string;

  @ApiProperty({ description: 'Created at', example: '2026-03-08T09:00:00Z' })
  created_at: Date;

  @ApiProperty({ description: 'Updated at', example: '2026-03-08T10:00:00Z', nullable: true })
  updated_at: Date | null;

  @ApiProperty({ description: 'Created by UUID', example: '123e4567-e89b-12d3-a456-426614174000' })
  created_by: string;

  @ApiProperty({ description: 'Creator name', example: 'Dr. Nguyễn Văn A' })
  created_by_name: string;

  @ApiProperty({
    description: 'Consultation data (if record_type = CONSULTATION)',
    type: ConsultationDataDto,
    nullable: true,
  })
  consultation_data: ConsultationDataDto | null;

  @ApiProperty({
    description: 'X-ray data (if record_type = XRAY)',
    type: XrayDataDto,
    nullable: true,
  })
  xray_data: XrayDataDto | null;

  @ApiProperty({
    description: 'Ultrasound data (if record_type = ULTRASOUND)',
    type: UltrasoundDataDto,
    nullable: true,
  })
  ultrasound_data: UltrasoundDataDto | null;

  @ApiProperty({
    description: 'Lab data (if record_type = LAB)',
    type: LabDataDto,
    nullable: true,
  })
  lab_data: LabDataDto | null;

  @ApiProperty({
    description: 'Procedure data (if record_type = PROCEDURE)',
    type: ProcedureDataDto,
    nullable: true,
  })
  procedure_data: ProcedureDataDto | null;

  @ApiProperty({
    description: 'Bone density data (if record_type = BONE_DENSITY)',
    type: BoneDensityDataDto,
    nullable: true,
  })
  bone_density_data: BoneDensityDataDto | null;
}
