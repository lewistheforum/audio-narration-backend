import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { formatToVietnamTime } from '../../../common/utils/date.util';

/**
 * Monthly Income Item DTO
 *
 * Single month income data for yearly statistics
 */
export class MonthlyIncomeItemDto {
  @ApiProperty({ description: 'Month number (1-12)', example: 1 })
  monthNum: number;

  @ApiProperty({ description: 'Month name', example: 'January' })
  monthName: string;

  @ApiProperty({
    description: 'Total income for this month',
    example: 15000000,
  })
  totalIncome: number;
}

/**
 * Daily Income Item DTO
 *
 * Single day income data for monthly statistics
 */
export class DailyIncomeItemDto {
  @ApiProperty({ description: 'Transaction date', example: '2025-05-01' })
  transactionDate: string;

  @ApiProperty({ description: 'Total income for this day', example: 500000 })
  totalIncome: number;
}

/**
 * Clinic By Service Stats Item DTO
 *
 * Service usage count by clinics
 */
export class ClinicByServiceStatsDto {
  @ApiProperty({ description: 'Service name', example: 'Premium Package' })
  serviceName: string;

  @ApiProperty({
    description: 'Number of unique clinics using this service',
    example: 25,
  })
  clinicCount: number;

  @ApiProperty({ description: 'Total subscription count', example: 50 })
  subscriptionCount: number;
}

/**
 * Service Usage Pie Chart Item DTO
 *
 * Service usage with percentage for pie chart
 */
export class ServiceUsagePieChartDto {
  @ApiProperty({ description: 'Service name', example: 'Premium Package' })
  serviceName: string;

  @ApiProperty({ description: 'Number of subscriptions', example: 50 })
  subscriptionCount: number;

  @ApiProperty({ description: 'Percentage of total usage', example: 35.5 })
  percentage: number;
}

/**
 * Top Clinic Stats Item DTO
 *
 * Top clinic with appointment statistics
 */
export class TopClinicStatsDto {
  @ApiProperty({ description: 'Year', example: 2025 })
  year: number;

  @ApiProperty({
    description: 'Month (only for monthly stats)',
    example: 5,
    required: false,
  })
  month?: number;

  @ApiProperty({ description: 'Clinic name', example: 'HealthCare Clinic' })
  clinicName: string;

  @ApiProperty({ description: 'Branch name', example: 'Main Branch' })
  branchName: string;

  @ApiProperty({ description: 'Total appointment count', example: 150 })
  appointmentCount: number;

  @ApiProperty({ description: 'Completion rate percentage', example: 85.5 })
  completionRate: number;
}

/**
 * Clinic Spending Stats Item DTO
 *
 * Clinic spending on system services
 */
export class ClinicSpendingStatsDto {
  @ApiProperty({ description: 'Clinic name', example: 'HealthCare Clinic' })
  clinicName: string;

  @ApiProperty({ description: 'Number of transactions', example: 10 })
  transactionCount: number;

  @ApiProperty({ description: 'Total amount spent', example: 15000000 })
  totalExtraSpent: number;
}

/**
 * Clinic Transaction Log Item DTO
 *
 * Detailed transaction log for a specific clinic
 */
export class ClinicTransactionLogDto {
  @ApiProperty({ description: 'Transaction ID' })
  transactionId: string;

  @ApiProperty({ description: 'Transaction date' })
  @Transform(({ value }) => formatToVietnamTime(value))
  transactionDate: Date;

  @ApiProperty({ description: 'Transaction amount', example: 500000 })
  amount: number;

  @ApiProperty({ description: 'Currency', example: 'VND' })
  currency: string;

  @ApiProperty({ description: 'Transaction status', example: 'SUCCESS' })
  status: string;

  @ApiProperty({ description: 'Payment gateway', example: 'SEPAY' })
  gateway: string;

  @ApiProperty({ description: 'Transaction code' })
  transactionCode: string;

  @ApiProperty({ description: 'Service name', example: 'Premium Package' })
  serviceName: string;

  @ApiProperty({ description: 'Subscription start date' })
  @Transform(({ value }) => formatToVietnamTime(value))
  subscriptionStart: Date;

  @ApiProperty({ description: 'Subscription end date' })
  @Transform(({ value }) => formatToVietnamTime(value))
  subscriptionEnd: Date;
}

/**
 * Longest Using Clinic Stats Item DTO
 *
 * Clinics with longest system usage duration
 */
export class LongestUsingClinicStatsDto {
  @ApiProperty({ description: 'Clinic name', example: 'HealthCare Clinic' })
  clinicName: string;

  @ApiProperty({ description: 'Number of transactions', example: 25 })
  transactionCount: number;

  @ApiProperty({ description: 'Total amount spent', example: 25000000 })
  totalSpent: number;

  @ApiProperty({
    description: 'Duration using the system',
    example: '1 year 3 months',
  })
  timeUsingSystem: string;
}

/**
 * Income Yearly Response DTO
 */
export class IncomeYearlyResponseDto {
  @ApiProperty({ type: [MonthlyIncomeItemDto] })
  data: MonthlyIncomeItemDto[];
}

/**
 * Income Monthly Response DTO
 */
export class IncomeMonthlyResponseDto {
  @ApiProperty({ type: [DailyIncomeItemDto] })
  data: DailyIncomeItemDto[];
}

/**
 * Clinic By Service Stats Response DTO
 */
export class ClinicByServiceStatsResponseDto {
  @ApiProperty({ type: [ClinicByServiceStatsDto] })
  data: ClinicByServiceStatsDto[];
}

/**
 * Service Usage Pie Chart Response DTO
 */
export class ServiceUsagePieChartResponseDto {
  @ApiProperty({ type: [ServiceUsagePieChartDto] })
  data: ServiceUsagePieChartDto[];
}

/**
 * Top Clinics Response DTO
 */
export class TopClinicsResponseDto {
  @ApiProperty({ type: [TopClinicStatsDto] })
  data: TopClinicStatsDto[];
}

/**
 * Clinic Spending Response DTO
 */
export class ClinicSpendingResponseDto {
  @ApiProperty({ type: [ClinicSpendingStatsDto] })
  data: ClinicSpendingStatsDto[];
}

/**
 * Clinic Transaction Log Response DTO
 */
export class ClinicTransactionLogResponseDto {
  @ApiProperty({ type: [ClinicTransactionLogDto] })
  data: ClinicTransactionLogDto[];
}

/**
 * Longest Using Clinics Response DTO
 */
export class LongestUsingClinicsResponseDto {
  @ApiProperty({ type: [LongestUsingClinicStatsDto] })
  data: LongestUsingClinicStatsDto[];
}
