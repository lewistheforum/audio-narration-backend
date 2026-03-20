import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { formatToVietnamTime } from '../../../common/utils/date.util';

/**
 * Feedback DTO
 *
 * Public feedback information for clinics and doctors
 */
export class FeedbackDto {
  @ApiProperty({
    description: 'Feedback ID',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  id: string;

  @ApiProperty({
    description: 'Rating value (1-5)',
    example: 5,
  })
  rating: number;

  @ApiProperty({
    description: 'Feedback description',
    example: 'Great service, very professional doctor',
    required: false,
    nullable: true,
  })
  description?: string;

  @ApiProperty({
    description: 'Description labels from AI',
    example: ['Professional', 'Friendly'],
    required: false,
    nullable: true,
  })
  descriptionLabel?: string[];

  @ApiProperty({
    description: 'Feedback images',
    example: ['https://example.com/image1.jpg'],
    required: false,
    nullable: true,
  })
  feedbackImages?: any;

  @ApiProperty({
    description: 'Feedback images labels from AI',
    example: [{ description: 'Clean environment' }],
    required: false,
    nullable: true,
  })
  feedbackImagesLabel?: any;

  @ApiProperty({
    description: 'Patient full name',
    example: 'Nguyen Van A',
    required: false,
    nullable: true,
  })
  patientName?: string;

  @ApiProperty({
    description: 'Patient profile picture URL',
    example: 'https://example.com/patient.jpg',
    required: false,
    nullable: true,
  })
  patientProfilePicture?: string;

  @ApiProperty({
    description: 'Feedback creation timestamp',
    example: '2026-03-15T10:30:00.000Z',
  })
  @Transform(({ value }) => value ? formatToVietnamTime(value) : value)
  createdAt: Date;

  constructor(feedback: any) {
    this.id = feedback._id;
    this.rating = feedback.rating;
    this.description = feedback.description || null;
    this.descriptionLabel = feedback.descriptionLabel || null;
    this.feedbackImages = feedback.feedbackImages || null;
    this.feedbackImagesLabel = feedback.feedbackImagesLabel || null;
    this.patientName = feedback.patientName || null;
    this.patientProfilePicture = feedback.patientProfilePicture || null;
    this.createdAt = feedback.createdAt;
  }
}
