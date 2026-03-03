import { ApiProperty } from '@nestjs/swagger';
import { ERMRecordType, ERMStatus } from '../enums';
import { ERMXrayDto } from './erm-xray.dto';
import { ERMLabDto } from './erm-lab.dto';
import { ERMConsultationDto } from './erm-consultation.dto';
import { ERMUltrasoundDto } from './erm-ultrasound.dto';
import { ERMBoneDensityDto } from './erm-bone-density.dto';
import { ERMProcedureDto } from './erm-procedure.dto';

/**
 * Patient ERM Detail Response DTO
 * 
 * Polymorphic response containing base ERM data and type-specific details
 * Enforces 3-layer linkage validation and visibility rules
 */
export class PatientERMDetailResponseDto {
  @ApiProperty({
    description: 'ERM record ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  _id: string;

  @ApiProperty({
    description: 'Appointment ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  appointment_id: string;

  @ApiProperty({
    description: 'ERM record type (determines the structure of details field)',
    enum: ERMRecordType,
    example: ERMRecordType.XRAY,
  })
  record_type: ERMRecordType;

  @ApiProperty({
    description: 'ERM status (only COMPLETED records are visible to patients)',
    enum: ERMStatus,
    example: ERMStatus.COMPLETED,
  })
  status: ERMStatus;

  @ApiProperty({
    description: 'Service code',
    example: 'XRAY-LUMBAR',
    required: false,
  })
  service_code?: string;

  @ApiProperty({
    description: 'Record creation timestamp',
    example: '2026-03-01T10:00:00Z',
  })
  created_at: Date;

  @ApiProperty({
    description: 'Record signed/finalized timestamp',
    example: '2026-03-01T15:00:00Z',
    required: false,
  })
  signed_at?: Date;

  @ApiProperty({
    description: 'Type-specific ERM details (polymorphic based on record_type)',
    oneOf: [
      { $ref: '#/components/schemas/ERMXrayDto' },
      { $ref: '#/components/schemas/ERMLabDto' },
      { $ref: '#/components/schemas/ERMConsultationDto' },
      { $ref: '#/components/schemas/ERMUltrasoundDto' },
      { $ref: '#/components/schemas/ERMBoneDensityDto' },
      { $ref: '#/components/schemas/ERMProcedureDto' },
    ],
  })
  details:
    | ERMXrayDto
    | ERMLabDto
    | ERMConsultationDto
    | ERMUltrasoundDto
    | ERMBoneDensityDto
    | ERMProcedureDto;
}
