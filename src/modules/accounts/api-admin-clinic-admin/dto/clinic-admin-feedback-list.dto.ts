import { ApiProperty } from '@nestjs/swagger';
import { ClinicAdminFeedbackResponseDto } from './clinic-admin-feedback-response.dto';

export class ClinicAdminFeedbackListDto {
  @ApiProperty({ type: [ClinicAdminFeedbackResponseDto] })
  clinics: ClinicAdminFeedbackResponseDto[];

  @ApiProperty({ type: [ClinicAdminFeedbackResponseDto] })
  doctors: ClinicAdminFeedbackResponseDto[];
}
