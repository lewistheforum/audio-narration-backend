import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Feedback, Report } from './entities';
import { FeedbackRepository } from './repositories/feedback.repository';

import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';

/**
 * Reports Module
 *
 * Manages reports and feedback functionality
 */
@Module({
  imports: [TypeOrmModule.forFeature([Feedback, Report])],
  controllers: [FeedbackController],
  providers: [FeedbackRepository, FeedbackService],
  exports: [TypeOrmModule, FeedbackRepository],
})
export class ReportsModule {}
