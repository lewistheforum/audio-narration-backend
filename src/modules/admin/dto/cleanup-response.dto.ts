import { ApiProperty } from '@nestjs/swagger';

export class CleanupDetailDto {
  @ApiProperty({ description: 'Clinic admin account ID' })
  clinicAdminId: string;

  @ApiProperty({ description: 'Email of the clinic admin' })
  email: string;

  @ApiProperty({ description: 'Current status of the subscription' })
  status: string;

  @ApiProperty({ description: 'Whether the email was sent successfully' })
  emailSent: boolean;

  @ApiProperty({ description: 'Whether the deletion was successful' })
  deleted: boolean;

  @ApiProperty({ description: 'Error message if deletion failed', required: false })
  error?: string;
}

export class CleanupResultDto {
  @ApiProperty({ description: 'Total number of stale registrations found' })
  totalStaleFound: number;

  @ApiProperty({ description: 'Number of emails sent successfully' })
  emailsSentSuccessfully: number;

  @ApiProperty({ description: 'Number of emails that failed to send' })
  emailsFailed: number;

  @ApiProperty({ description: 'Number of registrations deleted successfully' })
  deletedSuccessfully: number;

  @ApiProperty({ description: 'Number of deletions that failed' })
  deletionsFailed: number;

  @ApiProperty({ description: 'Details of each cleanup operation', type: [CleanupDetailDto] })
  details: CleanupDetailDto[];
}

export class CleanupResponseDto {
  @ApiProperty({ description: 'Cleanup result data', type: CleanupResultDto })
  data: CleanupResultDto;

  @ApiProperty({ description: 'Response message' })
  message: string;
}
