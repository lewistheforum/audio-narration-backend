import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Feedback } from '../entities/feedback.entity';
import { FeedbackType } from '../enums';
import { Account } from '../../accounts/entities/accounts.entity';
import { formatToVietnamTime } from '../../../common/utils/date.util';

export class FeedbackResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the feedback',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Appointment ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  appointmentId: string;

  @ApiProperty({
    description: 'Clinic ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  clinicId: string;

  // We might want to return the full Account object if available, or just the ID.
  // For now, let's keep it simple or follow the entity structure.
  // If the entity has the relation loaded, we can map it?
  // Let's stick to what's in the entity definition mostly, but DTOs usually flatten or select specific fields.
  // Given "full data", I'll include the relations if they exist in the entity.

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
    description: 'Feedback images URLs',
    nullable: true,
    example: ['https://example.com/img1.jpg'],
  })
  feedbackImages?: string[];

  @ApiProperty({
    description: 'Feedback images label result from AI',
    nullable: true,
  })
  feedbackImagesLabel?: any;

  @ApiProperty({
    description: 'Type of feedback',
    enum: FeedbackType,
    example: FeedbackType.CLINIC, // Assuming FeedbackType.CLINIC exists, need to check enum import
  })
  type: FeedbackType;

  @ApiProperty({
    description: 'Creation date',
    example: '2024-01-01T00:00:00Z',
  })
  @Transform(({ value }) => formatToVietnamTime(value))
  createdAt: Date;

  @ApiProperty({
    description: 'Update date',
    example: '2024-01-01T00:00:00Z',
  })
  @Transform(({ value }) => formatToVietnamTime(value))
  updatedAt: Date;

  constructor(feedback: Feedback) {
    this.id = feedback._id;
    this.appointmentId = feedback.appointmentId;
    this.clinicId = feedback.clinicId;
    this.doctorId = feedback.doctorId;
    this.rating = feedback.rating;
    this.description = feedback.description;
    this.descriptionLabel = feedback.descriptionLabel;
    this.feedbackImages = feedback.feedbackImages;
    this.feedbackImagesLabel = feedback.feedbackImagesLabel;
    this.type = feedback.type;
    this.createdAt = feedback.createdAt;
    this.updatedAt = feedback.updatedAt;
  }
}
