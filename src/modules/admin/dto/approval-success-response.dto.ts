import { ApiProperty } from '@nestjs/swagger';

/**
 * Approval Success Response DTO
 */
export class ApprovalSuccessResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Registration approved successfully' })
  message: string;

  @ApiProperty({
    type: 'object',
    properties: {
      subscriptionId: { type: 'string' },
      clinicName: { type: 'string' },
      newStatus: { type: 'string', example: 'PENDING_PAYMENT' },
      emailSent: { type: 'boolean' },
      nextStep: { type: 'string', example: 'PAYMENT' },
    },
  })
  data: {
    subscriptionId: string;
    clinicName: string;
    newStatus: string;
    emailSent: boolean;
    nextStep: string;
  };
}
