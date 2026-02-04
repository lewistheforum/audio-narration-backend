import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsUUID,
  IsNumber,
  IsString,
  IsOptional,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Create Feedback for Doctor DTO
 *
 * DTO for creating feedback for a doctor.
 * Requires both clinicId and doctorId.
 */
export class CreateFeedbackDoctorDto {
  @ApiProperty({
    description: 'Appointment ID associated with this feedback',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty({ message: 'Appointment ID is required' })
  @IsUUID('4', { message: 'Appointment ID must be a valid UUID' })
  appointmentId: string;

  @ApiProperty({
    description: 'Clinic ID where the doctor works',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty({ message: 'Clinic ID is required' })
  @IsUUID('4', { message: 'Clinic ID must be a valid UUID' })
  clinicId: string;

  @ApiProperty({
    description: 'Doctor ID to provide feedback for',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty({ message: 'Doctor ID is required' })
  @IsUUID('4', { message: 'Doctor ID must be a valid UUID' })
  doctorId: string;

  @ApiProperty({
    description: 'Rating for the doctor (1-5)',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @IsNotEmpty({ message: 'Rating is required' })
  @IsNumber({}, { message: 'Rating must be a number' })
  @Min(1, { message: 'Rating must be at least 1' })
  @Max(5, { message: 'Rating must not exceed 5' })
  rating: number;

  @ApiProperty({
    description: 'Feedback description text',
    example: 'Dr. Smith was very professional and helpful!',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @Transform(({ value }) => value?.trim())
  description?: string;

  @ApiProperty({
    description: 'Array of feedback image URLs',
    example: [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg',
    ],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Feedback images must be an array' })
  @IsString({ each: true, message: 'Each feedback image must be a string URL' })
  feedbackImages?: string[];
}
