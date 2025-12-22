import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Feedback, Report } from './entities';

/**
 * Reports Module
 *
 * Manages reports and feedback functionality
 */
@Module({
  imports: [TypeOrmModule.forFeature([Feedback, Report])],
  controllers: [],
  providers: [],
  exports: [TypeOrmModule],
})
export class ReportsModule {}
