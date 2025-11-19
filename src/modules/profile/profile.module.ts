import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { Profile } from './entities/profile.entity';

/**
 * Profile Module
 * 
 * Provides user profile management functionality including:
 * - Profile CRUD operations
 * - Profile completion tracking
 * - Health information management
 * - Emergency contact management
 * - Insurance information management
 * 
 * Exported Services:
 * - ProfileService: Used by other modules for profile operations
 */
@Module({
  imports: [TypeOrmModule.forFeature([Profile])],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
