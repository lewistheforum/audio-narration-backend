import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsBoolean, IsDateString, IsNotEmpty } from 'class-validator';
import { PanelName } from '../enums';

/**
 * Save Lab ERM Data DTO
 * Used for saving/updating lab test ERM data
 */
export class SaveLabErmDto {
  @ApiProperty({
    description: 'Lab panel name',
    enum: PanelName,
    example: PanelName.INFLAMMATION,
  })
  @IsEnum(PanelName)
  @IsNotEmpty()
  panelName: PanelName;

  @ApiProperty({ example: 'Máu tĩnh mạch' })
  @IsString()
  @IsNotEmpty()
  specimenType: string;

  @ApiProperty({ example: '2026-02-24T08:00:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  collectedAt: string;

  @ApiProperty({ example: '2026-02-24T08:30:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  receivedAt: string;

  @ApiProperty({ example: '2026-02-24T10:00:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  reportedAt: string;

  @ApiProperty({
    type: Object,
    example: {
      CRP: {
        value: 15.5,
        unit: 'mg/L',
        referenceRange: '0-5',
        isAbnormal: true,
      },
      ESR: {
        value: 25,
        unit: 'mm/h',
        referenceRange: '0-20',
        isAbnormal: true,
      },
    },
  })
  @IsNotEmpty()
  results: any;

  @ApiProperty({ example: true })
  @IsBoolean()
  @IsNotEmpty()
  abnormalSummary: boolean;

  @ApiProperty({ example: 'Tăng các chỉ số viêm' })
  @IsString()
  @IsNotEmpty()
  conclusion: string;

  @ApiProperty({ example: 'Theo dõi và điều trị viêm khớp' })
  @IsString()
  @IsNotEmpty()
  recommendations: string;
}
