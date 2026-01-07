import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Feedback, Report } from './entities';
import { FeedbackRepository } from './repositories/feedback.repository';

/**
 * Reports Module
 *
 * Manages reports and feedback functionality
 */
@Module({
  imports: [TypeOrmModule.forFeature([Feedback, Report])],
  controllers: [],
  providers: [FeedbackRepository],
  exports: [TypeOrmModule, FeedbackRepository],
})
export class ReportsModule {}
