import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsString, IsOptional, IsArray, ValidateNested, IsNumber, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Medicine Detail DTO
 * 
 * Nested medicine information in E-Prescription detail
 */
export class MedicineDetailDto {
  @ApiProperty({
    description: 'Medicine ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  id: string;

  @ApiProperty({
    description: 'Medicine name',
    example: 'Paracetamol',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Dosage information (subtitle_0)',
    example: '500mg Tablet',
    required: false,
  })
  @IsOptional()
  @IsString()
  subtitle_0?: string;

  @ApiProperty({
    description: 'Usage instructions',
    example: 'Take 1 tablet every 6 hours after meals',
    required: false,
  })
  @IsOptional()
  @IsString()
  usage?: string;

  @ApiProperty({
    description: 'Side effects',
    example: 'Drowsiness, nausea, headache',
    required: false,
  })
  @IsOptional()
  @IsString()
  side_effect?: string;
}

/**
 * Detail E-Prescription Item DTO
 * 
 * Individual medicine item in the prescription
 */
export class DetailEPrescriptionItemDto {
  @ApiProperty({
    description: 'Detail E-Prescription ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID()
  _id: string;

  @ApiProperty({
    description: 'Medicine information',
    type: MedicineDetailDto,
  })
  @ValidateNested()
  @Type(() => MedicineDetailDto)
  medicine: MedicineDetailDto;

  @ApiProperty({
    description: 'Quantity prescribed',
    example: 20,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  quantity?: number;

  @ApiProperty({
    description: 'Usage instruction (check_out)',
    example: 'Take 1 tablet 3 times daily',
    required: false,
  })
  @IsOptional()
  @IsString()
  check_out?: string;

  @ApiProperty({
    description: 'Additional note from doctor',
    example: 'Take with food to reduce stomach irritation',
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;
}

/**
 * Patient E-Prescription Detail Response DTO
 * 
 * Full electronic prescription details for patient view
 * Only accessible for appointments with COMPLETED status
 */
export class PatientEPrescriptionDetailResponseDto {
  @ApiProperty({
    description: 'E-Prescription ID',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  @IsUUID()
  _id: string;

  @ApiProperty({
    description: 'Associated Appointment ID',
    example: '123e4567-e89b-12d3-a456-426614174003',
  })
  @IsUUID()
  appointment_id: string;

  @ApiProperty({
    description: 'Doctor\'s note for the prescription',
    example: 'Patient shows signs of acute viral infection. Prescribed symptomatic treatment.',
    required: false,
  })
  @IsOptional()
  @IsString()
  doctor_note?: string;

  @ApiProperty({
    description: 'List of prescribed medicines with details',
    type: [DetailEPrescriptionItemDto],
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DetailEPrescriptionItemDto)
  detail_e_prescriptions: DetailEPrescriptionItemDto[];

  @ApiProperty({
    description: 'Prescription creation timestamp',
    example: '2026-03-03T10:30:00Z',
  })
  @IsDate()
  created_at: Date;
}
