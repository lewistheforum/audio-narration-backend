import { Injectable, Logger } from '@nestjs/common';
import { Report } from '../../modules/reports/entities/report.entity';
import { ReportType } from '../../modules/reports/enums';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { AccountRole } from '../../modules/accounts/enums';
import { ReportRepository } from '../../modules/reports/repositories/report.repository';

@Injectable()
export class ReportSeederService {
  private readonly logger = new Logger(ReportSeederService.name);

  // Number of reports to create
  private readonly TOTAL_REPORTS = 80;

  // Image URLs for reports
  private readonly IMAGE_URLS = [
    'https://ecopharma.com.vn/wp-content/uploads/2024/09/giuong-benh-phong-kham-da-khoa-tam-anh-quan-7.jpg',
    'https://suckhoedoisong.qltns.mediacdn.vn/324455921873985536/2024/8/20/anh-chup-man-hinh-2024-08-20-luc-18-57-06-1724155044465198930131.png',
  ];

  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly reportRepository: ReportRepository,
  ) {}

  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed reports...');

      // Check if reports already exist
      const existingReports = await this.reportRepository.findAllReports(1, 1);
      if (existingReports.total > 0) {
        this.logger.log(
          `Reports already exist (${existingReports.total} records). Skipping seeding.`,
        );
        return;
      }

      // Retrieve PATIENT accounts to assign as report authors
      const allAccounts = await this.accountRepository.findAllAccounts();
      const patients = allAccounts.filter(
        (acc) => acc.role === AccountRole.PATIENT,
      );

      if (patients.length === 0) {
        this.logger.warn('No patient accounts found. Skipping report seeding.');
        return;
      }

      this.logger.log(`Found ${patients.length} patients to assign reports to`);

      const allReports: Report[] = [];
      const reportTypes = Object.values(ReportType);

      for (let i = 0; i < this.TOTAL_REPORTS; i++) {
        const randomPatient =
          patients[Math.floor(Math.random() * patients.length)];
        const randomType =
          reportTypes[Math.floor(Math.random() * reportTypes.length)];
        const hasImages = Math.random() > 0.5;
        const isResponse = Math.random() > 0.7; // 30% chance is already answered

        const reportData = {
          accountId: randomPatient._id,
          reportType: randomType,
          description: `This is a randomly generated report for testing purposes. ID #${i + 1}`,
          reportImages: hasImages
            ? [
                this.IMAGE_URLS[
                  Math.floor(Math.random() * this.IMAGE_URLS.length)
                ],
              ]
            : [],
          isResponse,
          responseDescription: isResponse
            ? 'Thank you for your report. We have reviewed it and taken appropriate action.'
            : null,
        };

        const report = this.reportRepository.createReport(reportData);
        allReports.push(report);
      }

      // Save all reports to database
      await this.reportRepository.saveReports(allReports);

      this.logger.log(`✅ Successfully seeded ${allReports.length} reports`);
    } catch (error) {
      this.logger.error('Failed to seed reports', error.stack);
    }
  }
}
