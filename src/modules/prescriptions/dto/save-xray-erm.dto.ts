import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsArray } from 'class-validator';

/**
 * Save X-ray ERM Data DTO
 * Used for saving/updating X-ray ERM data
 */
export class SaveXrayErmDto {
  @ApiProperty({ required: false, example: 'Knee' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiProperty({ required: false, example: 'AP and Lateral' })
  @IsOptional()
  @IsString()
  projection?: string;

  @ApiProperty({ required: false, example: 'Đau khớp gối mãn tính' })
  @IsOptional()
  @IsString()
  indication?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  technique?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  findings?: string;

  @ApiProperty({ required: false, example: 'Grade 2' })
  @IsOptional()
  @IsString()
  osteoarthritisGrade?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  conclusion?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  recommendations?: string;

  @ApiProperty({
    required: false,
    type: [String],
    example: ['https://example.com/image1.jpg'],
  })
  @IsOptional()
  @IsArray()
  imageUrls?: string[];
}
