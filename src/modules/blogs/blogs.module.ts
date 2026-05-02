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
import { RsaCryptoService } from 'src/common/services/rsa-crypto.service';

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
  providers: [BlogRepository, BlogsService, RsaCryptoService],
  exports: [BlogRepository],
})
export class BlogsModule {}
