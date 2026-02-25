import { ApiProperty } from '@nestjs/swagger';
import { ClinicAdminFeedbackResponseDto } from './clinic-admin-feedback-response.dto';
import { Feedback } from '../../../reports/entities/feedback.entity';

export class ClinicAdminFeedbackDetailResponseDto extends ClinicAdminFeedbackResponseDto {
  @ApiProperty({ required: false })
  feedbackImages?: any;

  @ApiProperty({ required: false })
  appointment?: any; // Replace with Appointment entity type if possible, or keep as any to avoid circular deps if needed

  @ApiProperty({ required: false })
  clinic?: any;

  @ApiProperty({ required: false })
  doctor?: any;

  constructor(
    feedback: Feedback,
    appointment?: any,
    clinic?: any,
    doctor?: any,
  ) {
    super(feedback);
    this.feedbackImages = feedback.feedbackImages;
    this.appointment = appointment;
    // this.clinic = clinic;
    // this.doctor = doctor;
  }
}
