import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial, WhereExpressionBuilder } from 'typeorm';
import { Report } from '../entities/report.entity';

@Injectable()
export class ReportRepository {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
  ) {}

  /**
   * Find All Reports with optional user filtering
   */
  async findAllReports(
    page: number = 1,
    limit: number = 10,
    userId?: string,
  ): Promise<{ data: Report[]; total: number }> {
    const queryBuilder = this.reportRepository
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.account', 'account');

    if (userId) {
      queryBuilder.andWhere('report.accountId = :userId', { userId });
    }

    queryBuilder
      .orderBy('report.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();
    return { data, total };
  }

  /**
   * Find Report by ID with optional user filtering
   */
  async findReportById(id: string, userId?: string): Promise<Report | null> {
    const queryBuilder = this.reportRepository
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.account', 'account')
      .where('report._id = :id', { id });

    if (userId) {
      queryBuilder.andWhere('report.accountId = :userId', { userId });
    }

    return queryBuilder.getOne();
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
