import { ApiProperty } from '@nestjs/swagger';

/**
 * Patient Info in Feedback
 */
export class FeedbackPatientInfoDto {
  @ApiProperty({ description: 'Patient UUID', example: '123e4567-e89b-12d3-a456-426614174000' })
  patient_id: string;

  @ApiProperty({ description: 'Patient full name', example: 'John Doe' })
  full_name: string;

  @ApiProperty({ description: 'Patient profile image URL', example: 'https://...', nullable: true })
  profile_image_url: string | null;

  @ApiProperty({ description: 'Patient gender', example: 'MALE', nullable: true })
  gender: string | null;
}

/**
 * Appointment Info in Feedback
 */
export class FeedbackAppointmentInfoDto {
  @ApiProperty({ description: 'Appointment UUID', example: '123e4567-e89b-12d3-a456-426614174000' })
  appointment_id: string;

  @ApiProperty({ description: 'Appointment date', example: '2026-03-08' })
  appointment_date: string;

  @ApiProperty({ description: 'Clinic name', example: 'ABC Clinic' })
  clinic_name: string;
}

/**
 * Single Feedback Item for Doctor
 */
export class DoctorFeedbackItemDto {
  @ApiProperty({ description: 'Feedback UUID', example: '123e4567-e89b-12d3-a456-426614174000' })
  feedback_id: string;

  @ApiProperty({ description: 'Rating (1-5)', example: 5 })
  rating: number;

  @ApiProperty({ description: 'Feedback description', example: 'Very dedicated doctor', nullable: true })
  description: string | null;

  @ApiProperty({ description: 'AI-labeled description', nullable: true })
  description_label: any;

  @ApiProperty({ description: 'Feedback images (JSONB)', nullable: true })
  feedback_images: any;

  @ApiProperty({ description: 'AI-labeled images', nullable: true })
  feedback_images_label: any;

  @ApiProperty({ description: 'Patient information', type: FeedbackPatientInfoDto })
  patient: FeedbackPatientInfoDto;

  @ApiProperty({ description: 'Appointment information', type: FeedbackAppointmentInfoDto })
  appointment: FeedbackAppointmentInfoDto;

  @ApiProperty({ description: 'Created at', example: '2026-03-08T10:00:00Z' })
  created_at: Date;
}

/**
 * Paginated Response for Doctor Feedbacks
 */
export class DoctorFeedbacksResponseDto {
  @ApiProperty({ description: 'Total number of feedbacks' })
  total: number;

  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Items per page' })
  limit: number;

  @ApiProperty({ description: 'Total pages' })
  total_pages: number;

  @ApiProperty({ description: 'Average rating', example: 4.5 })
  average_rating: number;

  @ApiProperty({ description: 'Rating distribution', example: { '5': 10, '4': 5, '3': 2, '2': 1, '1': 0 } })
  rating_distribution: {
    '5': number;
    '4': number;
    '3': number;
    '2': number;
    '1': number;
  };

  @ApiProperty({ description: 'List of feedbacks', type: [DoctorFeedbackItemDto] })
  feedbacks: DoctorFeedbackItemDto[];
}
