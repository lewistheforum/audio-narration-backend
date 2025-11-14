import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User as PostgresUser } from './entities/user.entity';

/**
 * User Module
 * 
 * Provides user management functionality including:
 * - User CRUD operations
 * - Patient and clinic staff creation
 * - Password management
 * - User search and retrieval
 * 
 * Exported Services:
 * - UserService: Used by AuthModule for user operations during authentication
 */
@Module({
  imports: [TypeOrmModule.forFeature([PostgresUser])],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
