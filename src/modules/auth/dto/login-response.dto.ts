import { ApiProperty } from '@nestjs/swagger';
import { AccountResponseDto } from '../../accounts/dto/account-response.dto';
import { RegistrationStatus } from '../../subscriptions/enums/subscription-status.enum';

/**
 * Login Response Data Transfer Object
 * 
 * Returned after successful authentication (login or OAuth)
 * Contains JWT token and complete user information
 */
export class LoginResponseDto {
  @ApiProperty({
    description: 'JWT Access Token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'User ID',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  userId: string;

  @ApiProperty({
    description: 'User information',
    type: AccountResponseDto,
    required: false,
  })
  user?: AccountResponseDto;

  @ApiProperty({
    description: 'Onboarding status for clinic registration flow',
    enum: RegistrationStatus,
    required: false,
  })
  onboardingStatus?: RegistrationStatus;

  @ApiProperty({
    description: 'Current registration step for frontend routing',
    required: false,
    example: 'STEP_6',
  })
  registrationStep?: string;

  @ApiProperty({
    description: 'Next onboarding action',
    required: false,
    example: 'Upload or update legal documents',
  })
  nextAction?: string;

  @ApiProperty({
    description: 'Whether the account can enter the main dashboard',
    required: false,
    example: false,
  })
  canAccessDashboard?: boolean;

  @ApiProperty({
    description: 'Manager account id for clinic onboarding flow',
    required: false,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  managerAccountId?: string;
}
