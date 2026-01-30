import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlogNotification } from './entities';

/**
 * Notifications Module
 *
 * Manages notification functionality
 */
@Module({
  imports: [TypeOrmModule.forFeature([BlogNotification])],
  controllers: [],
  providers: [],
  exports: [TypeOrmModule],
})
export class NotificationsModule {}
