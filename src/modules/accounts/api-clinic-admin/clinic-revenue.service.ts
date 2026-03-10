import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { PaymentStatus } from '../../transactions/entities/transaction.entity';
import { Account } from '../entities/accounts.entity';
import { AccountRole } from '../enums/account-role.enum';
import {
  ClinicRevenueFilterDto,
  RevenueGroupBy,
  OverallRevenueReportResponseDto,
  BranchRevenueReportResponseDto,
} from './dto';

/**
 * Clinic Revenue Service
 *
 * Handles revenue reporting for CLINIC_ADMIN accounts
 * Aggregates transaction data across branches with detailed breakdowns
 */
@Injectable()
export class ClinicRevenueService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
  ) {}

  /**
   * Get Overall Revenue Report
   *
   * Aggregates revenue data across ALL branches under the CLINIC_ADMIN
   * Provides comprehensive financial overview with multiple breakdowns
   */
  async getOverallRevenueReport(
    adminId: string,
    filterDto: ClinicRevenueFilterDto,
  ): Promise<OverallRevenueReportResponseDto> {
    // Validate admin exists and has CLINIC_ADMIN role
    await this.validateClinicAdmin(adminId);

    // Validate date range
    this.validateDateRange(filterDto.startDate, filterDto.endDate);

    // Get ALL branch IDs under this admin (no filtering by specific manager)
    const branchIds = await this.getAdminBranchIds(adminId);

    if (branchIds.length === 0) {
      throw new NotFoundException('No branches found under this admin');
    }

    // Build aggregated queries
    const summary = await this.calculateRevenueSummary(
      branchIds,
      filterDto.startDate,
      filterDto.endDate,
    );

    const paymentMethodBreakdown = await this.calculatePaymentMethodBreakdown(
      branchIds,
      filterDto.startDate,
      filterDto.endDate,
    );

    const serviceCategoryBreakdown =
      await this.calculateServiceCategoryBreakdown(
        branchIds,
        filterDto.startDate,
        filterDto.endDate,
      );

    const revenueTrend = await this.calculateRevenueTrend(
      branchIds,
      filterDto.startDate,
      filterDto.endDate,
      filterDto.groupBy || RevenueGroupBy.DAY,
    );

    const statusBreakdown = await this.calculateStatusBreakdown(
      branchIds,
      filterDto.startDate,
      filterDto.endDate,
    );

    const branchBreakdown = await this.calculateBranchBreakdown(
      branchIds,
      filterDto.startDate,
      filterDto.endDate,
      summary.totalRevenue,
    );

    return {
      period: {
        startDate: filterDto.startDate,
        endDate: filterDto.endDate,
        groupedBy: filterDto.groupBy || RevenueGroupBy.DAY,
        generatedAt: new Date().toISOString(),
      },
      summary,
      paymentMethodBreakdown,
      serviceCategoryBreakdown,
      revenueTrend,
      statusBreakdown,
      branchBreakdown,
      totalBranches: branchIds.length,
    };
  }

  /**
   * Get Branch-Specific Revenue Report
   *
   * Returns detailed revenue report for a specific CLINIC_MANAGER
   * Includes top services analysis
   */
  async getBranchRevenueReport(
    adminId: string,
    managerId: string,
    filterDto: ClinicRevenueFilterDto,
  ): Promise<BranchRevenueReportResponseDto> {
    // Validate admin exists and has CLINIC_ADMIN role
    await this.validateClinicAdmin(adminId);

    // Validate date range
    this.validateDateRange(filterDto.startDate, filterDto.endDate);

    // Validate manager belongs to admin
    const manager = await this.validateManagerOwnership(adminId, managerId);

    // Get branch information
    const branchInfo = await this.getBranchInformation(manager);

    // Calculate all metrics for this branch
    const summary = await this.calculateRevenueSummary(
      [managerId],
      filterDto.startDate,
      filterDto.endDate,
    );

    const paymentMethodBreakdown = await this.calculatePaymentMethodBreakdown(
      [managerId],
      filterDto.startDate,
      filterDto.endDate,
    );

    const serviceCategoryBreakdown =
      await this.calculateServiceCategoryBreakdown(
        [managerId],
        filterDto.startDate,
        filterDto.endDate,
      );

    const revenueTrend = await this.calculateRevenueTrend(
      [managerId],
      filterDto.startDate,
      filterDto.endDate,
      filterDto.groupBy || RevenueGroupBy.DAY,
    );

    const statusBreakdown = await this.calculateStatusBreakdown(
      [managerId],
      filterDto.startDate,
      filterDto.endDate,
    );

    const topServices = await this.calculateTopServices(
      [managerId],
      filterDto.startDate,
      filterDto.endDate,
      10, // Top 10 services
    );

    return {
      period: {
        startDate: filterDto.startDate,
        endDate: filterDto.endDate,
        groupedBy: filterDto.groupBy || RevenueGroupBy.DAY,
        generatedAt: new Date().toISOString(),
      },
      branchInfo,
      summary,
      paymentMethodBreakdown,
      serviceCategoryBreakdown,
      revenueTrend,
      statusBreakdown,
      topServices,
    };
  }

  // ============================================
  // Private Helper Methods - Validation
  // ============================================

  /**
   * Validate Clinic Admin
   *
   * Ensures the user is a valid CLINIC_ADMIN with ACTIVE status
   */
  private async validateClinicAdmin(adminId: string): Promise<void> {
    const admin = await this.accountRepository.findOne({
      where: { _id: adminId },
    });

    if (!admin) {
      throw new NotFoundException('Admin account not found');
    }

    if (admin.role !== AccountRole.CLINIC_ADMIN) {
      throw new ForbiddenException(
        'Only CLINIC_ADMIN can access revenue reports',
      );
    }
  }

  /**
   * Validate Date Range
   *
   * Ensures startDate is before endDate and range does not exceed 365 days
   */
  private validateDateRange(startDate: string, endDate: string): void {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      throw new BadRequestException('startDate must be before endDate');
    }

    const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 365) {
      throw new BadRequestException('Date range cannot exceed 365 days');
    }
  }

  /**
   * Get Admin Branch IDs
   *
   * Retrieves all CLINIC_MANAGER account IDs under this admin
   * CRITICAL: Does NOT filter by account status (historical data requirement)
   */
  private async getAdminBranchIds(adminId: string): Promise<string[]> {
    const queryBuilder = this.accountRepository
      .createQueryBuilder('account')
      .select('account._id')
      .where('account.parent_id = :adminId', { adminId })
      .andWhere('account.role = :role', { role: AccountRole.CLINIC_MANAGER })
      .andWhere('account.deleted_at IS NULL');

    const branches = await queryBuilder.getMany();
    return branches.map((branch) => branch._id);
  }

  /**
   * Validate Manager Ownership
   *
   * Ensures managerId is a valid CLINIC_MANAGER under adminId
   * Returns the manager account with relations
   */
  private async validateManagerOwnership(
    adminId: string,
    managerId: string,
  ): Promise<Account> {
    const manager = await this.accountRepository.findOne({
      where: { _id: managerId },
      relations: ['clinicManagerInformation'],
    });

    if (!manager) {
      throw new NotFoundException('Manager account not found');
    }

    if (manager.role !== AccountRole.CLINIC_MANAGER) {
      throw new BadRequestException(
        'Specified account is not a CLINIC_MANAGER',
      );
    }

    if (manager.parentId !== adminId) {
      throw new ForbiddenException('You do not have access to this branch');
    }

    return manager;
  }

  /**
   * Get Branch Information
   *
   * Extracts display information for a branch from manager account
   */
  private async getBranchInformation(manager: Account): Promise<any> {
    return {
      managerId: manager._id,
      branchName:
        manager.clinicManagerInformation?.clinicBranchName || 'Unknown Branch',
      managerName:
        manager.clinicManagerInformation?.fullName || 'Unknown Manager',
      branchStatus: manager.status,
    };
  }

  // ============================================
  // Private Aggregation Methods
  // ============================================

  /**
   * Calculate Revenue Summary
   *
   * Aggregates total revenue, transaction count, unique patients, and average value
   * Only counts SUCCESS transactions
   */
  private async calculateRevenueSummary(
    branchIds: string[],
    startDate: string,
    endDate: string,
  ): Promise<any> {
    const result = await this.transactionRepository
      .createQueryBuilder('t')
      .select('SUM(t.amount)', 'totalRevenue')
      .addSelect('COUNT(DISTINCT t._id)', 'transactionCount')
      .addSelect('COUNT(DISTINCT a.patient_id)', 'uniquePatients')
      .leftJoin('appointment_package', 'ap', 'ap.transaction_id = t._id')
      .leftJoin('appointments', 'a', 'a._id = ap.appointment_id')
      .where('a.clinic_id IN (:...branchIds)', { branchIds })
      .andWhere('t.status = :status', { status: PaymentStatus.SUCCESS })
      .andWhere('t.transaction_date >= :startDate', { startDate })
      .andWhere('t.transaction_date <= :endDate', { endDate })
      .andWhere('t.deleted_at IS NULL')
      .getRawOne();

    const totalRevenue = parseInt(result.totalRevenue || '0', 10);
    const transactionCount = parseInt(result.transactionCount || '0', 10);
    const uniquePatients = parseInt(result.uniquePatients || '0', 10);

    return {
      totalRevenue,
      transactionCount,
      uniquePatients,
      averageTransactionValue:
        transactionCount > 0 ? Math.round(totalRevenue / transactionCount) : 0,
    };
  }

  /**
   * Calculate Payment Method Breakdown
   *
   * Separates revenue by ONLINE (gateway) vs CASH (COD)
   * Only counts SUCCESS transactions
   */
  private async calculatePaymentMethodBreakdown(
    branchIds: string[],
    startDate: string,
    endDate: string,
  ): Promise<any> {
    // Online payments (have gateway)
    const onlineResult = await this.transactionRepository
      .createQueryBuilder('t')
      .select('SUM(t.amount)', 'revenue')
      .addSelect('COUNT(t._id)', 'transactionCount')
      .leftJoin('appointment_package', 'ap', 'ap.transaction_id = t._id')
      .leftJoin('appointments', 'a', 'a._id = ap.appointment_id')
      .where('a.clinic_id IN (:...branchIds)', { branchIds })
      .andWhere('t.status = :status', { status: PaymentStatus.SUCCESS })
      .andWhere('t.transaction_date >= :startDate', { startDate })
      .andWhere('t.transaction_date <= :endDate', { endDate })
      .andWhere('t.gateway IS NOT NULL')
      .andWhere('t.deleted_at IS NULL')
      .getRawOne();

    // Cash payments (COD)
    const cashResult = await this.transactionRepository
      .createQueryBuilder('t')
      .select('SUM(t.amount)', 'revenue')
      .addSelect('COUNT(t._id)', 'transactionCount')
      .leftJoin('appointment_package', 'ap', 'ap.transaction_id = t._id')
      .leftJoin('appointments', 'a', 'a._id = ap.appointment_id')
      .where('a.clinic_id IN (:...branchIds)', { branchIds })
      .andWhere('t.status = :status', { status: PaymentStatus.SUCCESS })
      .andWhere('t.transaction_date >= :startDate', { startDate })
      .andWhere('t.transaction_date <= :endDate', { endDate })
      .andWhere('ap.payment_type = :paymentType', { paymentType: 'cod' })
      .andWhere('t.deleted_at IS NULL')
      .getRawOne();

    const onlineRevenue = parseInt(onlineResult.revenue || '0', 10);
    const cashRevenue = parseInt(cashResult.revenue || '0', 10);
    const totalRevenue = onlineRevenue + cashRevenue;

    return {
      online: {
        paymentMethod: 'Online Payment',
        revenue: onlineRevenue,
        transactionCount: parseInt(onlineResult.transactionCount || '0', 10),
        percentage:
          totalRevenue > 0
            ? parseFloat(((onlineRevenue / totalRevenue) * 100).toFixed(2))
            : 0,
      },
      cash: {
        paymentMethod: 'Cash on Delivery',
        revenue: cashRevenue,
        transactionCount: parseInt(cashResult.transactionCount || '0', 10),
        percentage:
          totalRevenue > 0
            ? parseFloat(((cashRevenue / totalRevenue) * 100).toFixed(2))
            : 0,
      },
    };
  }

  /**
   * Calculate Service Category Breakdown
   *
   * Groups revenue by ClinicServiceCategory
   * Only counts SUCCESS transactions
   */
  private async calculateServiceCategoryBreakdown(
    branchIds: string[],
    startDate: string,
    endDate: string,
  ): Promise<any[]> {
    const results = await this.transactionRepository
      .createQueryBuilder('t')
      .select('csc.category_name', 'categoryName')
      .addSelect('SUM(t.amount)', 'revenue')
      .addSelect('COUNT(sa._id)', 'serviceCount')
      .leftJoin('appointment_package', 'ap', 'ap.transaction_id = t._id')
      .leftJoin('appointments', 'a', 'a._id = ap.appointment_id')
      .leftJoin(
        'service_appointments',
        'sa',
        'sa.appointment_package_id = ap._id',
      )
      .leftJoin(
        'clinic_service_config',
        'csc_config',
        'csc_config._id = sa.clinic_service_id',
      )
      .leftJoin('clinic_services', 'cs', 'cs._id = csc_config.service_id')
      .leftJoin(
        'clinic_service_category',
        'csc',
        'csc._id = cs.category_id',
      )
      .where('a.clinic_id IN (:...branchIds)', { branchIds })
      .andWhere('t.status = :status', { status: PaymentStatus.SUCCESS })
      .andWhere('t.transaction_date >= :startDate', { startDate })
      .andWhere('t.transaction_date <= :endDate', { endDate })
      .andWhere('t.deleted_at IS NULL')
      .andWhere('csc.category_name IS NOT NULL')
      .groupBy('csc.category_name')
      .orderBy('revenue', 'DESC')
      .getRawMany();

    const totalRevenue = results.reduce(
      (sum, item) => sum + parseInt(item.revenue || '0', 10),
      0,
    );

    return results.map((item) => {
      const revenue = parseInt(item.revenue || '0', 10);
      return {
        categoryName: item.categoryName,
        revenue,
        serviceCount: parseInt(item.serviceCount || '0', 10),
        percentage:
          totalRevenue > 0
            ? parseFloat(((revenue / totalRevenue) * 100).toFixed(2))
            : 0,
        topServices: [], // Placeholder for future implementation
      };
    });
  }

  /**
   * Calculate Revenue Trend
   *
   * Groups revenue by time period (day/week/month)
   * Only counts SUCCESS transactions
   */
  private async calculateRevenueTrend(
    branchIds: string[],
    startDate: string,
    endDate: string,
    groupBy: RevenueGroupBy = RevenueGroupBy.DAY,
  ): Promise<any[]> {
    let dateFormat: string;
    switch (groupBy) {
      case RevenueGroupBy.DAY:
        dateFormat = 'YYYY-MM-DD';
        break;
      case RevenueGroupBy.WEEK:
        dateFormat = 'IYYY-IW'; // ISO week format
        break;
      case RevenueGroupBy.MONTH:
        dateFormat = 'YYYY-MM';
        break;
      default:
        dateFormat = 'YYYY-MM-DD';
    }

    const results = await this.transactionRepository
      .createQueryBuilder('t')
      .select(`TO_CHAR(t.transaction_date, '${dateFormat}')`, 'period')
      .addSelect('SUM(t.amount)', 'revenue')
      .addSelect('COUNT(t._id)', 'transactionCount')
      .addSelect('MIN(t.transaction_date)', 'periodStart')
      .addSelect('MAX(t.transaction_date)', 'periodEnd')
      .leftJoin('appointment_package', 'ap', 'ap.transaction_id = t._id')
      .leftJoin('appointments', 'a', 'a._id = ap.appointment_id')
      .where('a.clinic_id IN (:...branchIds)', { branchIds })
      .andWhere('t.status = :status', { status: PaymentStatus.SUCCESS })
      .andWhere('t.transaction_date >= :startDate', { startDate })
      .andWhere('t.transaction_date <= :endDate', { endDate })
      .andWhere('t.deleted_at IS NULL')
      .groupBy('period')
      .orderBy('period', 'ASC')
      .getRawMany();

    return results.map((item) => ({
      period: item.period,
      revenue: parseInt(item.revenue || '0', 10),
      transactionCount: parseInt(item.transactionCount || '0', 10),
      periodStart: new Date(item.periodStart).toISOString(),
      periodEnd: new Date(item.periodEnd).toISOString(),
    }));
  }

  /**
   * Calculate Status Breakdown
   *
   * Groups transactions by PaymentStatus
   * NOTE: Does NOT filter by status (includes all statuses)
   */
  private async calculateStatusBreakdown(
    branchIds: string[],
    startDate: string,
    endDate: string,
  ): Promise<any> {
    const statuses = [
      PaymentStatus.SUCCESS,
      PaymentStatus.PENDING,
      PaymentStatus.FAILED,
    ];
    const breakdown: any = {
      success: { count: 0, amount: 0 },
      pending: { count: 0, amount: 0 },
      failed: { count: 0, amount: 0 },
    };

    for (const status of statuses) {
      const result = await this.transactionRepository
        .createQueryBuilder('t')
        .select('COUNT(t._id)', 'count')
        .addSelect('SUM(t.amount)', 'amount')
        .leftJoin('appointment_package', 'ap', 'ap.transaction_id = t._id')
        .leftJoin('appointments', 'a', 'a._id = ap.appointment_id')
        .where('a.clinic_id IN (:...branchIds)', { branchIds })
        .andWhere('t.status = :status', { status })
        .andWhere('t.transaction_date >= :startDate', { startDate })
        .andWhere('t.transaction_date <= :endDate', { endDate })
        .andWhere('t.deleted_at IS NULL')
        .getRawOne();

      const key = status.toLowerCase();
      breakdown[key] = {
        count: parseInt(result.count || '0', 10),
        amount: parseInt(result.amount || '0', 10),
      };
    }

    return breakdown;
  }

  /**
   * Calculate Branch Breakdown
   *
   * Revenue summary per branch for overall report
   * Only counts SUCCESS transactions
   */
  private async calculateBranchBreakdown(
    branchIds: string[],
    startDate: string,
    endDate: string,
    totalRevenue: number,
  ): Promise<any[]> {
    const results = await this.transactionRepository
      .createQueryBuilder('t')
      .select('acc._id', 'managerId')
      .addSelect('cmi.clinic_branch_name', 'branchName')
      .addSelect('cmi.full_name', 'managerName')
      .addSelect('acc.status', 'branchStatus')
      .addSelect('SUM(t.amount)', 'revenue')
      .addSelect('COUNT(t._id)', 'transactionCount')
      .leftJoin('appointment_package', 'ap', 'ap.transaction_id = t._id')
      .leftJoin('appointments', 'a', 'a._id = ap.appointment_id')
      .leftJoin('accounts', 'acc', 'acc._id = a.clinic_id')
      .leftJoin(
        'clinic_manager_information',
        'cmi',
        'cmi.account_id = acc._id',
      )
      .where('a.clinic_id IN (:...branchIds)', { branchIds })
      .andWhere('t.status = :status', { status: PaymentStatus.SUCCESS })
      .andWhere('t.transaction_date >= :startDate', { startDate })
      .andWhere('t.transaction_date <= :endDate', { endDate })
      .andWhere('t.deleted_at IS NULL')
      .groupBy('acc._id')
      .addGroupBy('cmi.clinic_branch_name')
      .addGroupBy('cmi.full_name')
      .addGroupBy('acc.status')
      .orderBy('revenue', 'DESC')
      .getRawMany();

    return results.map((item) => {
      const branchRevenue = parseInt(item.revenue || '0', 10);
      return {
        managerId: item.managerId,
        branchName: item.branchName || 'Unknown Branch',
        managerName: item.managerName || 'Unknown Manager',
        branchStatus: item.branchStatus,
        totalRevenue: branchRevenue,
        transactionCount: parseInt(item.transactionCount || '0', 10),
        revenuePercentage:
          totalRevenue > 0
            ? parseFloat(((branchRevenue / totalRevenue) * 100).toFixed(2))
            : 0,
      };
    });
  }

  /**
   * Calculate Top Services
   *
   * Returns top N services by revenue for a branch
   * Only counts SUCCESS transactions
   */
  private async calculateTopServices(
    branchIds: string[],
    startDate: string,
    endDate: string,
    limit: number,
  ): Promise<any[]> {
    const results = await this.transactionRepository
      .createQueryBuilder('t')
      .select('cs.service_name', 'serviceName')
      .addSelect('cs.service_code', 'serviceCode')
      .addSelect('SUM(t.amount)', 'revenue')
      .addSelect('COUNT(sa._id)', 'count')
      .leftJoin('appointment_package', 'ap', 'ap.transaction_id = t._id')
      .leftJoin('appointments', 'a', 'a._id = ap.appointment_id')
      .leftJoin(
        'service_appointments',
        'sa',
        'sa.appointment_package_id = ap._id',
      )
      .leftJoin(
        'clinic_service_config',
        'csc_config',
        'csc_config._id = sa.clinic_service_id',
      )
      .leftJoin('clinic_services', 'cs', 'cs._id = csc_config.service_id')
      .where('a.clinic_id IN (:...branchIds)', { branchIds })
      .andWhere('t.status = :status', { status: PaymentStatus.SUCCESS })
      .andWhere('t.transaction_date >= :startDate', { startDate })
      .andWhere('t.transaction_date <= :endDate', { endDate })
      .andWhere('t.deleted_at IS NULL')
      .andWhere('cs.service_name IS NOT NULL')
      .groupBy('cs.service_name')
      .addGroupBy('cs.service_code')
      .orderBy('revenue', 'DESC')
      .limit(limit)
      .getRawMany();

    return results.map((item) => ({
      serviceName: item.serviceName,
      serviceCode: item.serviceCode,
      revenue: parseInt(item.revenue || '0', 10),
      count: parseInt(item.count || '0', 10),
    }));
  }
}
