import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Blog } from './entities';
import { BlogRepository } from './repositories/blog.repository';
import { BlogsController } from './blogs.controller';
import { BlogsService } from './blogs.service';
import { Account } from '../accounts/entities/accounts.entity';
import { BlogNotification } from '../notifications/entities/blog-notification.entity';
import { SocketGatewayModule } from '../socket-gateway/socket-gateway.module';
import { AccountsModule } from '../accounts/accounts.module';

/**
 * Blogs Module
 *
 * Manages blog posts functionality
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Blog, Account, BlogNotification]),
    SocketGatewayModule,
    AccountsModule,
  ],
  controllers: [BlogsController],
  providers: [BlogRepository, BlogsService],
  exports: [BlogRepository],
})
export class BlogsModule {}
