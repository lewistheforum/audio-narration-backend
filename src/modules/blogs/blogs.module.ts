import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Blog } from './entities';

/**
 * Blogs Module
 *
 * Manages blog posts functionality
 */
@Module({
  imports: [TypeOrmModule.forFeature([Blog])],
  controllers: [],
  providers: [],
  exports: [TypeOrmModule],
})
export class BlogsModule {}
