import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Transaction,
  PaymentStatus,
} from '../../transactions/entities/transaction.entity';
import { Account } from '../entities/accounts.entity';
import { AccountRole } from '../enums/account-role.enum';
import { AccountStatus } from '../enums/account-status.enum';
import { ContractStatus } from '../../contracts/enums/contract-status.enum';
import { AppointmentStatus } from '../../appointments/enums/appointment-status.enum';
import {
  ClinicRevenueFilterDto,
  RevenueGroupBy,
  OverallRevenueReportResponseDto,
  BranchRevenueReportResponseDto,
  RevenueSummaryDto,
  PaymentMethodBreakdownDto,
  RevenueTrendDataPointDto,
  TransactionStatusBreakdownDto,
  BranchOperationalOverviewDto,
  BranchCustomerStatsItemDto,
  BranchDoctorFeedbackDto,
  BranchServiceStatsDto,
} from './dto';
import { BranchOperationalSummaryDto } from './dto/overall-revenue-report-response.dto';
import {
  formatToVietnamTime,
  parseVietnamTime,
} from 'src/common/utils/date.util';

interface TopServiceItem {
  serviceName: string;
  serviceCode: string;
  revenue: number;
  count: number;
}

@Injectable()
export class ClinicRevenueService {
  private readonly excludedAppointmentStatuses = [
    AppointmentStatus.CANCELLED,
    AppointmentStatus.ABSENT,
  ];

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
  ) {}

  async getOverallRevenueReport(
    adminId: string,
    filterDto: ClinicRevenueFilterDto,
  ): Promise<OverallRevenueReportResponseDto> {
    await this.validateClinicAdmin(adminId);
    this.validateDateRange(filterDto.startDate, filterDto.endDate);

    const branchIds = await this.getAdminBranchIds(adminId);
    if (branchIds.length === 0) {
      throw new NotFoundException('No branches found under this admin');
    }

    const [
      branchSummaries,
      paymentMethodBreakdown,
      revenueTrend,
      statusBreakdown,
      transactionTypeBreakdown,
      branchBreakdown,
    ] = await Promise.all([
      Promise.all(
        branchIds.map((branchId) =>
          this.calculateBranchRevenueSummary(
            branchId,
            filterDto.startDate,
            filterDto.endDate,
          ),
        ),
      ),
      this.calculateOverviewPaymentMethodBreakdown(
        branchIds,
        filterDto.startDate,
        filterDto.endDate,
      ),
      this.calculateOverviewRevenueTrend(
        branchIds,
        filterDto.startDate,
        filterDto.endDate,
        filterDto.groupBy || RevenueGroupBy.DAY,
      ),
      this.calculateOverviewStatusBreakdown(
        branchIds,
        filterDto.startDate,
        filterDto.endDate,
      ),
      this.calculateOverviewTransactionTypeBreakdown(
        branchIds,
        filterDto.startDate,
        filterDto.endDate,
      ),
      this.calculateOverviewBranchOperationalBreakdown(
        adminId,
        branchIds,
        filterDto.startDate,
        filterDto.endDate,
      ),
    ]);

    const totalRevenue = branchSummaries.reduce(
      (sum, item) => sum + item.totalRevenue,
      0,
    );
    const transactionCount = branchSummaries.reduce(
      (sum, item) => sum + item.transactionCount,
      0,
    );
    const uniquePatients = branchBreakdown.reduce(
      (sum, item) => sum + item.totalCustomers,
      0,
    );

    const summary = {
      totalRevenue,
      transactionCount,
      uniquePatients,
      averageTransactionValue:
        transactionCount > 0 ? Math.round(totalRevenue / transactionCount) : 0,
    };

    const finalPayload: OverallRevenueReportResponseDto = {
      period: {
        startDate: filterDto.startDate,
        endDate: filterDto.endDate,
        groupedBy: filterDto.groupBy || RevenueGroupBy.DAY,
        generatedAt: formatToVietnamTime(),
      },
      summary,
      paymentMethodBreakdown,
      revenueTrend,
      statusBreakdown,
      transactionTypeBreakdown,
      branchBreakdown,
      totalBranches: branchIds.length,
    };
    return finalPayload;
  }

  async getBranchRevenueReport(
    adminId: string,
    managerId: string,
    filterDto: ClinicRevenueFilterDto,
  ): Promise<BranchRevenueReportResponseDto> {
    await this.validateClinicAdmin(adminId);
    this.validateDateRange(filterDto.startDate, filterDto.endDate);

    const manager = await this.validateManagerOwnership(adminId, managerId);
    const branchInfo = await this.getBranchInformation(manager);

    const [
      summary,
      paymentMethodBreakdown,
      revenueTrend,
      statusBreakdown,
      operationalOverview,
      customerStats,
      doctorsFeedback,
      servicesStats,
    ] = await Promise.all([
      this.calculateBranchRevenueSummary(managerId, filterDto.startDate, filterDto.endDate),
      this.calculateBranchPaymentMethodBreakdown(managerId, filterDto.startDate, filterDto.endDate),
      this.calculateBranchRevenueTrend(
        managerId,
        filterDto.startDate,
        filterDto.endDate,
        filterDto.groupBy || RevenueGroupBy.DAY,
      ),
      this.calculateBranchStatusBreakdown(managerId, filterDto.startDate, filterDto.endDate),
      this.calculateBranchOperationalOverview(managerId, filterDto.startDate, filterDto.endDate),
      this.getBranchCustomerStats(managerId, filterDto),
      this.getBranchDoctorsWorkingAndFeedback(managerId, filterDto.startDate),
      this.getBranchServiceStats(managerId, filterDto.startDate, filterDto.endDate),
    ]);

    const topServices = [...servicesStats]
      .sort((a, b) => b.registrationCount - a.registrationCount)
      .slice(0, 5);

    const finalPayload: BranchRevenueReportResponseDto = {
      period: {
        startDate: filterDto.startDate,
        endDate: filterDto.endDate,
        groupedBy: filterDto.groupBy || RevenueGroupBy.DAY,
        generatedAt: formatToVietnamTime(),
      },
      branchInfo,
      operationalOverview,
      customerStats,
      doctorsFeedback,
      servicesStats,
      topServices,
      summary,
      paymentMethodBreakdown,
      revenueTrend,
      statusBreakdown,
    };
    return finalPayload;
  }

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

  private validateDateRange(startDate: string, endDate: string): void {
    const start = parseVietnamTime(startDate);
    const end = parseVietnamTime(endDate);

    if (start >= end) {
      throw new BadRequestException('startDate must be before endDate');
    }

    const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 365) {
      throw new BadRequestException('Date range cannot exceed 365 days');
    }
  }

  private async getAdminBranchIds(adminId: string): Promise<string[]> {
    const branches = await this.accountRepository
      .createQueryBuilder('account')
      .select('account._id', '_id')
      .where('account.parent_id = :adminId', { adminId })
      .andWhere('account.role::text = :role', { role: AccountRole.CLINIC_MANAGER })
      .andWhere('account.deleted_at IS NULL')
      .getRawMany();

    return branches.map((branch) => branch._id);
  }

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

  private async getBranchInformation(manager: Account): Promise<{
    managerId: string;
    branchName: string;
    managerName: string;
    branchStatus: string;
  }> {
    return {
      managerId: manager._id,
      branchName:
        manager.clinicManagerInformation?.clinicBranchName || 'Unknown Branch',
      managerName:
        manager.clinicManagerInformation?.fullName || 'Unknown Manager',
      branchStatus: manager.status,
    };
  }

  private async calculateOverviewRevenueSummary(
    branchIds: string[],
    startDate: string,
    endDate: string,
  ): Promise<{ totalRevenue: number; transactionCount: number; averageTransactionValue: number }> {
    const [result] = await this.accountRepository.manager.query(
      `
        WITH mapped_transactions AS (
          SELECT DISTINCT
            t._id,
            t.amount
          FROM transactions t
          JOIN appointment_package ap ON ap.transaction_id = t._id AND ap.deleted_at IS NULL
          JOIN appointments apt ON apt._id = ap.appointment_id
          WHERE apt.clinic_id = ANY($1)
            AND t.status = $2
            AND t.transaction_date >= $3::timestamptz
            AND t.transaction_date <= $4::timestamptz
            AND t.deleted_at IS NULL
            AND ap.deleted_at IS NULL
            AND apt.deleted_at IS NULL
            AND NOT apt.status = ANY($5)
        )
        SELECT
          COALESCE(SUM(mt.amount), 0) as "totalRevenue",
          COUNT(mt._id) as "transactionCount"
        FROM mapped_transactions mt
      `,
      [
        branchIds,
        PaymentStatus.SUCCESS,
        startDate,
        endDate,
        this.excludedAppointmentStatuses,
      ],
    );

    const totalRevenue = parseInt(result.totalRevenue || '0', 10);
    const transactionCount = parseInt(result.transactionCount || '0', 10);
    return {
      totalRevenue,
      transactionCount,
      averageTransactionValue:
        transactionCount > 0 ? Math.round(totalRevenue / transactionCount) : 0,
    };
  }

  private async calculateOverviewUniquePatients(
    branchIds: string[],
    startDate: string,
    endDate: string,
  ): Promise<number> {
    const result = await this.accountRepository.manager
      .createQueryBuilder()
      .select('COUNT(DISTINCT apt.patient_id)', 'uniquePatients')
      .from('appointments', 'apt')
      .where('apt.clinic_id = ANY(:branchIds)', { branchIds })
      .andWhere('apt.appointment_date >= :startDate::date', { startDate })
      .andWhere('apt.appointment_date <= :endDate::date', { endDate })
      .andWhere('apt.status::text = :completedStatus', {
        completedStatus: AppointmentStatus.COMPLETED,
      })
      .andWhere('apt.deleted_at IS NULL')
      .getRawOne();

    return parseInt(result.uniquePatients || '0', 10);
  }

  private async calculateOverviewTransactionTypeBreakdown(
    branchIds: string[],
    startDate: string,
    endDate: string,
  ): Promise<{
    items: {
      typeName: string;
      count: number;
      amount: number;
      percentage: number;
    }[];
    totalCount: number;
  }> {
    const results = await this.transactionRepository
      .createQueryBuilder('t')
      .select('tt.name', 'typeName')
      .addSelect('COUNT(DISTINCT t._id)', 'count')
      .addSelect('COALESCE(SUM(t.amount), 0)', 'amount')
      .innerJoin('appointment_package', 'ap', 'ap.transaction_id = t._id AND ap.deleted_at IS NULL')
      .innerJoin('appointments', 'apt', 'apt._id = ap.appointment_id')
      .leftJoin('transactions_type', 'tt', 'tt._id = t.transaction_type_id')
      .where('apt.clinic_id = ANY(:branchIds)', { branchIds })
      .andWhere('t.transaction_date >= :startDate::timestamptz', { startDate })
      .andWhere('t.transaction_date <= :endDate::timestamptz', { endDate })
      .andWhere('t.deleted_at IS NULL')
      .andWhere('apt.deleted_at IS NULL')
      .andWhere('NOT apt.status = ANY(:excludedStatuses)', {
        excludedStatuses: this.excludedAppointmentStatuses,
      })
      .groupBy('tt.name')
      .orderBy('count', 'DESC')
      .getRawMany();

    const totalCount = results.reduce(
      (sum, item) => sum + parseInt(item.count || '0', 10),
      0,
    );

    const items = results.map((item) => {
      const count = parseInt(item.count || '0', 10);
      const amount = parseInt(item.amount || '0', 10);
      return {
        typeName: item.typeName || 'Unknown',
        count,
        amount,
        percentage:
          totalCount > 0
            ? parseFloat(((count / totalCount) * 100).toFixed(2))
            : 0,
      };
    });

    return { items, totalCount };
  }

  private async calculateOverviewPaymentMethodBreakdown(
    branchIds: string[],
    startDate: string,
    endDate: string,
  ): Promise<PaymentMethodBreakdownDto> {
    const [result] = await this.accountRepository.manager.query(
      `
        WITH mapped_transactions AS (
          SELECT DISTINCT
            t._id,
            t.amount,
            t.gateway,
            ap.payment_type
          FROM transactions t
          JOIN appointment_package ap ON ap.transaction_id = t._id AND ap.deleted_at IS NULL
          JOIN appointments apt ON apt._id = ap.appointment_id
          WHERE apt.clinic_id = ANY($1)
            AND t.status = $2
            AND t.transaction_date >= $3::timestamptz
            AND t.transaction_date <= $4::timestamptz
            AND t.deleted_at IS NULL
            AND ap.deleted_at IS NULL
            AND apt.deleted_at IS NULL
            AND NOT apt.status = ANY($5)
        )
        SELECT
          COALESCE(SUM(CASE WHEN mt.gateway IS NOT NULL THEN mt.amount ELSE 0 END), 0) as "onlineRevenue",
          COUNT(CASE WHEN mt.gateway IS NOT NULL THEN mt._id END) as "onlineCount",
          COALESCE(SUM(CASE WHEN mt.payment_type = 'cod' THEN mt.amount ELSE 0 END), 0) as "cashRevenue",
          COUNT(CASE WHEN mt.payment_type = 'cod' THEN mt._id END) as "cashCount"
        FROM mapped_transactions mt
      `,
      [
        branchIds,
        PaymentStatus.SUCCESS,
        startDate,
        endDate,
        this.excludedAppointmentStatuses,
      ],
    );

    const onlineRevenue = parseInt(
      result.onlinerevenue || result.onlineRevenue || '0',
      10,
    );
    const onlineCount = parseInt(
      result.onlinecount || result.onlineCount || '0',
      10,
    );
    const cashRevenue = parseInt(
      result.cashrevenue || result.cashRevenue || '0',
      10,
    );
    const cashCount = parseInt(result.cashcount || result.cashCount || '0', 10);
    const totalRevenue = onlineRevenue + cashRevenue;

    return {
      online: {
        paymentMethod: 'Online Payment',
        revenue: onlineRevenue,
        transactionCount: onlineCount,
        percentage:
          totalRevenue > 0
            ? parseFloat(((onlineRevenue / totalRevenue) * 100).toFixed(2))
            : 0,
      },
      cash: {
        paymentMethod: 'Cash on Delivery',
        revenue: cashRevenue,
        transactionCount: cashCount,
        percentage:
          totalRevenue > 0
            ? parseFloat(((cashRevenue / totalRevenue) * 100).toFixed(2))
            : 0,
      },
    };
  }

  private async calculateOverviewRevenueTrend(
    branchIds: string[],
    startDate: string,
    endDate: string,
    groupBy: RevenueGroupBy,
  ): Promise<RevenueTrendDataPointDto[]> {
    const dateFormat = this.getRevenueDateFormat(groupBy);
    const results = await this.accountRepository.manager.query(
      `
        WITH mapped_transactions AS (
          SELECT DISTINCT
            t._id,
            t.amount,
            t.transaction_date
          FROM transactions t
          JOIN appointment_package ap ON ap.transaction_id = t._id AND ap.deleted_at IS NULL
          JOIN appointments apt ON apt._id = ap.appointment_id
          WHERE apt.clinic_id = ANY($1)
            AND t.status = $2
            AND t.transaction_date >= $3::timestamptz
            AND t.transaction_date <= $4::timestamptz
            AND t.deleted_at IS NULL
            AND ap.deleted_at IS NULL
            AND apt.deleted_at IS NULL
            AND NOT apt.status = ANY($5)
        )
        SELECT
          TO_CHAR(mt.transaction_date, '${dateFormat}') as "period",
          COALESCE(SUM(mt.amount), 0) as "revenue",
          COUNT(mt._id) as "transactionCount",
          MIN(mt.transaction_date) as "periodStart",
          MAX(mt.transaction_date) as "periodEnd"
        FROM mapped_transactions mt
        GROUP BY "period"
        ORDER BY "period" ASC
      `,
      [
        branchIds,
        PaymentStatus.SUCCESS,
        startDate,
        endDate,
        this.excludedAppointmentStatuses,
      ],
    );

    return results.map((item) => ({
      period: item.period,
      revenue: parseInt(item.revenue || '0', 10),
      transactionCount: parseInt(item.transactionCount || '0', 10),
      periodStart: formatToVietnamTime(item.periodStart),
      periodEnd: formatToVietnamTime(item.periodEnd),
    }));
  }

  private async calculateOverviewStatusBreakdown(
    branchIds: string[],
    startDate: string,
    endDate: string,
  ): Promise<TransactionStatusBreakdownDto> {
    const [result] = await this.accountRepository.manager.query(
      `
        WITH mapped_transactions AS (
          SELECT DISTINCT
            t._id,
            t.amount,
            t.status
          FROM transactions t
          JOIN appointment_package ap ON ap.transaction_id = t._id AND ap.deleted_at IS NULL
          JOIN appointments apt ON apt._id = ap.appointment_id
          WHERE apt.clinic_id = ANY($1)
            AND t.transaction_date >= $2::timestamptz
            AND t.transaction_date <= $3::timestamptz
            AND t.deleted_at IS NULL
            AND ap.deleted_at IS NULL
            AND apt.deleted_at IS NULL
            AND NOT apt.status = ANY($4)
        )
        SELECT
          COUNT(CASE WHEN mt.status = 'SUCCESS' THEN mt._id END) as "successCount",
          COALESCE(SUM(CASE WHEN mt.status = 'SUCCESS' THEN mt.amount ELSE 0 END), 0) as "successAmount",
          COUNT(CASE WHEN mt.status = 'PENDING' THEN mt._id END) as "pendingCount",
          COALESCE(SUM(CASE WHEN mt.status = 'PENDING' THEN mt.amount ELSE 0 END), 0) as "pendingAmount",
          COUNT(CASE WHEN mt.status = 'FAILED' THEN mt._id END) as "failedCount",
          COALESCE(SUM(CASE WHEN mt.status = 'FAILED' THEN mt.amount ELSE 0 END), 0) as "failedAmount"
        FROM mapped_transactions mt
      `,
      [branchIds, startDate, endDate, this.excludedAppointmentStatuses],
    );

    return {
      success: {
        count: parseInt(result.successcount || result.successCount || '0', 10),
        amount: parseInt(
          result.successamount || result.successAmount || '0',
          10,
        ),
      },
      pending: {
        count: parseInt(result.pendingcount || result.pendingCount || '0', 10),
        amount: parseInt(
          result.pendingamount || result.pendingAmount || '0',
          10,
        ),
      },
      failed: {
        count: parseInt(result.failedcount || result.failedCount || '0', 10),
        amount: parseInt(result.failedamount || result.failedAmount || '0', 10),
      },
    };
  }

  private async calculateOverviewBranchOperationalBreakdown(
    adminId: string,
    branchIds: string[],
    startDate: string,
    endDate: string,
  ): Promise<BranchOperationalSummaryDto[]> {
    const branches = await this.accountRepository
      .createQueryBuilder('acc')
      .select('acc._id', 'managerId')
      .addSelect('cmi.clinic_branch_name', 'branchName')
      .addSelect('cmi.full_name', 'managerName')
      .leftJoin(
        'clinic_manager_information',
        'cmi',
        'cmi.account_id = acc._id',
      )
      .where('acc.parent_id = :adminId', { adminId })
      .andWhere('acc._id = ANY(:branchIds)', { branchIds })
      .andWhere('acc.role::text = :role', { role: AccountRole.CLINIC_MANAGER })
      .andWhere('acc.deleted_at IS NULL')
      .orderBy('cmi.clinic_branch_name', 'ASC')
      .getRawMany();

    const branchOperationalRows = await Promise.all(
      branches.map((branch) =>
        this.calculateBranchOperationalOverview(
          branch.managerId,
          startDate,
          endDate,
        ),
      ),
    );

    return branches.map((branch, index) => ({
      managerId: branch.managerId,
      branchName: branch.branchName || 'Unknown Branch',
      managerName: branch.managerName || 'Unknown Manager',
      totalCustomers: branchOperationalRows[index].totalCustomers,
      totalDoctors: branchOperationalRows[index].totalDoctors,
      totalServices: branchOperationalRows[index].totalServices,
    }));
  }

  private async calculateBranchRevenueSummary(
    managerId: string,
    startDate: string,
    endDate: string,
  ): Promise<RevenueSummaryDto> {
    const [result] = await this.accountRepository.manager.query(
      `
        WITH mapped_transactions AS (
          SELECT DISTINCT
            t._id,
            t.amount,
            apt.patient_id
          FROM transactions t
          JOIN appointment_package ap ON ap.transaction_id = t._id AND ap.deleted_at IS NULL
          JOIN appointments apt ON apt._id = ap.appointment_id
          WHERE apt.clinic_id = $1
            AND t.status = $2
            AND t.transaction_date >= $3::timestamptz
            AND t.transaction_date <= $4::timestamptz
            AND t.deleted_at IS NULL
            AND ap.deleted_at IS NULL
            AND apt.deleted_at IS NULL
            AND NOT apt.status = ANY($5)
        )
        SELECT
          COALESCE(SUM(mt.amount), 0) as "totalRevenue",
          COUNT(mt._id) as "transactionCount",
          COUNT(DISTINCT mt.patient_id) as "uniquePatients"
        FROM mapped_transactions mt
      `,
      [
        managerId,
        PaymentStatus.SUCCESS,
        startDate,
        endDate,
        this.excludedAppointmentStatuses,
      ],
    );

    const totalRevenue = parseInt(result.totalRevenue || '0', 10);
    const transactionCount = parseInt(result.transactionCount || '0', 10);
    return {
      totalRevenue,
      transactionCount,
      uniquePatients: parseInt(result.uniquePatients || '0', 10),
      averageTransactionValue:
        transactionCount > 0 ? Math.round(totalRevenue / transactionCount) : 0,
    };
  }

  private async calculateBranchPaymentMethodBreakdown(
    managerId: string,
    startDate: string,
    endDate: string,
  ): Promise<PaymentMethodBreakdownDto> {
    const [result] = await this.accountRepository.manager.query(
      `
        WITH mapped_transactions AS (
          SELECT DISTINCT
            t._id,
            t.amount,
            t.gateway,
            ap.payment_type
          FROM transactions t
          JOIN appointment_package ap ON ap.transaction_id = t._id AND ap.deleted_at IS NULL
          JOIN appointments apt ON apt._id = ap.appointment_id
          WHERE apt.clinic_id = $1
            AND t.status = $2
            AND t.transaction_date >= $3::timestamptz
            AND t.transaction_date <= $4::timestamptz
            AND t.deleted_at IS NULL
            AND ap.deleted_at IS NULL
            AND apt.deleted_at IS NULL
            AND NOT apt.status = ANY($5)
        )
        SELECT
          COALESCE(SUM(CASE WHEN mt.gateway IS NOT NULL THEN mt.amount ELSE 0 END), 0) as "onlineRevenue",
          COUNT(CASE WHEN mt.gateway IS NOT NULL THEN mt._id END) as "onlineCount",
          COALESCE(SUM(CASE WHEN mt.payment_type = 'cod' THEN mt.amount ELSE 0 END), 0) as "cashRevenue",
          COUNT(CASE WHEN mt.payment_type = 'cod' THEN mt._id END) as "cashCount"
        FROM mapped_transactions mt
      `,
      [
        managerId,
        PaymentStatus.SUCCESS,
        startDate,
        endDate,
        this.excludedAppointmentStatuses,
      ],
    );

    const onlineRevenue = parseInt(
      result.onlinerevenue || result.onlineRevenue || '0',
      10,
    );
    const onlineCount = parseInt(
      result.onlinecount || result.onlineCount || '0',
      10,
    );
    const cashRevenue = parseInt(
      result.cashrevenue || result.cashRevenue || '0',
      10,
    );
    const cashCount = parseInt(result.cashcount || result.cashCount || '0', 10);
    const totalRevenue = onlineRevenue + cashRevenue;

    return {
      online: {
        paymentMethod: 'Online Payment',
        revenue: onlineRevenue,
        transactionCount: onlineCount,
        percentage:
          totalRevenue > 0
            ? parseFloat(((onlineRevenue / totalRevenue) * 100).toFixed(2))
            : 0,
      },
      cash: {
        paymentMethod: 'Cash on Delivery',
        revenue: cashRevenue,
        transactionCount: cashCount,
        percentage:
          totalRevenue > 0
            ? parseFloat(((cashRevenue / totalRevenue) * 100).toFixed(2))
            : 0,
      },
    };
  }

  private async calculateBranchRevenueTrend(
    managerId: string,
    startDate: string,
    endDate: string,
    groupBy: RevenueGroupBy,
  ): Promise<RevenueTrendDataPointDto[]> {
    const dateFormat = this.getRevenueDateFormat(groupBy);
    const results = await this.accountRepository.manager.query(
      `
        WITH mapped_transactions AS (
          SELECT DISTINCT
            t._id,
            t.amount,
            t.transaction_date
          FROM transactions t
          JOIN appointment_package ap ON ap.transaction_id = t._id AND ap.deleted_at IS NULL
          JOIN appointments apt ON apt._id = ap.appointment_id
          WHERE apt.clinic_id = $1
            AND t.status = $2
            AND t.transaction_date >= $3::timestamptz
            AND t.transaction_date <= $4::timestamptz
            AND t.deleted_at IS NULL
            AND ap.deleted_at IS NULL
            AND apt.deleted_at IS NULL
            AND NOT apt.status = ANY($5)
        )
        SELECT
          TO_CHAR(mt.transaction_date, '${dateFormat}') as "period",
          COALESCE(SUM(mt.amount), 0) as "revenue",
          COUNT(mt._id) as "transactionCount",
          MIN(mt.transaction_date) as "periodStart",
          MAX(mt.transaction_date) as "periodEnd"
        FROM mapped_transactions mt
        GROUP BY "period"
        ORDER BY "period" ASC
      `,
      [
        managerId,
        PaymentStatus.SUCCESS,
        startDate,
        endDate,
        this.excludedAppointmentStatuses,
      ],
    );

    return results.map((item) => ({
      period: item.period,
      revenue: parseInt(item.revenue || '0', 10),
      transactionCount: parseInt(item.transactionCount || '0', 10),
      periodStart: formatToVietnamTime(item.periodStart),
      periodEnd: formatToVietnamTime(item.periodEnd),
    }));
  }

  private async calculateBranchStatusBreakdown(
    managerId: string,
    startDate: string,
    endDate: string,
  ): Promise<TransactionStatusBreakdownDto> {
    const [result] = await this.accountRepository.manager.query(
      `
        WITH mapped_transactions AS (
          SELECT DISTINCT
            t._id,
            t.amount,
            t.status
          FROM transactions t
          JOIN appointment_package ap ON ap.transaction_id = t._id AND ap.deleted_at IS NULL
          JOIN appointments apt ON apt._id = ap.appointment_id
          WHERE apt.clinic_id = $1
            AND t.transaction_date >= $2::timestamptz
            AND t.transaction_date <= $3::timestamptz
            AND t.deleted_at IS NULL
            AND ap.deleted_at IS NULL
            AND apt.deleted_at IS NULL
            AND NOT apt.status = ANY($4)
        )
        SELECT
          COUNT(CASE WHEN mt.status = 'SUCCESS' THEN mt._id END) as "successCount",
          COALESCE(SUM(CASE WHEN mt.status = 'SUCCESS' THEN mt.amount ELSE 0 END), 0) as "successAmount",
          COUNT(CASE WHEN mt.status = 'PENDING' THEN mt._id END) as "pendingCount",
          COALESCE(SUM(CASE WHEN mt.status = 'PENDING' THEN mt.amount ELSE 0 END), 0) as "pendingAmount",
          COUNT(CASE WHEN mt.status = 'FAILED' THEN mt._id END) as "failedCount",
          COALESCE(SUM(CASE WHEN mt.status = 'FAILED' THEN mt.amount ELSE 0 END), 0) as "failedAmount"
        FROM mapped_transactions mt
      `,
      [managerId, startDate, endDate, this.excludedAppointmentStatuses],
    );

    return {
      success: {
        count: parseInt(result.successcount || result.successCount || '0', 10),
        amount: parseInt(
          result.successamount || result.successAmount || '0',
          10,
        ),
      },
      pending: {
        count: parseInt(result.pendingcount || result.pendingCount || '0', 10),
        amount: parseInt(
          result.pendingamount || result.pendingAmount || '0',
          10,
        ),
      },
      failed: {
        count: parseInt(result.failedcount || result.failedCount || '0', 10),
        amount: parseInt(result.failedamount || result.failedAmount || '0', 10),
      },
    };
  }

  private async calculateBranchOperationalOverview(
    managerId: string,
    startDate: string,
    endDate: string,
  ): Promise<BranchOperationalOverviewDto> {
    const [customerRow, doctorRow, serviceRow] = await Promise.all([
      this.accountRepository.manager
        .createQueryBuilder()
        .select('COUNT(DISTINCT apt.patient_id)', 'totalCustomers')
        .from('appointments', 'apt')
        .where('apt.clinic_id = :managerId', { managerId })
        .andWhere('apt.appointment_date >= :startDate::date', { startDate })
        .andWhere('apt.appointment_date <= :endDate::date', { endDate })
        .andWhere('apt.status::text = :completedStatus', {
          completedStatus: AppointmentStatus.COMPLETED,
        })
        .andWhere('apt.deleted_at IS NULL')
        .getRawOne(),
      this.accountRepository.manager
        .createQueryBuilder()
        .select('COUNT(DISTINCT doctor._id)', 'totalDoctors')
        .from('contract_package', 'cp')
        .innerJoin('clinic_contract_information', 'cci', 'cci.contract_id = cp._id')
        .innerJoin('accounts', 'doctor', 'doctor._id = cp.employee_id')
        .where('cp.clinic_manager_id = :managerId', { managerId })
        .andWhere('cp.role::text = :doctorRole', { doctorRole: AccountRole.DOCTOR })
        .andWhere('cp.deleted_at IS NULL')
        .andWhere('cci.contract_status::text = :currentStatus', { currentStatus: ContractStatus.CURRENT })
        .andWhere('cci.deleted_at IS NULL')
        .andWhere('doctor.role::text = :doctorRole', { doctorRole: AccountRole.DOCTOR })
        .andWhere('doctor.status::text = :doctorStatus', { doctorStatus: AccountStatus.ACTIVE })
        .andWhere('doctor.deleted_at IS NULL')
        .getRawOne(),
      this.accountRepository.manager
        .createQueryBuilder()
        .select('COUNT(csc._id)', 'totalServices')
        .from('clinic_service_config', 'csc')
        .where('csc.clinic_id = :managerId', { managerId })
        .andWhere('csc.is_active = :isActive', { isActive: true })
        .andWhere('csc.deleted_at IS NULL')
        .getRawOne(),
    ]);

    return {
      totalCustomers: parseInt(customerRow.totalCustomers || '0', 10),
      totalDoctors: parseInt(doctorRow.totalDoctors || '0', 10),
      totalServices: parseInt(serviceRow.totalServices || '0', 10),
    };
  }

  private async getBranchCustomerStats(
    managerId: string,
    filterDto: ClinicRevenueFilterDto,
  ): Promise<BranchCustomerStatsItemDto[]> {
    const dateGroupBy = this.getCustomerDateFormat(
      filterDto.groupBy || RevenueGroupBy.DAY,
    );

    const rows = await this.accountRepository.manager
      .createQueryBuilder()
      .select(dateGroupBy, 'label')
      .addSelect('COUNT(DISTINCT appointment.patient_id)', 'count')
      .from('appointments', 'appointment')
      .innerJoin(
        'appointment_package',
        'ap',
        'ap.appointment_id = appointment._id AND ap.deleted_at IS NULL',
      )
      .innerJoin('transactions', 't', 't._id = ap.transaction_id')
      .where('appointment.clinic_id = :managerId', { managerId })
      .andWhere('appointment.appointment_date >= :startDate::date', {
        startDate: filterDto.startDate,
      })
      .andWhere('appointment.appointment_date <= :endDate::date', {
        endDate: filterDto.endDate,
      })
      .andWhere('t.status::text = :successStatus', {
        successStatus: PaymentStatus.SUCCESS,
      })
      .andWhere('t.deleted_at IS NULL')
      .andWhere('appointment.deleted_at IS NULL')
      .andWhere('NOT appointment.status::text = ANY(:excludedStatuses)', {
        excludedStatuses: this.excludedAppointmentStatuses,
      })
      .groupBy(dateGroupBy)
      .orderBy('label', 'ASC')
      .getRawMany();

    return rows.map((item) => ({
      label: item.label,
      count: parseInt(item.count || '0', 10),
    }));
  }

  private async getBranchDoctorsWorkingAndFeedback(
    managerId: string,
    date: string,
  ): Promise<BranchDoctorFeedbackDto[]> {
    const doctorsWithStats = await this.accountRepository.manager.query(
      `
        SELECT 
          acc._id as "doctorId",
          ga.full_name as "fullName",
          ga.profile_picture as "profilePicture",
          COALESCE(AVG(fb.rating)::NUMERIC(3,2), 0) as "avgRating",
          COUNT(fb._id) as "totalFeedback"
        FROM appointments apt
        JOIN accounts acc ON acc._id = apt.doctor_id
        LEFT JOIN general_accounts ga ON ga.account_id = acc._id
        LEFT JOIN feedbacks fb ON fb.doctor_id = acc._id AND fb.type = 'DOCTOR'
        WHERE apt.clinic_id = $1 
          AND apt.appointment_date = $2
          AND apt.status NOT IN ('CANCELLED', 'ABSENT')
        GROUP BY acc._id, ga.full_name, ga.profile_picture
        ORDER BY ga.full_name ASC
      `,
      [managerId, date],
    );

    if (doctorsWithStats.length === 0) {
      return [];
    }

    const doctorIds = doctorsWithStats.map(
      (item: { doctorId: string }) => item.doctorId,
    );
    const recentFeedbacksRaw = await this.accountRepository.manager.query(
      `
        SELECT 
          fb.doctor_id as "doctorId",
          fb.rating,
          fb.description,
          ga.full_name as "patientName"
        FROM feedbacks fb
        LEFT JOIN appointments apt ON apt._id = fb.appointment_id
        LEFT JOIN accounts acc ON acc._id = apt.patient_id
        LEFT JOIN general_accounts ga ON ga.account_id = acc._id
        WHERE fb.doctor_id = ANY($1) AND fb.type = 'DOCTOR'
        ORDER BY fb.created_at DESC
      `,
      [doctorIds],
    );

    const feedbacksByDoctor = new Map<
      string,
      Array<{
        rating: number;
        description: string | null;
        patientName: string | null;
      }>
    >();
    for (const fb of recentFeedbacksRaw) {
      if (!feedbacksByDoctor.has(fb.doctorId)) {
        feedbacksByDoctor.set(fb.doctorId, []);
      }
      if (feedbacksByDoctor.get(fb.doctorId)!.length < 5) {
        feedbacksByDoctor.get(fb.doctorId)!.push({
          rating: fb.rating,
          description: fb.description,
          patientName: fb.patientName,
        });
      }
    }

    return doctorsWithStats.map((doc: any) => ({
      doctorId: doc.doctorId,
      fullName: doc.fullName,
      profilePicture: doc.profilePicture,
      avgRating: parseFloat(doc.avgRating || '0'),
      totalFeedback: parseInt(doc.totalFeedback || '0', 10),
      recentFeedbacks: feedbacksByDoctor.get(doc.doctorId) || [],
    }));
  }

  private async getBranchServiceStats(
    managerId: string,
    startDate: string,
    endDate: string,
  ): Promise<BranchServiceStatsDto[]> {
    const data = await this.accountRepository.manager.query(
      `
        SELECT 
          cs.service_name as "serviceName",
          COUNT(sa._id) as "registrationCount"
        FROM service_appointments sa
        JOIN appointment_package ap ON ap._id = sa.appointment_package_id
        JOIN appointments apt ON apt._id = ap.appointment_id
        JOIN transactions t ON t._id = ap.transaction_id
        JOIN clinic_service_config csc ON csc._id = sa.clinic_service_id
        JOIN clinic_services cs ON cs._id = csc.service_id
        WHERE apt.clinic_id = $1
          AND apt.status::text NOT IN ('CANCELLED', 'ABSENT')
          AND apt.appointment_date >= $2
          AND apt.appointment_date <= $3
          AND t.status::text = $4
          AND t.deleted_at IS NULL
          AND apt.deleted_at IS NULL
          AND ap.deleted_at IS NULL
          AND csc.is_active = TRUE
          AND csc.deleted_at IS NULL
        GROUP BY cs.service_name
        ORDER BY "registrationCount" DESC
      `,
      [managerId, startDate, endDate, PaymentStatus.SUCCESS],
    );

    return data.map((item: any) => ({
      serviceName: item.serviceName,
      registrationCount: parseInt(item.registrationCount || '0', 10),
    }));
  }

  private async calculateTopServices(
    branchIds: string[],
    startDate: string,
    endDate: string,
    limit: number,
  ): Promise<TopServiceItem[]> {
    const results = await this.transactionRepository
      .createQueryBuilder('t')
      .select('cs.service_name', 'serviceName')
      .addSelect('cs.service_code', 'serviceCode')
      .addSelect('SUM(t.amount)', 'revenue')
      .addSelect('COUNT(sa._id)', 'count')
      .innerJoin('appointment_package', 'ap', 'ap.transaction_id = t._id AND ap.deleted_at IS NULL')
      .innerJoin('appointments', 'apt', 'apt._id = ap.appointment_id')
      .innerJoin(
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
      .where('apt.clinic_id = ANY(:branchIds)', { branchIds })
      .andWhere('t.status::text = :status', { status: PaymentStatus.SUCCESS })
      .andWhere('t.transaction_date >= :startDate::timestamptz', { startDate })
      .andWhere('t.transaction_date <= :endDate::timestamptz', { endDate })
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

  private getRevenueDateFormat(groupBy: RevenueGroupBy): string {
    switch (groupBy) {
      case RevenueGroupBy.WEEK:
        return 'IYYY-IW';
      case RevenueGroupBy.MONTH:
        return 'YYYY-MM';
      default:
        return 'YYYY-MM-DD';
    }
  }

  private getCustomerDateFormat(groupBy: RevenueGroupBy): string {
    switch (groupBy) {
      case RevenueGroupBy.WEEK:
        return `TO_CHAR(appointment.appointment_date, 'IYYY-IW')`;
      case RevenueGroupBy.MONTH:
        return `TO_CHAR(appointment.appointment_date, 'YYYY-MM')`;
      default:
        return `TO_CHAR(appointment.appointment_date, 'YYYY-MM-DD')`;
    }
  }
}
