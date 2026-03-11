import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Blog } from '../entities/blog.entity';
import { BlogType } from '../enums';
import { formatToVietnamTime } from '../../../common/utils/date.util';

/**
 * Clinic Info DTO
 *
 * Basic clinic information associated with a blog
 */
export class ClinicInfoDto {
  @ApiProperty({
    description: 'Clinic account ID',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  id: string;

  @ApiProperty({
    description: 'Clinic username',
    example: 'citymedicalclinic',
  })
  username: string;

  @ApiProperty({
    description: 'Clinic email',
    example: 'contact@citymedicalclinic.com',
  })
  email: string;

  @ApiProperty({
    description: 'Clinic phone number',
    example: '+84987654321',
    required: false,
    nullable: true,
  })
  phone?: string;

  @ApiProperty({
    description: 'Clinic profile picture URL',
    example: 'https://example.com/clinic-avatar.jpg',
    required: false,
    nullable: true,
  })
  profilePicture?: string;

  @ApiProperty({
    description: 'Clinic branch name',
    example: 'City Medical Clinic',
  })
  clinicBranchName?: string;

  @ApiProperty({
    description: 'Clinic manager full name',
    example: 'Dr. John Smith',
    required: false,
    nullable: true,
  })
  fullName?: string;
}

/**
 * Blog Response DTO
 *
 * Sanitized blog data returned to API consumers
 * Includes blog information and associated clinic data
 */
export class BlogResponseDto {
  @ApiProperty({
    description: 'Blog ID',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  id: string;

  @ApiProperty({
    description: 'Clinic ID',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  clinicId: string;

  @ApiProperty({
    description: 'Blog title',
    example: 'Tips for Healthy Living',
  })
  title: string;

  @ApiProperty({
    description: 'Blog content',
    example: 'Here are some tips for maintaining a healthy lifestyle...',
  })
  content: string;

  @ApiProperty({
    description: 'Blog thumbnail URL',
    example: 'https://example.com/blog-thumbnail.jpg',
    required: false,
    nullable: true,
  })
  thumbnail?: string;

  @ApiProperty({
    description: 'Blog type',
    enum: BlogType,
    example: BlogType.HEALTH,
  })
  type: BlogType;

  @ApiProperty({
    description: 'Clinic information',
    type: ClinicInfoDto,
    required: false,
    nullable: true,
  })
  clinic?: ClinicInfoDto;

  @ApiProperty({
    description: 'Blog creation timestamp',
    example: '2023-10-27T10:00:00.000Z',
  })
  @Transform(({ value }) => formatToVietnamTime(value))
  createdAt: Date;

  @ApiProperty({
    description: 'Blog last update timestamp',
    example: '2023-10-27T10:00:00.000Z',
  })
  @Transform(({ value }) => formatToVietnamTime(value))
  updatedAt: Date;

  constructor(blog: Blog) {
    this.id = blog._id;
    this.clinicId = blog.clinicId;
    this.title = blog.title;
    this.content = blog.content;
    this.thumbnail = blog.thumbnail;
    this.type = blog.type;
    this.createdAt = blog.createdAt;
    this.updatedAt = blog.updatedAt;

    // Include clinic information if available
    if (blog.clinic) {
      this.clinic = {
        id: blog.clinic._id,
        username: blog.clinic.username,
        email: blog.clinic.email,
        phone: blog.clinic.phone,
        profilePicture: blog.clinic.clinicManagerInformation?.profilePicture,
        clinicBranchName: blog.clinic.clinicManagerInformation?.clinicBranchName,
        fullName: blog.clinic.clinicManagerInformation?.fullName,
      };
    }
  }
}
