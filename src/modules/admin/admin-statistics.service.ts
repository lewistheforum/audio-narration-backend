import { Injectable } from '@nestjs/common';
import { AdminStatisticsRepository } from './repositories/admin-statistics.repository';
import {
  MonthlyIncomeItemDto,
  DailyIncomeItemDto,
  ClinicByServiceStatsDto,
  ServiceUsagePieChartDto,
  TopClinicStatsDto,
  ClinicSpendingStatsDto,
  ClinicTransactionLogDto,
  LongestUsingClinicStatsDto,
} from './dto';

/**
 * Admin Statistics Service
 *
 * Business logic for admin dashboard statistics
 */
@Injectable()
export class AdminStatisticsService {
  constructor(
    private readonly adminStatisticsRepository: AdminStatisticsRepository,
  ) {}

  /**
   * Get income statistics by year
   */
  async getIncomeByYear(
    year: number,
    serviceId?: string,
  ): Promise<MonthlyIncomeItemDto[]> {
    const results = await this.adminStatisticsRepository.getIncomeByYear(
      year,
      serviceId,
    );

    return results.map((row) => ({
      monthNum: Number(row.month_num),
      monthName: row.month_name.trim(),
      totalIncome: Number(row.total_income),
    }));
  }

  /**
   * Get income statistics by month
   */
  async getIncomeByMonth(
    year: number,
    month: number,
    serviceId?: string,
  ): Promise<DailyIncomeItemDto[]> {
    const results = await this.adminStatisticsRepository.getIncomeByMonth(
      year,
      month,
      serviceId,
    );

    return results.map((row) => ({
      transactionDate: row.transaction_date,
      totalIncome: Number(row.total_income),
    }));
  }

  /**
   * Get clinic count by service for a year
   */
  async getClinicCountByServiceYear(
    year: number,
  ): Promise<ClinicByServiceStatsDto[]> {
    const results =
      await this.adminStatisticsRepository.getClinicCountByServiceYear(year);

    return results.map((row) => ({
      serviceName: row.service_name,
      chartColor: row.chart_color,
      clinicCount: Number(row.clinic_count),
      subscriptionCount: Number(row.subscription_count),
    }));
  }

  /**
   * Get clinic count by service for a month
   */
  async getClinicCountByServiceMonth(
    year: number,
    month: number,
  ): Promise<ClinicByServiceStatsDto[]> {
    const results =
      await this.adminStatisticsRepository.getClinicCountByServiceMonth(
        year,
        month,
      );

    return results.map((row) => ({
      serviceName: row.service_name,
      chartColor: row.chart_color,
      clinicCount: Number(row.clinic_count),
      subscriptionCount: Number(row.subscription_count),
    }));
  }

  /**
   * Get service usage pie chart data for a year
   */
  async getServiceUsagePieChartYear(
    year: number,
  ): Promise<ServiceUsagePieChartDto[]> {
    const results =
      await this.adminStatisticsRepository.getServiceUsagePieChartYear(year);

    return results.map((row) => ({
      serviceName: row.service_name,
      subscriptionCount: Number(row.subscription_count),
      percentage: Number(row.percentage) || 0,
    }));
  }

  /**
   * Get service usage pie chart data for a month
   */
  async getServiceUsagePieChartMonth(
    year: number,
    month: number,
  ): Promise<ServiceUsagePieChartDto[]> {
    const results =
      await this.adminStatisticsRepository.getServiceUsagePieChartMonth(
        year,
        month,
      );

    return results.map((row) => ({
      serviceName: row.service_name,
      subscriptionCount: Number(row.subscription_count),
      percentage: Number(row.percentage) || 0,
    }));
  }

  /**
   * Get top 10 clinics for a year
   */
  async getTopClinicsYear(year: number): Promise<TopClinicStatsDto[]> {
    const results =
      await this.adminStatisticsRepository.getTopClinicsYear(year);

    return results.map((row) => ({
      year: Number(row.year),
      clinicName: row.clinic_name,
      branchName: row.branch_name,
      appointmentCount: Number(row.appointment_count),
      completionRate: Number(row.completion_rate) || 0,
    }));
  }

  /**
   * Get top 10 clinics for a month
   */
  async getTopClinicsMonth(
    year: number,
    month: number,
  ): Promise<TopClinicStatsDto[]> {
    const results = await this.adminStatisticsRepository.getTopClinicsMonth(
      year,
      month,
    );

    return results.map((row) => ({
      year: Number(row.year),
      month: Number(row.month),
      clinicName: row.clinic_name,
      branchName: row.branch_name,
      appointmentCount: Number(row.appointment_count),
      completionRate: Number(row.completion_rate) || 0,
    }));
  }

  /**
   * Get clinic spending for a year
   */
  async getClinicSpendingYear(year: number): Promise<ClinicSpendingStatsDto[]> {
    const results =
      await this.adminStatisticsRepository.getClinicSpendingYear(year);

    return results.map((row) => ({
      clinicName: row.clinic_name || 'Unknown Clinic',
      transactionCount: Number(row.transaction_count),
      totalExtraSpent: Number(row.total_extra_spent),
    }));
  }

  /**
   * Get clinic spending for a month
   */
  async getClinicSpendingMonth(
    year: number,
    month: number,
  ): Promise<ClinicSpendingStatsDto[]> {
    const results = await this.adminStatisticsRepository.getClinicSpendingMonth(
      year,
      month,
    );

    return results.map((row) => ({
      clinicName: row.clinic_name || 'Unknown Clinic',
      transactionCount: Number(row.transaction_count),
      totalExtraSpent: Number(row.total_extra_spent),
    }));
  }

  /**
   * Get transaction log for a clinic
   */
  async getClinicTransactionLog(
    clinicId: string,
  ): Promise<ClinicTransactionLogDto[]> {
    const results =
      await this.adminStatisticsRepository.getClinicTransactionLog(clinicId);

    return results.map((row) => ({
      transactionId: row.transaction_id,
      transactionDate: row.transaction_date,
      amount: Number(row.amount),
      currency: row.currency,
      status: row.status,
      gateway: row.gateway || '',
      transactionCode: row.transaction_code || '',
      serviceName: row.service_name,
      subscriptionStart: row.subscription_start,
      subscriptionEnd: row.subscription_end,
    }));
  }

  /**
   * Get clinics with longest system usage
   */
  async getLongestUsingClinics(): Promise<LongestUsingClinicStatsDto[]> {
    const results =
      await this.adminStatisticsRepository.getLongestUsingClinics();

    return results.map((row) => ({
      clinicName: row.clinic_name || 'Unknown Clinic',
      transactionCount: Number(row.transaction_count),
      totalSpent: Number(row.total_spent),
      timeUsingSystem: row.time_using_system || 'N/A',
    }));
  }
}
