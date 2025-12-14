import { ApiProperty } from '@nestjs/swagger';
import { User } from '../entities/user.entity';

export class UserResponseDto {
  @ApiProperty({ description: 'ID duy nhất của người dùng', example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef' })
  id: string;

  @ApiProperty({ description: 'Email của người dùng', example: 'user@example.com' })
  email: string;

  @ApiProperty({
    description: 'Tên của người dùng',
    example: 'Nguyễn Văn A',
    required: false,
    nullable: true,
  })
  name: string;

  @ApiProperty({ description: 'Có phải user tạo bằng Google OAuth không', example: true })
  isOAuthUser: boolean;

  @ApiProperty({ description: 'Google ID', example: '116614682980494340287', required: false, nullable: true })
  googleId: string;

  @ApiProperty({ description: 'Email đã verify hay chưa', example: true })
  isEmailVerified: boolean;

  @ApiProperty({
    description: 'URL ảnh đại diện',
    example: 'https://lh3.googleusercontent.com/a/ACg8ocLjpOnPYY799PM0T8gg25Z7_L5j5K_bDW75ewCdfEAST0Ngq2_s96-c',
    required: false,
    nullable: true,
  })
  profilePicture: string;

  @ApiProperty({description: 'Giới tính', example: 'male', required: false, nullable: true})
  gender: string;

  @ApiProperty({description: 'Ngày sinh', example:'2023-10-27T10:00:00.000Z', required: false, nullable: true})
  dateOfBirth: Date;

  @ApiProperty({ description: 'Thời gian tạo tài khoản', example: '2023-10-27T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ description: 'Thời gian cập nhật gần nhất', example: '2023-10-27T10:00:00.000Z' })
  updatedAt: Date;

  constructor(user: Partial<User>) {
    this.id = user.id;
    this.email = user.email;
    this.name = user.name;
    this.isOAuthUser = user.isOAuthUser;
    this.googleId = user.googleId;
    this.isEmailVerified = user.isEmailVerified;
    this.profilePicture = user.profilePicture;
    this.gender = user.gender;
    this.dateOfBirth = user.dateOfBirth;
    this.createdAt = user.createdAt;
    this.updatedAt = user.updatedAt;
  }
}
