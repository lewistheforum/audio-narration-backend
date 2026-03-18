import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Feedback, Report } from './entities';
import { FeedbackRepository, ReportRepository } from './repositories';
import { MailerModule } from '../mailer/mailer.module';
import { AccountsModule } from '../accounts/accounts.module';

import { BranchReportController } from './branch-report.controller';
import { BranchReportService } from './branch-report.service';
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
  imports: [
    TypeOrmModule.forFeature([Feedback, Report]),
    MailerModule,
    AccountsModule,
  ],
  controllers: [FeedbackController, ReportController, BranchReportController],
  providers: [
    FeedbackRepository,
    FeedbackService,
    ReportRepository,
    ReportService,
    BranchReportService,
  ],
  exports: [
    TypeOrmModule,
    FeedbackRepository,
    FeedbackService,
    ReportRepository,
    ReportService,
    BranchReportService,
  ],
})
export class ReportsModule {}
