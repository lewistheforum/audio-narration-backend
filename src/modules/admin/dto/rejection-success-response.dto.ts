import { ApiProperty } from '@nestjs/swagger';

/**
 * Rejection Success Response DTO
 */
export class RejectionSuccessResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Registration rejected' })
  message: string;

  @ApiProperty({
    type: 'object',
    properties: {
      subscriptionId: { type: 'string' },
      clinicName: { type: 'string' },
      newStatus: { type: 'string', example: 'PENDING_LEGAL_SETUP' },
      rejectionReason: { type: 'string' },
      emailSent: { type: 'boolean' },
      nextStep: { type: 'string', example: 'RESUBMIT_DOCUMENTS' },
    },
  })
  data: {
    subscriptionId: string;
    clinicName: string;
    newStatus: string;
    rejectionReason: string;
    emailSent: boolean;
    nextStep: string;
  };
}
