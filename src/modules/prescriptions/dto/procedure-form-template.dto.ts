import { ApiProperty } from '@nestjs/swagger';

/**
 * Procedure Form Template DTO
 * Template for PROCEDURE type ERM form
 */
export class ProcedureFormTemplateDto {
  @ApiProperty({ example: 'UUID' })
  ermId: string;

  @ApiProperty({ example: 'PROCEDURE' })
  recordType: string;

  @ApiProperty({ example: 'DRAFT' })
  status: string;

  @ApiProperty({
    description: 'Form fields structure',
    example: {
      procedureCode: {
        type: 'text',
        required: false,
        label: 'Procedure Code',
      },
      indication: {
        type: 'textarea',
        required: false,
        label: 'Indication',
      },
      bodySite: {
        type: 'text',
        required: false,
        label: 'Procedure Site',
      },
      side: {
        type: 'enum',
        required: false,
        options: ['LEFT', 'RIGHT', 'BILATERAL'],
        label: 'Side (Left/Right/Bilateral)',
      },
      anesthesiaType: {
        type: 'text',
        required: false,
        label: 'Anesthesia Type',
      },
      performedStart: {
        type: 'datetime',
        required: false,
        label: 'Start Time',
      },
      performedEnd: {
        type: 'datetime',
        required: false,
        label: 'End Time',
      },
      medications: {
        type: 'json',
        required: false,
        label: 'Medications Used',
      },
      devices: {
        type: 'textarea',
        required: false,
        label: 'Devices Used',
      },
      description: {
        type: 'textarea',
        required: false,
        label: 'Procedure Description',
      },
      painScoreBefore: {
        type: 'number',
        required: false,
        min: 0,
        max: 10,
        label: 'Pain Score Before',
      },
      painScoreAfter: {
        type: 'number',
        required: false,
        min: 0,
        max: 10,
        label: 'Pain Score After',
      },
      immediateOutcome: {
        type: 'enum',
        required: false,
        options: ['GOOD', 'FAIR', 'POOR'],
        label: 'Immediate Outcome',
      },
      complications: {
        type: 'json',
        required: false,
        label: 'Complications',
      },
      postCareInstructions: {
        type: 'textarea',
        required: false,
        label: 'Post-Care Instructions',
      },
      followUpPlan: {
        type: 'textarea',
        required: false,
        label: 'Follow-up Plan',
      },
    },
  })
  fields: any;

  @ApiProperty({ required: false, description: 'Current saved data if exists' })
  currentData?: any;
}
