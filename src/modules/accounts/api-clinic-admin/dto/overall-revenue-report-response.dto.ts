import { ApiProperty } from '@nestjs/swagger';

export class RevenueSummaryDto {
  @ApiProperty({ description: 'Total revenue amount (in VND)', example: 125000000 })
  totalRevenue: number;

  @ApiProperty({ description: 'Number of successful transactions', example: 450 })
  transactionCount: number;

  @ApiProperty({ description: 'Number of unique patients', example: 320 })
  uniquePatients: number;

  @ApiProperty({ description: 'Average transaction value (in VND)', example: 277778 })
  averageTransactionValue: number;
}

export class PaymentMethodRevenueDto {
  @ApiProperty({ description: 'Payment method name', example: 'Online Payment' })
  paymentMethod: string;

  @ApiProperty({ description: 'Revenue amount for this method (in VND)', example: 85000000 })
  revenue: number;

  @ApiProperty({ description: 'Number of transactions', example: 320 })
  transactionCount: number;

  @ApiProperty({ description: 'Percentage of total revenue', example: 68.0 })
  percentage: number;
}

export class PaymentMethodBreakdownDto {
  @ApiProperty({ description: 'Online payment revenue', type: PaymentMethodRevenueDto })
  online: PaymentMethodRevenueDto;

  @ApiProperty({ description: 'Cash on delivery revenue', type: PaymentMethodRevenueDto })
  cash: PaymentMethodRevenueDto;
}

export class RevenueTrendDataPointDto {
  @ApiProperty({ description: 'Period label', example: '2026-03-01' })
  period: string;

  @ApiProperty({ description: 'Revenue for this period (in VND)', example: 4200000 })
  revenue: number;

  @ApiProperty({ description: 'Number of transactions in this period', example: 15 })
  transactionCount: number;

  @ApiProperty({ description: 'Period start timestamp', example: '2026-03-01T00:00:00Z' })
  periodStart: string;

  @ApiProperty({ description: 'Period end timestamp', example: '2026-03-01T23:59:59Z' })
  periodEnd: string;
}

export class TransactionStatusBreakdownDto {
  @ApiProperty({ description: 'Successful transactions', type: Object, example: { count: 450, amount: 125000000 } })
  success: { count: number; amount: number };

  @ApiProperty({ description: 'Pending transactions', type: Object, example: { count: 25, amount: 7500000 } })
  pending: { count: number; amount: number };

  @ApiProperty({ description: 'Failed transactions', type: Object, example: { count: 18, amount: 5200000 } })
  failed: { count: number; amount: number };
}

export class BranchOperationalSummaryDto {
  @ApiProperty({ description: 'Branch manager account ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  managerId: string;

  @ApiProperty({ description: 'Branch name', example: 'Downtown Medical Clinic' })
  branchName: string;

  @ApiProperty({ description: 'Manager full name', example: 'Dr. John Smith' })
  managerName: string;

  @ApiProperty({ description: 'Unique customers in period', example: 320 })
  totalCustomers: number;

  @ApiProperty({ description: 'Active doctors in period', example: 12 })
  totalDoctors: number;

  @ApiProperty({ description: 'Total service bookings in period', example: 640 })
  totalServices: number;
}

export class TransactionTypeItemDto {
  @ApiProperty({ description: 'Transaction type name', example: 'ONLINE' })
  typeName: string;

  @ApiProperty({ description: 'Number of transactions of this type', example: 200 })
  count: number;

  @ApiProperty({ description: 'Revenue amount for this type (in VND)', example: 85000000 })
  amount: number;

  @ApiProperty({ description: 'Percentage of total transactions', example: 44.44 })
  percentage: number;
}

export class TransactionTypeBreakdownDto {
  @ApiProperty({ description: 'Breakdown of transactions by type', type: [TransactionTypeItemDto], isArray: true })
  items: TransactionTypeItemDto[];

  @ApiProperty({ description: 'Total transaction count across all types', example: 450 })
  totalCount: number;
}

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

  @ApiProperty({ description: 'Aggregated revenue summary across all branches', type: RevenueSummaryDto })
  summary: RevenueSummaryDto;

  @ApiProperty({ description: 'Revenue breakdown by payment method', type: PaymentMethodBreakdownDto })
  paymentMethodBreakdown: PaymentMethodBreakdownDto;

  @ApiProperty({ description: 'Revenue trend over time', type: [RevenueTrendDataPointDto], isArray: true })
  revenueTrend: RevenueTrendDataPointDto[];

  @ApiProperty({ description: 'Transaction status distribution', type: TransactionStatusBreakdownDto })
  statusBreakdown: TransactionStatusBreakdownDto;

  @ApiProperty({ description: 'Transaction type breakdown', type: TransactionTypeBreakdownDto })
  transactionTypeBreakdown: TransactionTypeBreakdownDto;

  @ApiProperty({ description: 'Lightweight branch operational stats', type: [BranchOperationalSummaryDto], isArray: true })
  branchBreakdown: BranchOperationalSummaryDto[];

  @ApiProperty({ description: 'Number of active branches included in report', example: 5 })
  totalBranches: number;
}
