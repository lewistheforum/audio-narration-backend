import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { Report } from '../entities/report.entity';

@Injectable()
export class ReportRepository {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
  ) {}

  /**
   * Find All Reports
   */
  async findAllReports(
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: Report[]; total: number }> {
    const [data, total] = await this.reportRepository.findAndCount({
      relations: ['account'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  /**
   * Find Report by ID
   */
  async findReportById(id: string): Promise<Report | null> {
    return this.reportRepository.findOne({
      where: { _id: id },
      relations: ['account'],
    });
  }

  createReport(data: DeepPartial<Report>): Report {
    return this.reportRepository.create(data);
  }

  async saveReport(report: Report): Promise<Report> {
    return this.reportRepository.save(report);
  }

  async saveReports(reports: Report[]): Promise<Report[]> {
    return this.reportRepository.save(reports);
  }
}
