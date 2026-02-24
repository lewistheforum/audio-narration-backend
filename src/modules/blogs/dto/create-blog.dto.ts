import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { BlogType } from '../enums';

export class CreateBlogDto {
  @ApiProperty({
    example: 'New Blog Post',
    description: 'The title of the blog post',
  })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({
    example: 'This is the content of the blog post...',
    description: 'The content of the blog post',
  })
  @IsNotEmpty()
  @IsString()
  content: string;

  @ApiProperty({
    example: 'https://example.com/thumbnail.jpg',
    description: 'URL of the blog thumbnail image',
    required: false,
  })
  @IsOptional()
  @IsString()
  thumbnail?: string;

  @ApiProperty({
    enum: BlogType,
    example: BlogType.HEALTH,
    description: 'The type/category of the blog post',
  })
  @IsNotEmpty()
  @IsEnum(BlogType)
  type: BlogType;
}
