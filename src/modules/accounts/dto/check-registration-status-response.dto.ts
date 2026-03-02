import { ApiProperty } from '@nestjs/swagger';
import { RegistrationStatus } from '../../subscriptions/enums/subscription-status.enum';

/**
 * Check Registration Status Response DTO
 *
 * Returns the current registration status and next step information
 * for a clinic admin registration flow.
 *
 * Used by POST /account/auth/check-registration-status endpoint
 */
export class CheckRegistrationStatusResponseDto {
  @ApiProperty({
    description: 'Current registration status of the clinic admin',
    enum: RegistrationStatus,
    example: RegistrationStatus.PENDING_SEPAY_SETUP,
    required: false,
    nullable: true,
  })
  status?: RegistrationStatus;

  @ApiProperty({
    description: 'Current step in the registration flow',
    example: 'STEP_2',
    required: false,
    nullable: true,
  })
  currentStep?: string;

  @ApiProperty({
    description: 'Next action the user needs to take',
    example: 'Configure your payment gateway (Sepay)',
    required: false,
    nullable: true,
  })
  nextAction?: string;

  @ApiProperty({
    description: 'Whether the user can resume their registration',
    example: true,
    required: false,
    nullable: true,
  })
  canResume?: boolean;

  @ApiProperty({
    description: 'Additional information about the registration status',
    example: 'Registration is in progress. Please complete the required steps.',
    required: false,
    nullable: true,
  })
  message?: string;

  @ApiProperty({
    description: 'The manager account ID (needed for manager-scoped legal-doc endpoints)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
    nullable: true,
  })
  managerAccountId?: string;

  @ApiProperty({
    description: 'Optional notice message for statuses like NON_RENEWING',
    example: 'Your subscription has been cancelled and will not renew automatically',
    required: false,
    nullable: true,
  })
  notice?: string;

  @ApiProperty({
    description: 'Subscription expiration date (ISO 8601 format)',
    example: '2026-12-31T23:59:59.999Z',
    required: false,
    nullable: true,
  })
  expirationDate?: string;
}
