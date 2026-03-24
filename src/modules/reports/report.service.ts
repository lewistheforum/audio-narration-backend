import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ReportRepository } from './repositories/report.repository';
import { MailerService } from '../mailer/mailer.service';
import { CreateReportDto, GetReportsDto, ResponseReportDto } from './dto';
import { Report } from './entities/report.entity';
import { AccountRole } from '../accounts/enums';

export interface UserContext {
  _id: string;
  role: AccountRole;
}

@Injectable()
export class ReportService {
  constructor(
    private readonly reportRepository: ReportRepository,
    private readonly mailerService: MailerService,
  ) {}

  /**
   * Create a new report - User role only
   * Automatically attaches the logged-in user's ID as the creator
   */
  async createReport(accountId: string, dto: CreateReportDto): Promise<Report> {
    const report = this.reportRepository.createReport({
      accountId,
      reportType: dto.reportType,
      description: dto.description,
      reportImages: dto.reportImages || [],
      isResponse: false,
      responseDescription: null,
    });

    return this.reportRepository.saveReport(report);
  }

  /**
   * Find All Reports with role-based filtering
   * - Admins (ADMIN role): Can see all reports
   * - Non-Admins: Can only see their own reports
   */
  async findAllReports(
    query: GetReportsDto,
    user: UserContext,
  ): Promise<{ data: Report[]; total: number }> {
    const { page = 1, limit = 10 } = query;

    const isAdmin = user.role === AccountRole.ADMIN;
    const userId = isAdmin ? undefined : user._id;

    return this.reportRepository.findAllReports(page, limit, userId);
  }

  /**
   * Find Report by ID with role-based filtering
   * - Admins: Can view any report
   * - Non-Admins: Can only view their own reports (throws ForbiddenException otherwise)
   */
  async findReportById(id: string, user: UserContext): Promise<Report> {
    const isAdmin = user.role === AccountRole.ADMIN;
    const userId = isAdmin ? undefined : user._id;

    const report = await this.reportRepository.findReportById(id, userId);

    if (!report) {
      throw new NotFoundException(`Report with ID ${id} not found`);
    }

    if (!isAdmin && report.accountId !== user._id) {
      throw new ForbiddenException(
        'You do not have permission to access this report',
      );
    }

    return report;
  }

  /**
   * Respond to a Report - Admin only
   * Updates the admin_reply field and marks report as resolved
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
