import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Feedback, Report } from './entities';
import { FeedbackRepository, ReportRepository } from './repositories';
import { MailerModule } from '../mailer/mailer.module';

import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

/**
 * Reports Module
 *
 * Manages reports and feedback functionality
 */
@Module({
  imports: [TypeOrmModule.forFeature([Feedback, Report]), MailerModule],
  controllers: [FeedbackController, ReportController],
  providers: [
    FeedbackRepository,
    FeedbackService,
    ReportRepository,
    ReportService,
  ],
  exports: [
    TypeOrmModule,
    FeedbackRepository,
    FeedbackService,
    ReportRepository,
    ReportService,
  ],
})
export class ReportsModule {}
