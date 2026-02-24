import { ApiProperty } from '@nestjs/swagger';
import { BlogNotification } from '../../notifications/entities/blog-notification.entity';

/**
 * Blog Notification Response DTO
 *
 * Represents a blog notification for a patient,
 * enriched with blog title and createdAt from the blog table.
 */
export class BlogNotificationResponseDto {
  @ApiProperty({
    description: 'Blog notification ID',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  id: string;

  @ApiProperty({
    description: 'Blog ID',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  blogId: string;

  @ApiProperty({
    description: 'Blog title',
    example: 'Tips for Healthy Living',
  })
  title: string;

  @ApiProperty({
    description: 'Blog thumbnail URL',
    example: 'https://example.com/blog-thumbnail.jpg',
    required: false,
    nullable: true,
  })
  thumbnail?: string;

  @ApiProperty({
    description: 'Blog creation timestamp',
    example: '2023-10-27T10:00:00.000Z',
  })
  blogCreatedAt: Date;

  @ApiProperty({
    description: 'Whether the notification has been read',
    example: false,
  })
  isRead: boolean;

  constructor(notification: BlogNotification) {
    this.id = notification._id;
    this.blogId = notification.blogId;
    this.isRead = notification.isRead;

    if (notification.blog) {
      this.title = notification.blog.title;
      this.thumbnail = notification.blog.thumbnail;
      this.blogCreatedAt = notification.blog.createdAt;
    }
  }
}
