import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ReportRepository } from './repositories/report.repository';
import { MailerService } from '../mailer/mailer.service';
import { CreateReportDto, GetReportsDto, ResponseReportDto } from './dto';
import { Report } from './entities/report.entity';

@Injectable()
export class ReportService {
  constructor(
    private readonly reportRepository: ReportRepository,
    private readonly mailerService: MailerService,
  ) {}

  /**
   * Create a new report
   */
  async createReport(accountId: string, dto: CreateReportDto): Promise<Report> {
    // Create report entity with default values
    const report = this.reportRepository.createReport({
      accountId,
      reportType: dto.reportType,
      description: dto.description,
      reportImages: dto.reportImages || [],
      isResponse: false,
      responseDescription: null,
    });

    // Save report to database
    return this.reportRepository.saveReport(report);
  }

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
