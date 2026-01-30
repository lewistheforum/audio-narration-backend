import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Blog } from './entities';
import { BlogRepository } from './repositories/blog.repository';
import { BlogsController } from './blogs.controller';
import { BlogsService } from './blogs.service';

/**
 * Blogs Module
 *
 * Manages blog posts functionality
 */
@Module({
  imports: [TypeOrmModule.forFeature([Blog])],
  controllers: [BlogsController],
  providers: [BlogRepository, BlogsService],
  exports: [BlogRepository],
})
export class BlogsModule {}
