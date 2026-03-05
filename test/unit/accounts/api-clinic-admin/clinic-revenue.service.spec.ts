import { Test, TestingModule } from '@nestjs/testing';
import { ClinicRevenueService } from '../../../../src/modules/accounts/api-clinic-admin/clinic-revenue.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction, PaymentStatus } from '../../../../src/modules/transactions/entities/transaction.entity';
import { Account } from '../../../../src/modules/accounts/entities/accounts.entity';
import { AccountRole, AccountStatus } from '../../../../src/modules/accounts/enums';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { RevenueGroupBy } from '../../../../src/modules/accounts/api-clinic-admin/dto';

describe('ClinicRevenueService', () => {
  let service: ClinicRevenueService;
  let transactionRepository: jest.Mocked<Repository<Transaction>>;
  let accountRepository: jest.Mocked<Repository<Account>>;

  // ============================================================================
  // MOCK DATA FACTORIES
  // ============================================================================

  const createMockAccount = (overrides = {}): Partial<Account> => ({
    _id: 'admin-123',
    email: 'admin@clinic.com',
    role: AccountRole.CLINIC_ADMIN,
    status: AccountStatus.ACTIVE,
    parentId: null,
    deletedAt: null,
    ...overrides,
  });

  const createMockManager = (overrides = {}): Partial<Account> => ({
    _id: 'manager-123',
    email: 'manager@clinic.com',
    role: AccountRole.CLINIC_MANAGER,
    status: AccountStatus.ACTIVE,
    parentId: 'admin-123',
    deletedAt: null,
    clinicManagerInformation: {
      _id: 'info-123',
      accountId: 'manager-123',
      clinicBranchName: 'Main Branch',
      fullName: 'Manager Name',
      gender: 'MALE' as any,
      dob: new Date('1980-01-01'),
      profilePicture: null,
      createdAt: new Date(),
    } as any,
    ...overrides,
  });

  const createMockFilterDto = (overrides = {}) => ({
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    groupBy: RevenueGroupBy.DAY,
    ...overrides,
  });

  // ============================================================================
  // MOCK QUERY BUILDER FACTORY
  // ============================================================================

  const createMockQueryBuilder = () => {
    const qb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(),
      getRawMany: jest.fn(),
      getMany: jest.fn(),
    };
    return qb;
  };

  // ============================================================================
  // SETUP & TEARDOWN
  // ============================================================================

  beforeEach(async () => {
    const mockTransactionRepository = {
      createQueryBuilder: jest.fn(),
    };

    const mockAccountRepository = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicRevenueService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepository,
        },
        {
          provide: getRepositoryToken(Account),
          useValue: mockAccountRepository,
        },
      ],
    }).compile();

    service = module.get<ClinicRevenueService>(ClinicRevenueService);
    transactionRepository = module.get(getRepositoryToken(Transaction));
    accountRepository = module.get(getRepositoryToken(Account));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // TEST SUITE: getOverallRevenueReport
  // ============================================================================

  describe('getOverallRevenueReport', () => {
    it('should successfully generate overall revenue report for valid CLINIC_ADMIN', async () => {
      // Arrange
      const adminId = 'admin-123';
      const filterDto = createMockFilterDto();
      const admin = createMockAccount({ role: AccountRole.CLINIC_ADMIN });
      const branchIds = ['manager-1', 'manager-2'];

      // Mock admin validation
      accountRepository.findOne.mockResolvedValue(admin as Account);

      // Mock branch IDs retrieval
      const accountQb = createMockQueryBuilder();
      accountQb.getMany.mockResolvedValue([
        { _id: 'manager-1' },
        { _id: 'manager-2' },
      ] as Account[]);
      accountRepository.createQueryBuilder.mockReturnValue(accountQb as any);

      // Mock revenue summary
      const summaryQb = createMockQueryBuilder();
      summaryQb.getRawOne.mockResolvedValueOnce({
        totalRevenue: '1000000',
        transactionCount: '10',
        uniquePatients: '5',
      });
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(summaryQb as any);

      // Mock payment method breakdown (online)
      const onlineQb = createMockQueryBuilder();
      onlineQb.getRawOne.mockResolvedValueOnce({
        revenue: '600000',
        transactionCount: '6',
      });
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(onlineQb as any);

      // Mock payment method breakdown (cash)
      const cashQb = createMockQueryBuilder();
      cashQb.getRawOne.mockResolvedValueOnce({
        revenue: '400000',
        transactionCount: '4',
      });
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(cashQb as any);

      // Mock service category breakdown
      const categoryQb = createMockQueryBuilder();
      categoryQb.getRawMany.mockResolvedValueOnce([
        { categoryName: 'Consultation', revenue: '500000', serviceCount: '5' },
        { categoryName: 'Imaging', revenue: '500000', serviceCount: '5' },
      ]);
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(categoryQb as any);

      // Mock revenue trend
      const trendQb = createMockQueryBuilder();
      trendQb.getRawMany.mockResolvedValueOnce([
        {
          period: '2026-01-01',
          revenue: '100000',
          transactionCount: '1',
          periodStart: '2026-01-01T00:00:00Z',
          periodEnd: '2026-01-01T23:59:59Z',
        },
      ]);
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(trendQb as any);

      // Mock status breakdown - SUCCESS
      const successQb = createMockQueryBuilder();
      successQb.getRawOne.mockResolvedValueOnce({
        count: '10',
        amount: '1000000',
      });
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(successQb as any);

      // Mock status breakdown - PENDING
      const pendingQb = createMockQueryBuilder();
      pendingQb.getRawOne.mockResolvedValueOnce({
        count: '2',
        amount: '100000',
      });
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(pendingQb as any);

      // Mock status breakdown - FAILED
      const failedQb = createMockQueryBuilder();
      failedQb.getRawOne.mockResolvedValueOnce({
        count: '1',
        amount: '50000',
      });
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(failedQb as any);

      // Mock branch breakdown
      const branchQb = createMockQueryBuilder();
      branchQb.getRawMany.mockResolvedValueOnce([
        {
          managerId: 'manager-1',
          branchName: 'Branch 1',
          managerName: 'Manager 1',
          branchStatus: AccountStatus.ACTIVE,
          revenue: '600000',
          transactionCount: '6',
        },
        {
          managerId: 'manager-2',
          branchName: 'Branch 2',
          managerName: 'Manager 2',
          branchStatus: AccountStatus.ACTIVE,
          revenue: '400000',
          transactionCount: '4',
        },
      ]);
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(branchQb as any);

      // Act
      const result = await service.getOverallRevenueReport(adminId, filterDto);

      // Assert
      expect(result).toBeDefined();
      expect(result.period.startDate).toBe(filterDto.startDate);
      expect(result.period.endDate).toBe(filterDto.endDate);
      expect(result.period.groupedBy).toBe(RevenueGroupBy.DAY);
      expect(result.summary.totalRevenue).toBe(1000000);
      expect(result.summary.transactionCount).toBe(10);
      expect(result.summary.uniquePatients).toBe(5);
      expect(result.paymentMethodBreakdown.online.revenue).toBe(600000);
      expect(result.paymentMethodBreakdown.cash.revenue).toBe(400000);
      expect(result.serviceCategoryBreakdown).toHaveLength(2);
      expect(result.revenueTrend).toHaveLength(1);
      expect(result.statusBreakdown.success.count).toBe(10);
      expect(result.branchBreakdown).toHaveLength(2);
      expect(result.totalBranches).toBe(2);

      // Verify admin validation
      expect(accountRepository.findOne).toHaveBeenCalledWith({
        where: { _id: adminId },
      });

      // Verify status filter in queries (SUCCESS only for revenue)
      expect(summaryQb.andWhere).toHaveBeenCalledWith('t.status = :status', {
        status: PaymentStatus.SUCCESS,
      });
    });

    it('should throw NotFoundException when admin has no branches', async () => {
      // Arrange
      const adminId = 'admin-123';
      const filterDto = createMockFilterDto();
      const admin = createMockAccount({ role: AccountRole.CLINIC_ADMIN });

      accountRepository.findOne.mockResolvedValue(admin as Account);

      const accountQb = createMockQueryBuilder();
      accountQb.getMany.mockResolvedValue([]); // No branches
      accountRepository.createQueryBuilder.mockReturnValue(accountQb as any);

      // Act & Assert
      await expect(
        service.getOverallRevenueReport(adminId, filterDto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getOverallRevenueReport(adminId, filterDto),
      ).rejects.toThrow('No branches found under this admin');
    });

    it('should throw NotFoundException when admin account does not exist', async () => {
      // Arrange
      const adminId = 'non-existent-admin';
      const filterDto = createMockFilterDto();

      accountRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.getOverallRevenueReport(adminId, filterDto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getOverallRevenueReport(adminId, filterDto),
      ).rejects.toThrow('Admin account not found');
    });

    it('should throw ForbiddenException when user is not CLINIC_ADMIN', async () => {
      // Arrange
      const userId = 'user-123';
      const filterDto = createMockFilterDto();
      const user = createMockAccount({ role: AccountRole.PATIENT });

      accountRepository.findOne.mockResolvedValue(user as Account);

      // Act & Assert
      await expect(
        service.getOverallRevenueReport(userId, filterDto),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.getOverallRevenueReport(userId, filterDto),
      ).rejects.toThrow('Only CLINIC_ADMIN can access revenue reports');
    });

    it('should filter by specific managerId when provided in filterDto', async () => {
      // Arrange
      const adminId = 'admin-123';
      const filterDto = createMockFilterDto({ managerId: 'manager-1' });
      const admin = createMockAccount({ role: AccountRole.CLINIC_ADMIN });

      accountRepository.findOne.mockResolvedValue(admin as Account);

      const accountQb = createMockQueryBuilder();
      accountQb.getMany.mockResolvedValue([{ _id: 'manager-1' }] as Account[]);
      accountRepository.createQueryBuilder.mockReturnValue(accountQb as any);

      // Mock all necessary query builders to prevent actual execution
      const mockQb = createMockQueryBuilder();
      mockQb.getRawOne.mockResolvedValue({
        totalRevenue: '500000',
        transactionCount: '5',
        uniquePatients: '3',
      });
      mockQb.getRawMany.mockResolvedValue([]);

      transactionRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      // Act
      await service.getOverallRevenueReport(adminId, filterDto);

      // Assert - verify that managerId filter was applied
      expect(accountQb.andWhere).toHaveBeenCalledWith(
        'account._id = :managerId',
        { managerId: 'manager-1' },
      );
    });

    it('should include disabled branches in revenue calculation', async () => {
      // Arrange
      const adminId = 'admin-123';
      const filterDto = createMockFilterDto();
      const admin = createMockAccount({ role: AccountRole.CLINIC_ADMIN });

      accountRepository.findOne.mockResolvedValue(admin as Account);

      // Mock returns both ACTIVE and MANAGER_DISABLED branches
      const accountQb = createMockQueryBuilder();
      accountQb.getMany.mockResolvedValue([
        { _id: 'manager-1', status: AccountStatus.ACTIVE },
        { _id: 'manager-2', status: AccountStatus.MANAGER_DISABLED },
      ] as Account[]);
      accountRepository.createQueryBuilder.mockReturnValue(accountQb as any);

      const mockQb = createMockQueryBuilder();
      mockQb.getRawOne.mockResolvedValue({
        totalRevenue: '1000000',
        transactionCount: '10',
        uniquePatients: '5',
      });
      mockQb.getRawMany.mockResolvedValue([]);
      transactionRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      // Act
      const result = await service.getOverallRevenueReport(adminId, filterDto);

      // Assert - should have 2 branches regardless of status
      expect(result.totalBranches).toBe(2);

      // Verify that status filter was NOT applied in branch query
      expect(accountQb.andWhere).not.toHaveBeenCalledWith(
        expect.stringContaining('status'),
        expect.anything(),
      );
    });
  });

  // ============================================================================
  // TEST SUITE: getBranchRevenueReport
  // ============================================================================

  describe('getBranchRevenueReport', () => {
    it('should successfully generate branch revenue report with top services', async () => {
      // Arrange
      const adminId = 'admin-123';
      const managerId = 'manager-123';
      const filterDto = createMockFilterDto();
      const admin = createMockAccount({ role: AccountRole.CLINIC_ADMIN });
      const manager = createMockManager({ parentId: adminId });

      accountRepository.findOne
        .mockResolvedValueOnce(admin as Account)
        .mockResolvedValueOnce(manager as Account);

      // Mock revenue summary
      const summaryQb = createMockQueryBuilder();
      summaryQb.getRawOne.mockResolvedValue({
        totalRevenue: '500000',
        transactionCount: '5',
        uniquePatients: '3',
      });
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(summaryQb as any);

      // Mock payment method breakdown (online)
      const onlineQb = createMockQueryBuilder();
      onlineQb.getRawOne.mockResolvedValue({
        revenue: '300000',
        transactionCount: '3',
      });
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(onlineQb as any);

      // Mock payment method breakdown (cash)
      const cashQb = createMockQueryBuilder();
      cashQb.getRawOne.mockResolvedValue({
        revenue: '200000',
        transactionCount: '2',
      });
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(cashQb as any);

      // Mock service category breakdown
      const categoryQb = createMockQueryBuilder();
      categoryQb.getRawMany.mockResolvedValue([
        { categoryName: 'Consultation', revenue: '300000', serviceCount: '3' },
      ]);
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(categoryQb as any);

      // Mock revenue trend
      const trendQb = createMockQueryBuilder();
      trendQb.getRawMany.mockResolvedValue([
        {
          period: '2026-01-01',
          revenue: '100000',
          transactionCount: '1',
          periodStart: '2026-01-01T00:00:00Z',
          periodEnd: '2026-01-01T23:59:59Z',
        },
      ]);
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(trendQb as any);

      // Mock status breakdown
      const successQb = createMockQueryBuilder();
      successQb.getRawOne.mockResolvedValue({ count: '5', amount: '500000' });
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(successQb as any);

      const pendingQb = createMockQueryBuilder();
      pendingQb.getRawOne.mockResolvedValue({ count: '1', amount: '50000' });
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(pendingQb as any);

      const failedQb = createMockQueryBuilder();
      failedQb.getRawOne.mockResolvedValue({ count: '0', amount: '0' });
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(failedQb as any);

      // Mock top services
      const topServicesQb = createMockQueryBuilder();
      topServicesQb.getRawMany.mockResolvedValue([
        {
          serviceName: 'General Consultation',
          serviceCode: 'GC-001',
          revenue: '200000',
          count: '2',
        },
        {
          serviceName: 'X-Ray',
          serviceCode: 'XR-001',
          revenue: '150000',
          count: '1',
        },
      ]);
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(topServicesQb as any);

      // Act
      const result = await service.getBranchRevenueReport(
        adminId,
        managerId,
        filterDto,
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.branchInfo.managerId).toBe(managerId);
      expect(result.branchInfo.branchName).toBe('Main Branch');
      expect(result.summary.totalRevenue).toBe(500000);
      expect(result.topServices).toHaveLength(2);
      expect(result.topServices[0].serviceName).toBe('General Consultation');
      expect(result.topServices[0].revenue).toBe(200000);

      // Verify limit of 10 for top services
      expect(topServicesQb.limit).toHaveBeenCalledWith(10);
    });

    it('should throw ForbiddenException when managerId does not belong to admin', async () => {
      // Arrange
      const adminId = 'admin-123';
      const managerId = 'manager-from-another-admin';
      const filterDto = createMockFilterDto();
      const admin = createMockAccount({ role: AccountRole.CLINIC_ADMIN });
      const manager = createMockManager({
        _id: managerId,
        parentId: 'another-admin-456', // Different parent
      });

      accountRepository.findOne
        .mockResolvedValueOnce(admin as Account)
        .mockResolvedValueOnce(manager as Account);

      // Act & Assert
      await expect(
        service.getBranchRevenueReport(adminId, managerId, filterDto),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.getBranchRevenueReport(adminId, managerId, filterDto),
      ).rejects.toThrow('You do not have access to this branch');
    });

    it('should throw NotFoundException when managerId does not exist', async () => {
      // Arrange
      const adminId = 'admin-123';
      const managerId = 'non-existent-manager';
      const filterDto = createMockFilterDto();
      const admin = createMockAccount({ role: AccountRole.CLINIC_ADMIN });

      accountRepository.findOne
        .mockResolvedValueOnce(admin as Account)
        .mockResolvedValueOnce(null); // Manager not found

      // Act & Assert
      await expect(
        service.getBranchRevenueReport(adminId, managerId, filterDto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getBranchRevenueReport(adminId, managerId, filterDto),
      ).rejects.toThrow('Manager account not found');
    });

    it('should throw BadRequestException when specified account is not CLINIC_MANAGER', async () => {
      // Arrange
      const adminId = 'admin-123';
      const userId = 'staff-123';
      const filterDto = createMockFilterDto();
      const admin = createMockAccount({ role: AccountRole.CLINIC_ADMIN });
      const staff = createMockAccount({
        _id: userId,
        role: AccountRole.CLINIC_STAFF,
        parentId: adminId,
      });

      accountRepository.findOne
        .mockResolvedValueOnce(admin as Account)
        .mockResolvedValueOnce(staff as Account);

      // Act & Assert
      await expect(
        service.getBranchRevenueReport(adminId, userId, filterDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.getBranchRevenueReport(adminId, userId, filterDto),
      ).rejects.toThrow('Specified account is not a CLINIC_MANAGER');
    });
  });

  // ============================================================================
  // TEST SUITE: validateDateRange
  // ============================================================================

  describe('validateDateRange', () => {
    it('should throw BadRequestException when startDate is after endDate', async () => {
      // Arrange
      const adminId = 'admin-123';
      const filterDto = createMockFilterDto({
        startDate: '2026-03-31',
        endDate: '2026-01-01',
      });
      const admin = createMockAccount({ role: AccountRole.CLINIC_ADMIN });

      accountRepository.findOne.mockResolvedValue(admin as Account);

      // Act & Assert
      await expect(
        service.getOverallRevenueReport(adminId, filterDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.getOverallRevenueReport(adminId, filterDto),
      ).rejects.toThrow('startDate must be before endDate');
    });

    it('should throw BadRequestException when startDate equals endDate', async () => {
      // Arrange
      const adminId = 'admin-123';
      const filterDto = createMockFilterDto({
        startDate: '2026-01-01',
        endDate: '2026-01-01',
      });
      const admin = createMockAccount({ role: AccountRole.CLINIC_ADMIN });

      accountRepository.findOne.mockResolvedValue(admin as Account);

      // Act & Assert
      await expect(
        service.getOverallRevenueReport(adminId, filterDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.getOverallRevenueReport(adminId, filterDto),
      ).rejects.toThrow('startDate must be before endDate');
    });

    it('should throw BadRequestException when date range exceeds 365 days', async () => {
      // Arrange
      const adminId = 'admin-123';
      const filterDto = createMockFilterDto({
        startDate: '2025-01-01',
        endDate: '2026-01-02', // 367 days
      });
      const admin = createMockAccount({ role: AccountRole.CLINIC_ADMIN });

      accountRepository.findOne.mockResolvedValue(admin as Account);

      // Act & Assert
      await expect(
        service.getOverallRevenueReport(adminId, filterDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.getOverallRevenueReport(adminId, filterDto),
      ).rejects.toThrow('Date range cannot exceed 365 days');
    });

    it('should accept date range of exactly 365 days', async () => {
      // Arrange
      const adminId = 'admin-123';
      const filterDto = createMockFilterDto({
        startDate: '2025-01-01',
        endDate: '2026-01-01', // Exactly 365 days
      });
      const admin = createMockAccount({ role: AccountRole.CLINIC_ADMIN });

      accountRepository.findOne.mockResolvedValue(admin as Account);

      const accountQb = createMockQueryBuilder();
      accountQb.getMany.mockResolvedValue([{ _id: 'manager-1' }] as Account[]);
      accountRepository.createQueryBuilder.mockReturnValue(accountQb as any);

      const mockQb = createMockQueryBuilder();
      mockQb.getRawOne.mockResolvedValue({
        totalRevenue: '1000000',
        transactionCount: '10',
        uniquePatients: '5',
      });
      mockQb.getRawMany.mockResolvedValue([]);
      transactionRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      // Act & Assert - Should not throw
      await expect(
        service.getOverallRevenueReport(adminId, filterDto),
      ).resolves.toBeDefined();
    });
  });

  // ============================================================================
  // TEST SUITE: Revenue Calculation - Status Filter
  // ============================================================================

  describe('Revenue Calculation - Status Filter', () => {
    it('should only count SUCCESS transactions in revenue summary', async () => {
      // Arrange
      const adminId = 'admin-123';
      const filterDto = createMockFilterDto();
      const admin = createMockAccount({ role: AccountRole.CLINIC_ADMIN });

      accountRepository.findOne.mockResolvedValue(admin as Account);

      const accountQb = createMockQueryBuilder();
      accountQb.getMany.mockResolvedValue([{ _id: 'manager-1' }] as Account[]);
      accountRepository.createQueryBuilder.mockReturnValue(accountQb as any);

      const summaryQb = createMockQueryBuilder();
      summaryQb.getRawOne.mockResolvedValue({
        totalRevenue: '500000',
        transactionCount: '5',
        uniquePatients: '3',
      });
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(summaryQb as any);

      const mockQb = createMockQueryBuilder();
      mockQb.getRawOne.mockResolvedValue({ revenue: '0', transactionCount: '0' });
      mockQb.getRawMany.mockResolvedValue([]);
      transactionRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      // Act
      await service.getOverallRevenueReport(adminId, filterDto);

      // Assert - verify SUCCESS status filter
      expect(summaryQb.andWhere).toHaveBeenCalledWith('t.status = :status', {
        status: PaymentStatus.SUCCESS,
      });
    });

    it('should only count SUCCESS transactions in payment method breakdown', async () => {
      // Arrange
      const adminId = 'admin-123';
      const filterDto = createMockFilterDto();
      const admin = createMockAccount({ role: AccountRole.CLINIC_ADMIN });

      accountRepository.findOne.mockResolvedValue(admin as Account);

      const accountQb = createMockQueryBuilder();
      accountQb.getMany.mockResolvedValue([{ _id: 'manager-1' }] as Account[]);
      accountRepository.createQueryBuilder.mockReturnValue(accountQb as any);

      const summaryQb = createMockQueryBuilder();
      summaryQb.getRawOne.mockResolvedValue({
        totalRevenue: '1000000',
        transactionCount: '10',
        uniquePatients: '5',
      });
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(summaryQb as any);

      const onlineQb = createMockQueryBuilder();
      onlineQb.getRawOne.mockResolvedValue({
        revenue: '600000',
        transactionCount: '6',
      });
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(onlineQb as any);

      const cashQb = createMockQueryBuilder();
      cashQb.getRawOne.mockResolvedValue({
        revenue: '400000',
        transactionCount: '4',
      });
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(cashQb as any);

      const mockQb = createMockQueryBuilder();
      mockQb.getRawOne.mockResolvedValue({ count: '0', amount: '0' });
      mockQb.getRawMany.mockResolvedValue([]);
      transactionRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      // Act
      await service.getOverallRevenueReport(adminId, filterDto);

      // Assert - verify SUCCESS status filter in both queries
      expect(onlineQb.andWhere).toHaveBeenCalledWith('t.status = :status', {
        status: PaymentStatus.SUCCESS,
      });
      expect(cashQb.andWhere).toHaveBeenCalledWith('t.status = :status', {
        status: PaymentStatus.SUCCESS,
      });
    });

    it('should only count SUCCESS transactions in service category breakdown', async () => {
      // Arrange
      const adminId = 'admin-123';
      const filterDto = createMockFilterDto();
      const admin = createMockAccount({ role: AccountRole.CLINIC_ADMIN });

      accountRepository.findOne.mockResolvedValue(admin as Account);

      const accountQb = createMockQueryBuilder();
      accountQb.getMany.mockResolvedValue([{ _id: 'manager-1' }] as Account[]);
      accountRepository.createQueryBuilder.mockReturnValue(accountQb as any);

      const summaryQb = createMockQueryBuilder();
      summaryQb.getRawOne.mockResolvedValue({
        totalRevenue: '1000000',
        transactionCount: '10',
        uniquePatients: '5',
      });
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(summaryQb as any);

      const onlineQb = createMockQueryBuilder();
      onlineQb.getRawOne.mockResolvedValue({ revenue: '0', transactionCount: '0' });
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(onlineQb as any);

      const cashQb = createMockQueryBuilder();
      cashQb.getRawOne.mockResolvedValue({ revenue: '0', transactionCount: '0' });
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(cashQb as any);

      const categoryQb = createMockQueryBuilder();
      categoryQb.getRawMany.mockResolvedValue([
        { categoryName: 'Consultation', revenue: '500000', serviceCount: '5' },
      ]);
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(categoryQb as any);

      const mockQb = createMockQueryBuilder();
      mockQb.getRawOne.mockResolvedValue({ count: '0', amount: '0' });
      mockQb.getRawMany.mockResolvedValue([]);
      transactionRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      // Act
      await service.getOverallRevenueReport(adminId, filterDto);

      // Assert - verify SUCCESS status filter
      expect(categoryQb.andWhere).toHaveBeenCalledWith('t.status = :status', {
        status: PaymentStatus.SUCCESS,
      });
    });

    it('should include all statuses in status breakdown report', async () => {
      // Arrange
      const adminId = 'admin-123';
      const filterDto = createMockFilterDto();
      const admin = createMockAccount({ role: AccountRole.CLINIC_ADMIN });

      accountRepository.findOne.mockResolvedValue(admin as Account);

      const accountQb = createMockQueryBuilder();
      accountQb.getMany.mockResolvedValue([{ _id: 'manager-1' }] as Account[]);
      accountRepository.createQueryBuilder.mockReturnValue(accountQb as any);

      const summaryQb = createMockQueryBuilder();
      summaryQb.getRawOne.mockResolvedValue({
        totalRevenue: '1000000',
        transactionCount: '10',
        uniquePatients: '5',
      });
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(summaryQb as any);

      const onlineQb = createMockQueryBuilder();
      onlineQb.getRawOne.mockResolvedValue({ revenue: '0', transactionCount: '0' });
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(onlineQb as any);

      const cashQb = createMockQueryBuilder();
      cashQb.getRawOne.mockResolvedValue({ revenue: '0', transactionCount: '0' });
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(cashQb as any);

      const categoryQb = createMockQueryBuilder();
      categoryQb.getRawMany.mockResolvedValue([]);
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(categoryQb as any);

      const trendQb = createMockQueryBuilder();
      trendQb.getRawMany.mockResolvedValue([]);
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(trendQb as any);

      // Status breakdown queries
      const successQb = createMockQueryBuilder();
      successQb.getRawOne.mockResolvedValue({ count: '10', amount: '1000000' });
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(successQb as any);

      const pendingQb = createMockQueryBuilder();
      pendingQb.getRawOne.mockResolvedValue({ count: '5', amount: '500000' });
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(pendingQb as any);

      const failedQb = createMockQueryBuilder();
      failedQb.getRawOne.mockResolvedValue({ count: '2', amount: '100000' });
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(failedQb as any);

      const branchQb = createMockQueryBuilder();
      branchQb.getRawMany.mockResolvedValue([]);
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(branchQb as any);

      // Act
      const result = await service.getOverallRevenueReport(adminId, filterDto);

      // Assert - verify all three statuses are queried separately
      expect(successQb.andWhere).toHaveBeenCalledWith('t.status = :status', {
        status: PaymentStatus.SUCCESS,
      });
      expect(pendingQb.andWhere).toHaveBeenCalledWith('t.status = :status', {
        status: PaymentStatus.PENDING,
      });
      expect(failedQb.andWhere).toHaveBeenCalledWith('t.status = :status', {
        status: PaymentStatus.FAILED,
      });

      // Verify breakdown contains all statuses
      expect(result.statusBreakdown.success).toBeDefined();
      expect(result.statusBreakdown.pending).toBeDefined();
      expect(result.statusBreakdown.failed).toBeDefined();
    });
  });

  // ============================================================================
  // TEST SUITE: Query Builder Joins Verification
  // ============================================================================

  describe('Query Builder Joins', () => {
    it('should use correct join chain for revenue queries', async () => {
      // Arrange
      const adminId = 'admin-123';
      const filterDto = createMockFilterDto();
      const admin = createMockAccount({ role: AccountRole.CLINIC_ADMIN });

      accountRepository.findOne.mockResolvedValue(admin as Account);

      const accountQb = createMockQueryBuilder();
      accountQb.getMany.mockResolvedValue([{ _id: 'manager-1' }] as Account[]);
      accountRepository.createQueryBuilder.mockReturnValue(accountQb as any);

      const summaryQb = createMockQueryBuilder();
      summaryQb.getRawOne.mockResolvedValue({
        totalRevenue: '1000000',
        transactionCount: '10',
        uniquePatients: '5',
      });
      transactionRepository.createQueryBuilder
        .mockReturnValueOnce(summaryQb as any);

      const mockQb = createMockQueryBuilder();
      mockQb.getRawOne.mockResolvedValue({ revenue: '0', transactionCount: '0', count: '0', amount: '0' });
      mockQb.getRawMany.mockResolvedValue([]);
      transactionRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      // Act
      await service.getOverallRevenueReport(adminId, filterDto);

      // Assert - verify correct join chain
      expect(summaryQb.leftJoin).toHaveBeenCalledWith(
        'appointment_package',
        'ap',
        'ap.transaction_id = t._id',
      );
      expect(summaryQb.leftJoin).toHaveBeenCalledWith(
        'appointments',
        'a',
        'a._id = ap.appointment_id',
      );
    });
  });
});
