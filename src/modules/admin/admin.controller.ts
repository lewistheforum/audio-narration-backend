import {
  Controller,
  Delete,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccountRole } from '../accounts/enums/account-role.enum';
import { AdminService } from './admin.service';
import { AdminStatisticsService } from './admin-statistics.service';
import { ApiResponseData } from '../../common/decorators/api-response.decorator';
import {
  RegistrationDetailResponseDto,
  YearQueryDto,
  MonthQueryDto,
  ServiceYearQueryDto,
  ServiceMonthQueryDto,
  ClinicIdQueryDto,
  IncomeYearlyResponseDto,
  IncomeMonthlyResponseDto,
  ClinicByServiceStatsResponseDto,
  ServiceUsagePieChartResponseDto,
  TopClinicsResponseDto,
  ClinicSpendingResponseDto,
  ClinicTransactionLogResponseDto,
  LongestUsingClinicsResponseDto,
  PaginationQueryDto,
  PendingLegalDocumentsResponseDto,
  ApprovedLegalDocumentsResponseDto,
  RejectedLegalDocumentsResponseDto,
  NotSubmittedLegalDocumentsResponseDto,
  RejectRegistrationDto,
  ApprovalSuccessResponseDto,
  RejectionSuccessResponseDto,
  CleanupResponseDto,
  ActiveClinicAdminsResponseDto,
  AdminAccountsResponseDto,
  KnowledgeBaseSyncResponseDto,
  KnowledgeBaseMedicineSyncResponseDto,
} from './dto';

