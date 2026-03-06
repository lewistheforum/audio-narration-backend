import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { VisitType, Severity } from '../enums';

/**
 * Save Consultation ERM Data DTO
 * Used for saving/updating consultation ERM data
 */
export class SaveConsultationErmDto {
  @ApiProperty({
    description: 'Visit type',
    enum: VisitType,
    example: VisitType.FIRST_VISIT,
  })
  @IsEnum(VisitType)
  visitType: VisitType;

  @ApiProperty({ required: false, example: 'CONS001' })
  @IsOptional()
  @IsString()
  mainServiceCode?: string;

  @ApiProperty({ required: false, example: 'Đau khớp gối trái' })
  @IsOptional()
  @IsString()
  chiefComplaint?: string;

  @ApiProperty({ required: false, example: '2 tuần' })
  @IsOptional()
  @IsString()
  onsetDuration?: string;

  @ApiProperty({ required: false, example: 'Khớp gối trái' })
  @IsOptional()
  @IsString()
  painLocation?: string;

  @ApiProperty({ required: false, example: 'Đau âm ỉ, tăng khi vận động' })
  @IsOptional()
  @IsString()
  painCharacter?: string;

  @ApiProperty({ required: false, minimum: 0, maximum: 10, example: 6 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  painIntensity?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  aggravatingFactors?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  relievingFactors?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  functionalLimitations?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  pastMskHistory?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  pastMedicalHistory?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  medicationHistory?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  familyHistory?: string;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  redFlags?: any;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  vitalSigns?: any;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  inspectionFindings?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  palpationFindings?: string;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  rangeOfMotion?: any;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  specialTests?: any;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  neuroExam?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  gaitAssessment?: string;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  workingDiagnosis?: any;

  @ApiProperty({ required: false, enum: Severity })
  @IsOptional()
  @IsEnum(Severity)
  severity?: Severity;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  comorbidImpact?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  riskFactors?: string;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  physiotherapyPlan?: any;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  educationAdvice?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  followUpDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  followUpCondition?: string;
}
