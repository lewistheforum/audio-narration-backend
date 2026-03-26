import { ApiProperty } from '@nestjs/swagger';

export class KnowledgeBaseSyncDataDto {
  @ApiProperty({ description: 'Number of clinic services synced' })
  clinic_services_synced: number;

  @ApiProperty({ description: 'Number of doctor profiles synced' })
  doctor_profiles_synced: number;

  @ApiProperty({ description: 'Number of clinic info synced' })
  clinic_info_synced: number;

  @ApiProperty({ description: 'Number of staff info synced' })
  staff_info_synced: number;

  @ApiProperty({ description: 'Number of blogs synced' })
  blogs_synced: number;

  @ApiProperty({ description: 'Number of feedbacks synced' })
  feedbacks_synced: number;

  @ApiProperty({ description: 'Number of user info synced' })
  user_info_synced: number;

  @ApiProperty({ description: 'Number of doctor schedules synced' })
  doctor_schedules_synced: number;

  @ApiProperty({ description: 'Number of clinic working hours synced' })
  clinic_working_hours_synced: number;

  @ApiProperty({ description: 'Total number of records synced' })
  total_synced: number;
}

export class KnowledgeBaseSyncResponseDto {
  @ApiProperty({ description: 'Status code (0 = success, 1 = warning)' })
  statusCode: number;

  @ApiProperty({ description: 'Response message' })
  message: string;

  @ApiProperty({ description: 'Sync data', type: KnowledgeBaseSyncDataDto })
  data: KnowledgeBaseSyncDataDto;
}

export class KnowledgeBaseMedicineSyncResponseDto {
  @ApiProperty({ description: 'Status code (0 = success, 1 = warning)' })
  statusCode: number;

  @ApiProperty({ description: 'Response message' })
  message: string;

  @ApiProperty({ description: 'Sync data' })
  data: Record<string, unknown>;
}
