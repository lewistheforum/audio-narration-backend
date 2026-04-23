import { ApiProperty } from '@nestjs/swagger';
import {
  RevenueSummaryDto,
  PaymentMethodBreakdownDto,
  RevenueTrendDataPointDto,
  TransactionStatusBreakdownDto,
} from './overall-revenue-report-response.dto';

export class BranchOperationalOverviewDto {
  @ApiProperty({ description: 'Unique customers in period', example: 320 })
  totalCustomers: number;

  @ApiProperty({ description: 'Active doctors in period', example: 12 })
  totalDoctors: number;

  @ApiProperty({ description: 'Total service bookings in period', example: 640 })
  totalServices: number;
}

export class BranchCustomerStatsItemDto {
  @ApiProperty({ description: 'Period label', example: '2026-03-01' })
  label: string;

  @ApiProperty({ description: 'Unique customer count', example: 42 })
  count: number;
}

export class BranchDoctorRecentFeedbackDto {
  @ApiProperty({ description: 'Rating', example: 5 })
  rating: number;

  @ApiProperty({ description: 'Feedback description', nullable: true, example: 'Very professional' })
  description: string | null;

  @ApiProperty({ description: 'Patient name', nullable: true, example: 'Nguyen Van A' })
  patientName: string | null;
}

export class BranchDoctorFeedbackDto {
  @ApiProperty({ description: 'Doctor account ID' })
  doctorId: string;

  @ApiProperty({ description: 'Doctor full name', nullable: true })
  fullName: string | null;

  @ApiProperty({ description: 'Doctor avatar', nullable: true })
  profilePicture: string | null;

  @ApiProperty({ description: 'Average rating', example: 4.75 })
  avgRating: number;

  @ApiProperty({ description: 'Total feedback count', example: 16 })
  totalFeedback: number;

  @ApiProperty({ type: [BranchDoctorRecentFeedbackDto], isArray: true })
  recentFeedbacks: BranchDoctorRecentFeedbackDto[];
}

export class BranchServiceStatsDto {
  @ApiProperty({ description: 'Service name', example: 'Initial Consultation' })
  serviceName: string;

  @ApiProperty({ description: 'Registration count', example: 80 })
  registrationCount: number;
}

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

  @ApiProperty({ description: 'Operational overview for branch', type: BranchOperationalOverviewDto })
  operationalOverview: BranchOperationalOverviewDto;

  @ApiProperty({ description: 'Grouped customer statistics', type: [BranchCustomerStatsItemDto], isArray: true })
  customerStats: BranchCustomerStatsItemDto[];

  @ApiProperty({ description: 'Doctors working and their feedback snapshot', type: [BranchDoctorFeedbackDto], isArray: true })
  doctorsFeedback: BranchDoctorFeedbackDto[];

  @ApiProperty({ description: 'Service registration and revenue stats', type: [BranchServiceStatsDto], isArray: true })
  servicesStats: BranchServiceStatsDto[];

  @ApiProperty({
    description: 'Top 5 services derived from servicesStats',
    type: [BranchServiceStatsDto],
    example: [
      {
        serviceName: 'Initial Consultation',
        registrationCount: 80,
      },
    ],
  })
  topServices: BranchServiceStatsDto[];

  @ApiProperty({ description: 'Revenue summary for branch', type: RevenueSummaryDto })
  summary: RevenueSummaryDto;

  @ApiProperty({ description: 'Revenue breakdown by payment method', type: PaymentMethodBreakdownDto })
  paymentMethodBreakdown: PaymentMethodBreakdownDto;

  @ApiProperty({ description: 'Revenue trend over time', type: [RevenueTrendDataPointDto], isArray: true })
  revenueTrend: RevenueTrendDataPointDto[];

  @ApiProperty({ description: 'Transaction status distribution', type: TransactionStatusBreakdownDto })
  statusBreakdown: TransactionStatusBreakdownDto;
}
