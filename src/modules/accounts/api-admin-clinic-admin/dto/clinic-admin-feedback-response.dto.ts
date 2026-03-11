import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { FeedbackType } from '../../../reports/enums/feedback-type.enum';
import { Feedback } from '../../../reports/entities/feedback.entity';
import { formatToVietnamTime } from '../../../../common/utils/date.util';

export class ClinicAdminFeedbackResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  rating: number;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty()
  clinicManagerId: string;

  @ApiProperty({ enum: FeedbackType })
  type: FeedbackType;

  @ApiProperty()
  @Transform(({ value }) => formatToVietnamTime(value))
  createdAt: Date;

  @ApiProperty({ required: false })
  clinicName?: string;

  @ApiProperty({ required: false })
  doctorName?: string;

  @ApiProperty({ required: false })
  patientName?: string;

  @ApiProperty({ required: false })
  patientAvatar?: string;

  @ApiProperty({ required: false })
  @Transform(({ value }) => value ? formatToVietnamTime(value) : value)
  appointmentDate?: Date;

  @ApiProperty({ required: false })
  @Transform(({ value }) => value ? formatToVietnamTime(value) : value)
  appointmentHour?: Date;

  constructor(feedback: Feedback) {
    this.id = feedback._id;
    this.rating = feedback.rating;
    this.description = feedback.description;
    this.clinicManagerId = feedback.clinicId;
    this.type = feedback.type;
    this.createdAt = feedback.createdAt;
    this.clinicName =
      feedback.clinic?.clinicManagerInformation?.clinicBranchName ||
      feedback.clinic?.username;
    this.doctorName =
      feedback.doctor?.doctorInformation?.fullName || feedback.doctor?.username;
    // this.appointmentDate = feedback?.appointment?.appointmentDate;
    // this.appointmentHour = feedback?.appointment?.appointmentHour;
  }
}