/**
 * Admin Controller
 *
 * Endpoints for admin to:
 * - Approve/reject clinic registrations
 * - View dashboard statistics
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Admin')
@ApiBearerAuth('JWT-auth')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminStatisticsService: AdminStatisticsService,
  ) {}

  // ============================================
  // Legal Documents Management Endpoints (Refactored)
  // ============================================

  /**
   * Get pending legal documents
   *
   * Returns paginated list of legal documents with status PENDING_REVIEW
   */
  @Get('legal-documents/pending')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Get pending legal documents (PENDING_REVIEW)' })
  @ApiResponseData({
    type: PendingLegalDocumentsResponseDto,
    status: 200,
    message: 'Pending legal documents retrieved successfully',
  })
  async getPendingLegalDocuments(
    @Query() query: PaginationQueryDto,
  ): Promise<PendingLegalDocumentsResponseDto> {
    return await this.adminService.getPendingLegalDocuments(
      query.page,
      query.limit,
      query.sortBy,
      query.sortOrder,
    );
  }

  /**
   * Get approved legal documents
   *
   * Returns paginated list of legal documents with status APPROVED
   */
  @Get('legal-documents/approved')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Get approved legal documents (APPROVED)' })
  @ApiResponseData({
    type: ApprovedLegalDocumentsResponseDto,
    status: 200,
    message: 'Approved legal documents retrieved successfully',
  })
  async getApprovedLegalDocuments(
    @Query() query: PaginationQueryDto,
  ): Promise<ApprovedLegalDocumentsResponseDto> {
    return await this.adminService.getApprovedLegalDocuments(
      query.page,
      query.limit,
      query.sortBy,
      query.sortOrder,
    );
  }

  /**
   * Get rejected legal documents
   *
   * Returns paginated list of legal documents with status REJECTED
   */
  @Get('legal-documents/rejected')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Get rejected legal documents (REJECTED)' })
  @ApiResponseData({
    type: RejectedLegalDocumentsResponseDto,
    status: 200,
    message: 'Rejected legal documents retrieved successfully',
  })
  async getRejectedLegalDocuments(
    @Query() query: PaginationQueryDto,
  ): Promise<RejectedLegalDocumentsResponseDto> {
    return await this.adminService.getRejectedLegalDocuments(
      query.page,
      query.limit,
      query.sortBy,
      query.sortOrder,
    );
  }

  /**
   * Get not submitted registrations
   *
   * Returns paginated list of registrations with legal documents NOT_SUBMITTED
   */
  @Get('legal-documents/not-submitted')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Get not submitted registrations (NOT_SUBMITTED)' })
  @ApiResponseData({
    type: NotSubmittedLegalDocumentsResponseDto,
    status: 200,
    message: 'Not submitted registrations retrieved successfully',
  })
  async getNotSubmittedRegistrations(
    @Query() query: PaginationQueryDto,
  ): Promise<NotSubmittedLegalDocumentsResponseDto> {
    return await this.adminService.getNotSubmittedRegistrations(
      query.page,
      query.limit,
      query.sortBy,
      query.sortOrder,
    );
  }

  // ============================================
  // Registration Management Endpoints (Legacy - Keep for backward compatibility)
  // ============================================

  /**
   * Get registration details by ID
   *
   * Returns full registration details for a specific clinic
   */
  @Get('/registrations-legal-documents/:id/:managerId')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Get registration details by clinic admin ID' })
  @ApiResponseData({
    type: RegistrationDetailResponseDto,
    status: 200,
    message: 'Registration details retrieved successfully',
  })
  async getRegistrationById(
    @Param('id') id: string,
    @Param('managerId') managerId: string,
  ): Promise<{ data: RegistrationDetailResponseDto; message: string }> {
    const result = await this.adminService.getRegistrationById(id, managerId);
    return {
      data: result,
      message: 'Registration details retrieved successfully',
    };
  }

  /**
   * Approve a clinic registration by subscription ID
   *
   * Approves the legal documents and transitions subscription to PENDING_PAYMENT
   */
  @Post('registrations/:subscriptionId/approve')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Approve a clinic registration by subscription ID' })
  @ApiParam({
    name: 'subscriptionId',
    type: 'string',
    description: 'Subscription ID (UUID)',
  })
  @ApiResponseData({
    type: ApprovalSuccessResponseDto,
    status: 200,
    message: 'Registration approved successfully',
  })
  async approveRegistrationBySubscriptionId(
    @Param('subscriptionId', ParseUUIDPipe) subscriptionId: string,
  ): Promise<ApprovalSuccessResponseDto> {
    return await this.adminService.approveRegistrationBySubscriptionId(
      subscriptionId,
    );
  }

  /**
   * Reject a clinic registration by subscription ID
   *
   * Rejects the legal documents and stores rejection reason
   * IMPORTANT: Reverts subscription status to PENDING_LEGAL_SETUP (not REJECTED)
   */
  @Post('registrations/:subscriptionId/reject')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Reject a clinic registration by subscription ID' })
  @ApiParam({
    name: 'subscriptionId',
    type: 'string',
    description: 'Subscription ID (UUID)',
  })
  @ApiBody({ type: RejectRegistrationDto })
  @ApiResponseData({
    type: RejectionSuccessResponseDto,
    status: 200,
    message: 'Registration rejected successfully',
  })
  async rejectRegistrationBySubscriptionId(
    @Param('subscriptionId', ParseUUIDPipe) subscriptionId: string,
    @Body() dto: RejectRegistrationDto,
  ): Promise<RejectionSuccessResponseDto> {
    return await this.adminService.rejectRegistrationBySubscriptionId(
      subscriptionId,
      dto.reason,
    );
  }

  // ============================================
  // Statistics Endpoints
  // ============================================

  /**
   * Query 1: Get income statistics by year
   *
   * Returns monthly income breakdown with optional service filter
   */
  @Post('statistics/income/yearly')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({
    summary: 'Get income statistics by year (monthly breakdown)',
  })
  @ApiBody({ type: YearQueryDto })
  @ApiResponseData({
    type: IncomeYearlyResponseDto,
    status: 200,
    message: 'Income statistics retrieved successfully',
  })
  async getIncomeYearly(
    @Body() body: YearQueryDto,
  ): Promise<{ data: IncomeYearlyResponseDto; message: string }> {
    const result = await this.adminStatisticsService.getIncomeByYear(
      body.year,
      body.serviceId,
    );
    return {
      data: { data: result },
      message: 'Income statistics retrieved successfully',
    };
  }

  /**
   * Query 2: Get income statistics by month
   *
   * Returns daily income breakdown with optional service filter
   */
  @Post('statistics/income/monthly')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Get income statistics by month (daily breakdown)' })
  @ApiBody({ type: MonthQueryDto })
  @ApiResponseData({
    type: IncomeMonthlyResponseDto,
    status: 200,
    message: 'Income statistics retrieved successfully',
  })
  async getIncomeMonthly(
    @Body() body: MonthQueryDto,
  ): Promise<{ data: IncomeMonthlyResponseDto; message: string }> {
    const result = await this.adminStatisticsService.getIncomeByMonth(
      body.year,
      body.month,
      body.serviceId,
    );
    return {
      data: { data: result },
      message: 'Income statistics retrieved successfully',
    };
  }

  /**
   * Query 3: Get clinic count by service (yearly)
   *
   * Returns number of clinics using each service for a given year
   */
  @Post('statistics/clinics-by-service/yearly')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Get clinic count by service (yearly)' })
  @ApiBody({ type: ServiceYearQueryDto })
  @ApiResponseData({
    type: ClinicByServiceStatsResponseDto,
    status: 200,
    message: 'Clinic by service statistics retrieved successfully',
  })
  async getClinicsByServiceYearly(
    @Body() body: ServiceYearQueryDto,
  ): Promise<{ data: ClinicByServiceStatsResponseDto; message: string }> {
    const result =
      await this.adminStatisticsService.getClinicCountByServiceYear(body.year);
    return {
      data: { data: result },
      message: 'Clinic by service statistics retrieved successfully',
    };
  }

  /**
   * Query 4: Get clinic count by service (monthly)
   *
   * Returns number of clinics using each service for a given month
   */
  @Post('statistics/clinics-by-service/monthly')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Get clinic count by service (monthly)' })
  @ApiBody({ type: ServiceMonthQueryDto })
  @ApiResponseData({
    type: ClinicByServiceStatsResponseDto,
    status: 200,
    message: 'Clinic by service statistics retrieved successfully',
  })
  async getClinicsByServiceMonthly(
    @Body() body: ServiceMonthQueryDto,
  ): Promise<{ data: ClinicByServiceStatsResponseDto; message: string }> {
    const result =
      await this.adminStatisticsService.getClinicCountByServiceMonth(
        body.year,
        body.month,
      );
    return {
      data: { data: result },
      message: 'Clinic by service statistics retrieved successfully',
    };
  }

  /**
   * Query 5: Get service usage pie chart (yearly)
   *
   * Returns service usage with percentages for pie chart
   */
  @Post('statistics/service-usage/yearly')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({
    summary: 'Get service usage statistics for pie chart (yearly)',
  })
  @ApiBody({ type: ServiceYearQueryDto })
  @ApiResponseData({
    type: ServiceUsagePieChartResponseDto,
    status: 200,
    message: 'Service usage statistics retrieved successfully',
  })
  async getServiceUsageYearly(
    @Body() body: ServiceYearQueryDto,
  ): Promise<{ data: ServiceUsagePieChartResponseDto; message: string }> {
    const result =
      await this.adminStatisticsService.getServiceUsagePieChartYear(body.year);
    return {
      data: { data: result },
      message: 'Service usage statistics retrieved successfully',
    };
  }

  /**
   * Query 6: Get service usage pie chart (monthly)
   *
   * Returns service usage with percentages for pie chart
   */
  @Post('statistics/service-usage/monthly')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({
    summary: 'Get service usage statistics for pie chart (monthly)',
  })
  @ApiBody({ type: ServiceMonthQueryDto })
  @ApiResponseData({
    type: ServiceUsagePieChartResponseDto,
    status: 200,
    message: 'Service usage statistics retrieved successfully',
  })
  async getServiceUsageMonthly(
    @Body() body: ServiceMonthQueryDto,
  ): Promise<{ data: ServiceUsagePieChartResponseDto; message: string }> {
    const result =
      await this.adminStatisticsService.getServiceUsagePieChartMonth(
        body.year,
        body.month,
      );
    return {
      data: { data: result },
      message: 'Service usage statistics retrieved successfully',
    };
  }

  /**
   * Query 7: Get top 10 popular clinics (yearly)
   *
   * Returns top clinics by appointment count with completion rate
   */
  @Post('statistics/top-clinics/yearly')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Get top 10 popular clinics (yearly)' })
  @ApiBody({ type: ServiceYearQueryDto })
  @ApiResponseData({
    type: TopClinicsResponseDto,
    status: 200,
    message: 'Top clinics statistics retrieved successfully',
  })
  async getTopClinicsYearly(
    @Body() body: ServiceYearQueryDto,
  ): Promise<{ data: TopClinicsResponseDto; message: string }> {
    const result = await this.adminStatisticsService.getTopClinicsYear(
      body.year,
    );
    return {
      data: { data: result },
      message: 'Top clinics statistics retrieved successfully',
    };
  }

  /**
   * Query 8: Get top 10 popular clinics (monthly)
   *
   * Returns top clinics by appointment count with completion rate
   */
  @Post('statistics/top-clinics/monthly')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Get top 10 popular clinics (monthly)' })
  @ApiBody({ type: ServiceMonthQueryDto })
  @ApiResponseData({
    type: TopClinicsResponseDto,
    status: 200,
    message: 'Top clinics statistics retrieved successfully',
  })
  async getTopClinicsMonthly(
    @Body() body: ServiceMonthQueryDto,
  ): Promise<{ data: TopClinicsResponseDto; message: string }> {
    const result = await this.adminStatisticsService.getTopClinicsMonth(
      body.year,
      body.month,
    );
    return {
      data: { data: result },
      message: 'Top clinics statistics retrieved successfully',
    };
  }

  /**
   * Query 9: Get clinic spending statistics (yearly)
   *
   * Returns clinic spending on system services
   */
  @Post('statistics/clinic-spending/yearly')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Get clinic spending statistics (yearly)' })
  @ApiBody({ type: ServiceYearQueryDto })
  @ApiResponseData({
    type: ClinicSpendingResponseDto,
    status: 200,
    message: 'Clinic spending statistics retrieved successfully',
  })
  async getClinicSpendingYearly(
    @Body() body: ServiceYearQueryDto,
  ): Promise<{ data: ClinicSpendingResponseDto; message: string }> {
    const result = await this.adminStatisticsService.getClinicSpendingYear(
      body.year,
    );
    return {
      data: { data: result },
      message: 'Clinic spending statistics retrieved successfully',
    };
  }

  /**
   * Query 10: Get clinic spending statistics (monthly)
   *
   * Returns clinic spending on system services
   */
  @Post('statistics/clinic-spending/monthly')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Get clinic spending statistics (monthly)' })
  @ApiBody({ type: ServiceMonthQueryDto })
  @ApiResponseData({
    type: ClinicSpendingResponseDto,
    status: 200,
    message: 'Clinic spending statistics retrieved successfully',
  })
  async getClinicSpendingMonthly(
    @Body() body: ServiceMonthQueryDto,
  ): Promise<{ data: ClinicSpendingResponseDto; message: string }> {
    const result = await this.adminStatisticsService.getClinicSpendingMonth(
      body.year,
      body.month,
    );
    return {
      data: { data: result },
      message: 'Clinic spending statistics retrieved successfully',
    };
  }

  /**
   * Query 11: Get transaction log for a specific clinic
   *
   * Returns detailed transaction history for a clinic
   */
  @Post('statistics/clinic-transactions')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Get transaction log for a clinic' })
  @ApiBody({ type: ClinicIdQueryDto })
  @ApiResponseData({
    type: ClinicTransactionLogResponseDto,
    status: 200,
    message: 'Clinic transaction log retrieved successfully',
  })
  async getClinicTransactions(
    @Body() body: ClinicIdQueryDto,
  ): Promise<{ data: ClinicTransactionLogResponseDto; message: string }> {
    const result = await this.adminStatisticsService.getClinicTransactionLog(
      body.clinicId,
    );
    return {
      data: { data: result },
      message: 'Clinic transaction log retrieved successfully',
    };
  }

  /**
   * Query 12: Get clinics with longest system usage
   *
   * Returns clinics ranked by duration of system usage
   */
  @Post('statistics/longest-using-clinics')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Get clinics with longest system usage' })
  @ApiResponseData({
    type: LongestUsingClinicsResponseDto,
    status: 200,
    message: 'Longest using clinics retrieved successfully',
  })
  async getLongestUsingClinics(): Promise<{
    data: LongestUsingClinicsResponseDto;
    message: string;
  }> {
    const result = await this.adminStatisticsService.getLongestUsingClinics();
    return {
      data: { data: result },
      message: 'Longest using clinics retrieved successfully',
    };
  }

  // ============================================
  // Data Maintenance Endpoints
  // ============================================

  /**
   * Sync Knowledge Base
   *
   * Clears current knowledge base and triggers sync from AI backend
   */
  @Post('knowledge-base/sync')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Sync Knowledge Base' })
  async syncKnowledgeBase(): Promise<KnowledgeBaseSyncResponseDto> {
    return await this.adminService.syncKnowledgeBase();
  }

  @Post('knowledge-base/sync-medicines')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Sync Knowledge Base Medicines' })
  async syncKnowledgeBaseMedicines(): Promise<KnowledgeBaseMedicineSyncResponseDto> {
    return await this.adminService.syncKnowledgeBaseMedicine();
  }

  /**
   * Cleanup stale pending registrations
   *
   * Deletes registrations that have been in pending statuses
   * for more than 6 months. Sends notification emails before deletion.
   */
  @Delete('cleanup-stale-registrations')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({
    summary: 'Cleanup stale pending registrations older than 6 months',
  })
  async cleanupStaleRegistrations(): Promise<CleanupResponseDto> {
    const result = await this.adminService.cleanupStaleRegistrations();
    return {
      data: result,
      message: `Cleanup completed. Found ${result.totalStaleFound} stale registrations, deleted ${result.deletedSuccessfully} successfully.`,
    };
  }

  /**
   * Get all clinic admin account with ACTIVE subscription status
   */
  @Get('clinic-accounts/active-subscriptions')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Get all active clinic admin accounts' })
  async getActiveClinicAdmins(): Promise<ActiveClinicAdminsResponseDto> {
    const result = await this.adminService.getActiveClinicAdmins();
    return {
      data: result,
      message: 'Active clinic admin accounts retrieved successfully',
    };
  }

  /**
   * Get all admin accounts with detail information
   */
  @Get('admin-accounts')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Get all admin accounts with detail information' })
  async getAdminAccounts(): Promise<AdminAccountsResponseDto> {
    const result = await this.adminService.getAdminAccounts();
    return {
      data: result,
      message: 'Admin accounts retrieved successfully',
    };
  }
}
