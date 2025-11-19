import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User as PostgresUser } from './entities/user.entity';
import { MailerModule } from '../mailer/mailer.module';
import { ProfileModule } from '../profile/profile.module';

/**
 * User Module
 * 
 * Provides user management functionality including:
 * - User CRUD operations
 * - Patient and clinic staff creation
 * - Password management
 * - User search and retrieval
 * - Email verification
 * - Automatic profile creation on user registration
 * 
 * Exported Services:
 * - UserService: Used by AuthModule for user operations during authentication
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([PostgresUser]),
    MailerModule,
    forwardRef(() => ProfileModule),
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
