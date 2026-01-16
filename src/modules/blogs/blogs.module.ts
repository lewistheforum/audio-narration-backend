import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Blog } from './entities';
import { BlogRepository } from './repositories/blog.repository';

/**
 * Blogs Module
 *
 * Manages blog posts functionality
 */
@Module({
  imports: [TypeOrmModule.forFeature([Blog])],
  controllers: [],
  providers: [BlogRepository],
  exports: [BlogRepository],
})
export class BlogsModule {}
