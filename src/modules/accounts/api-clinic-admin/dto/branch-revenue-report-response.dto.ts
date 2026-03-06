import { ApiProperty } from '@nestjs/swagger';
import {
  RevenueSummaryDto,
  PaymentMethodBreakdownDto,
  ServiceCategoryRevenueDto,
  RevenueTrendDataPointDto,
  TransactionStatusBreakdownDto,
} from './overall-revenue-report-response.dto';

/**
 * Branch Revenue Report Response DTO
 *
 * Detailed revenue report for a specific branch (CLINIC_MANAGER)
 */
export class BranchRevenueReportResponseDto {
  @ApiProperty({
    description: 'Query period metadata',
    type: Object,
    example: {
      startDate: '2026-01-01',
      endDate: '2026-03-31',
      groupedBy: 'day',
      generatedAt: '2026-03-05T10:35:00Z',
    },
  })
  period: {
    startDate: string;
    endDate: string;
    groupedBy: string;
    generatedAt: string;
  };

  @ApiProperty({
    description: 'Branch identification',
    type: Object,
    example: {
      managerId: '123e4567-e89b-12d3-a456-426614174000',
      branchName: 'Downtown Medical Clinic',
      managerName: 'Dr. John Smith',
      branchStatus: 'ACTIVE',
    },
  })
  branchInfo: {
    managerId: string;
    branchName: string;
    managerName: string;
    branchStatus: string;
  };

  @ApiProperty({
    description: 'Revenue summary for this branch',
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
    description: 'Top 10 revenue-generating services',
    type: [Object],
    example: [
      {
        serviceName: 'Initial Consultation',
        serviceCode: 'CONS-001',
        revenue: 12000000,
        count: 80,
      },
    ],
  })
  topServices: Array<{
    serviceName: string;
    serviceCode: string;
    revenue: number;
    count: number;
  }>;
}
