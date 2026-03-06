import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class FractureDetectionRequestDto {
  @ApiProperty({
    description: 'Base64 encoded image string for fracture detection',
    example: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABA...',
  })
  @IsString()
  @IsNotEmpty()
  imageBase64: string;

  @ApiPropertyOptional({
    description:
      'Optional patient notes regarding medical history or allergies',
    example: 'Patient is allergic to penicillin and has early stage diabetes.',
  })
  @IsString()
  @IsOptional()
  notes?: string;
}
