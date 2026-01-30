import { ApiProperty } from '@nestjs/swagger';
import { Feedback } from '../entities/feedback.entity';
import { FeedbackType } from '../enums';
import { Account } from '../../accounts/entities/accounts.entity';

export class FeedbackAIResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the feedback',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Unique identifier of the clinic',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  clinicId: string;

  @ApiProperty({
    description: 'Feedback description',
    example: 'Great experience',
    nullable: true,
  })
  description?: string;

  @ApiProperty({
    description: 'Description label result from AI',
    nullable: true,
    example: [{ label: 'Positive', score: 0.9 }],
  })
  descriptionLabel?: any;

  @ApiProperty({
    description: 'Feedback images label result from AI',
    nullable: true,
  })
  feedbackImagesLabel?: any;

  @ApiProperty({
    description: 'Doctor ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  doctorId?: string;

  @ApiProperty({
    description: 'Rating given',
    example: 5,
  })
  rating: number;

  constructor(feedback: Feedback) {
    this.id = feedback._id;
    this.clinicId = feedback.clinicId;
    this.doctorId = feedback.doctorId;
    this.rating = feedback.rating;
    this.description = feedback.description;
    this.descriptionLabel = feedback.descriptionLabel;
    this.feedbackImagesLabel = feedback.feedbackImagesLabel;
  }
}
