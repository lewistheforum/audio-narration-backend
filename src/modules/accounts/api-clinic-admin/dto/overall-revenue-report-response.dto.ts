import { ApiProperty } from '@nestjs/swagger';

/**
 * Revenue Summary Item DTO
 *
 * Basic revenue aggregation for a specific scope
 */
export class RevenueSummaryDto {
  @ApiProperty({
    description: 'Total revenue amount (in VND)',
    example: 125000000,
  })
  totalRevenue: number;

  @ApiProperty({
    description: 'Number of successful transactions',
    example: 450,
  })
  transactionCount: number;

  @ApiProperty({
    description: 'Number of unique patients',
    example: 320,
  })
  uniquePatients: number;

  @ApiProperty({
    description: 'Average transaction value (in VND)',
    example: 277778,
  })
  averageTransactionValue: number;
}

/**
 * Payment Method Revenue DTO
 *
 * Revenue breakdown by payment method
 */
export class PaymentMethodRevenueDto {
  @ApiProperty({
    description: 'Payment method name',
    example: 'Online Payment',
  })
  paymentMethod: string;

  @ApiProperty({
    description: 'Revenue amount for this method (in VND)',
    example: 85000000,
  })
  revenue: number;

  @ApiProperty({
    description: 'Number of transactions',
    example: 320,
  })
  transactionCount: number;

  @ApiProperty({
    description: 'Percentage of total revenue',
    example: 68.0,
  })
  percentage: number;
}

/**
 * Payment Method Breakdown Container DTO
 */
export class PaymentMethodBreakdownDto {
  @ApiProperty({
    description: 'Online payment revenue (via SEPAY, VNPAY, etc.)',
    type: PaymentMethodRevenueDto,
  })
  online: PaymentMethodRevenueDto;

  @ApiProperty({
    description: 'Cash on delivery (COD) revenue',
    type: PaymentMethodRevenueDto,
  })
  cash: PaymentMethodRevenueDto;
}

/**
 * Service Category Revenue Item DTO
 *
 * Revenue breakdown by service category
 */
export class ServiceCategoryRevenueDto {
  @ApiProperty({
    description: 'Service category name',
    example: 'General Consultation',
  })
  categoryName: string;

  @ApiProperty({
    description: 'Revenue from this category (in VND)',
    example: 45000000,
  })
  revenue: number;

  @ApiProperty({
    description: 'Number of services sold',
    example: 180,
  })
  serviceCount: number;

  @ApiProperty({
    description: 'Percentage of total revenue',
    example: 36.0,
  })
  percentage: number;

  @ApiProperty({
    description: 'Top 3 services in this category',
    type: [String],
    example: ['Initial Consultation', 'Follow-up Visit', 'Health Assessment'],
  })
  topServices: string[];
}

/**
 * Revenue Trend Data Point DTO
 *
 * Single time period data point for trend charts
 */
export class RevenueTrendDataPointDto {
  @ApiProperty({
    description: 'Period label (date, week number, or month)',
    example: '2026-03-01',
  })
  period: string;

  @ApiProperty({
    description: 'Revenue for this period (in VND)',
    example: 4200000,
  })
  revenue: number;

  @ApiProperty({
    description: 'Number of transactions in this period',
    example: 15,
  })
  transactionCount: number;

  @ApiProperty({
    description: 'Period start timestamp',
    example: '2026-03-01T00:00:00Z',
  })
  periodStart: string;

  @ApiProperty({
    description: 'Period end timestamp',
    example: '2026-03-01T23:59:59Z',
  })
  periodEnd: string;
}

/**
 * Transaction Status Breakdown DTO
 *
 * Distribution of transactions by payment status
 */
export class TransactionStatusBreakdownDto {
  @ApiProperty({
    description: 'Successful transactions',
    type: Object,
    example: { count: 450, amount: 125000000 },
  })
  success: {
    count: number;
    amount: number;
  };

  @ApiProperty({
    description: 'Pending transactions',
    type: Object,
    example: { count: 25, amount: 7500000 },
  })
  pending: {
    count: number;
    amount: number;
  };

  @ApiProperty({
    description: 'Failed/Expired transactions',
    type: Object,
    example: { count: 18, amount: 5200000 },
  })
  failed: {
    count: number;
    amount: number;
  };
}

/**
 * Branch Revenue Summary Item DTO
 *
 * Revenue summary for a single branch (used in overall report)
 */
export class BranchRevenueSummaryDto {
  @ApiProperty({
    description: 'Branch manager account ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  managerId: string;

  @ApiProperty({
    description: 'Branch name',
    example: 'Downtown Medical Clinic',
  })
  branchName: string;

  @ApiProperty({
    description: 'Manager full name',
    example: 'Dr. John Smith',
  })
  managerName: string;

  @ApiProperty({
    description: 'Branch status',
    example: 'ACTIVE',
  })
  branchStatus: string;

  @ApiProperty({
    description: 'Total revenue for this branch (in VND)',
    example: 35000000,
  })
  totalRevenue: number;

  @ApiProperty({
    description: 'Number of transactions',
    example: 120,
  })
  transactionCount: number;

  @ApiProperty({
    description: 'Percentage of total clinic revenue',
    example: 28.0,
  })
  revenuePercentage: number;
}

/**
 * Overall Revenue Report Response DTO
 *
 * Comprehensive revenue report across all branches under a CLINIC_ADMIN
 */
export class OverallRevenueReportResponseDto {
  @ApiProperty({
    description: 'Query period metadata',
    type: Object,
    example: {
      startDate: '2026-01-01',
      endDate: '2026-03-31',
      groupedBy: 'day',
      generatedAt: '2026-03-05T10:30:00Z',
    },
  })
  period: {
    startDate: string;
    endDate: string;
    groupedBy: string;
    generatedAt: string;
  };

  @ApiProperty({
    description: 'Aggregated revenue summary across all branches',
    type: RevenueSummaryDto,
  })
  summary: RevenueSummaryDto;

  @ApiProperty({
    description: 'Revenue breakdown by payment method',
    type: PaymentMethodBreakdownDto,
  })
  paymentMethodBreakdown: PaymentMethodBreakdownDto;

  @ApiProperty({
    description: 'Revenue breakdown by service category',
    type: [ServiceCategoryRevenueDto],
    isArray: true,
  })
  serviceCategoryBreakdown: ServiceCategoryRevenueDto[];

  @ApiProperty({
    description: 'Revenue trend over time',
    type: [RevenueTrendDataPointDto],
    isArray: true,
  })
  revenueTrend: RevenueTrendDataPointDto[];

  @ApiProperty({
    description: 'Transaction status distribution',
    type: TransactionStatusBreakdownDto,
  })
  statusBreakdown: TransactionStatusBreakdownDto;

  @ApiProperty({
    description: 'Revenue breakdown by branch',
    type: [BranchRevenueSummaryDto],
    isArray: true,
  })
  branchBreakdown: BranchRevenueSummaryDto[];

  @ApiProperty({
    description: 'Number of active branches included in report',
    example: 5,
  })
  totalBranches: number;
}
