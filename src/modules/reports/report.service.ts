import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ReportRepository } from './repositories/report.repository';
import { MailerService } from '../mailer/mailer.service';
import { GetReportsDto, ResponseReportDto } from './dto';
import { Report } from './entities/report.entity';

@Injectable()
export class ReportService {
  constructor(
    private readonly reportRepository: ReportRepository,
    private readonly mailerService: MailerService,
  ) {}

  /**
   * Find All Reports
   */
  async findAllReports(query: GetReportsDto) {
    const { page = 1, limit = 10 } = query;
    return this.reportRepository.findAllReports(page, limit);
  }

  /**
   * Find Report by ID
   */
  async findReportById(id: string): Promise<Report> {
    const report = await this.reportRepository.findReportById(id);
    if (!report) {
      throw new NotFoundException(`Report with ID ${id} not found`);
    }
    return report;
  }

  /**
   * Respond to a Report
   */
  async respondToReport(id: string, dto: ResponseReportDto): Promise<Report> {
    const report = await this.reportRepository.findReportById(id);

    if (!report) {
      throw new NotFoundException(`Report with ID ${id} not found`);
    }

    if (report.isResponse) {
      throw new BadRequestException('Report has already been responded to');
    }

    // Update report
    report.isResponse = true;
    report.responseDescription = dto.responseDescription;
    const savedReport = await this.reportRepository.saveReport(report);

    // Send email to the account owner
    if (report.account) {
      const email = report.account.email;
      const name = report.account.username || 'User';

      // Send email in background
      this.mailerService
        .sendReportResponseEmail(email, name, dto.responseDescription)
        .catch((err) =>
          console.error(
            `Failed to send report response email to ${email}`,
            err,
          ),
        );
    }

    return savedReport;
  }
}
