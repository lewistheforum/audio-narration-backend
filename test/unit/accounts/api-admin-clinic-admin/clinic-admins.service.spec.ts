import { Test, TestingModule } from '@nestjs/testing';
import { ClinicAdminsService } from '../../../../src/modules/accounts/api-admin-clinic-admin/clinic-admins.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Account } from '../../../../src/modules/accounts/entities/accounts.entity';
import { ClinicSubscription } from '../../../../src/modules/subscriptions/entities/clinic-subscription.entity';
import { ClinicSubscriptionHistory } from '../../../../src/modules/subscriptions/entities/clinic-subscription-history.entity';
import { Transaction } from '../../../../src/modules/transactions/entities/transaction.entity';
import { ClinicServiceConfig } from '../../../../src/modules/service-configs/entities/clinic-service-config.entity';
import { BanHistory } from '../../../../src/modules/accounts/entities/ban-history.entity';
import { Appointment } from '../../../../src/modules/appointments/entities/appointment.entity';
import { Feedback } from '../../../../src/modules/reports/entities/feedback.entity';
import { MailerService } from '../../../../src/modules/mailer/mailer.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AccountStatus } from '../../../../src/modules/accounts/enums/account-status.enum';
import { NotFoundException } from '@nestjs/common';
import { FeedbackType } from '../../../../src/modules/reports/enums/feedback-type.enum';

describe('ClinicAdminsService', () => {
  let service: ClinicAdminsService;
  let accountRepository: any;
  let clinicSubscriptionRepository: any;
  let mailerService: any;
  let dataSource: any;

  const createMockQb = () => {
    const qb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),

      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
    };
    return qb;
  };

  beforeEach(async () => {
    accountRepository = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    clinicSubscriptionRepository = {
      findOne: jest.fn(),
    };

    mailerService = {
      sendClinicAdminBannedEmail: jest.fn().mockResolvedValue(undefined),
      sendClinicAdminWarningEmail: jest.fn().mockResolvedValue(undefined),
      sendClinicAdminUnbannedEmail: jest.fn().mockResolvedValue(undefined),
    };

    const createCascadeUpdateQb = () => ({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 2 }),
    });

    const createGrandChildrenQb = () => ({
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ _id: 'd1' }, { _id: 's1' }]),
    });

    const queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        findOne: jest.fn(),
        find: jest.fn(),
        save: jest.fn().mockResolvedValue(undefined),
        createQueryBuilder: jest
          .fn()
          .mockImplementation(() => createGrandChildrenQb()),
      },
    };

    dataSource = {
      createQueryRunner: jest.fn().mockImplementation(() => {
        queryRunner.manager.createQueryBuilder = jest
          .fn()
          .mockReturnValueOnce(createGrandChildrenQb())
          .mockReturnValueOnce(createCascadeUpdateQb())
          .mockReturnValueOnce(createGrandChildrenQb())
          .mockReturnValueOnce(createCascadeUpdateQb());
        return queryRunner;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicAdminsService,
        { provide: getRepositoryToken(Account), useValue: accountRepository },
        {
          provide: getRepositoryToken(ClinicSubscription),
          useValue: clinicSubscriptionRepository,
        },
        {
          provide: getRepositoryToken(ClinicSubscriptionHistory),
          useValue: {},
        },
        { provide: getRepositoryToken(Transaction), useValue: {} },
        { provide: getRepositoryToken(ClinicServiceConfig), useValue: {} },
        { provide: getRepositoryToken(BanHistory), useValue: {} },
        { provide: getRepositoryToken(Appointment), useValue: {} },
        { provide: getRepositoryToken(Feedback), useValue: {} },
        { provide: MailerService, useValue: mailerService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(ClinicAdminsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns data and total with search filter applied', async () => {
      const qb = createMockQb();
      const accounts = [
        { _id: 'a1', role: AccountRole.CLINIC_ADMIN, clinicAdminInformation: { clinicName: 'C1' } },
      ];
      qb.getManyAndCount.mockResolvedValue([accounts, 1]);
      accountRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(2, 10, 'abc');

      expect(accountRepository.createQueryBuilder).toHaveBeenCalledWith('account');
      expect(qb.where).toHaveBeenCalledWith('account.role = :role', {
        role: AccountRole.CLINIC_ADMIN,
      });
      expect(qb.andWhere).toHaveBeenCalled();
      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(result.total).toBe(1);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBe(1);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when clinic admin not found', async () => {
      accountRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns detail and calculates doctor/staff counts from grandchildren', async () => {
      accountRepository.findOne.mockResolvedValue({
        _id: 'admin-1',
        role: AccountRole.CLINIC_ADMIN,
        clinicAdminInformation: { description: 'd', specializedIn: [], pros: [], paraclinical: [], dob: null, bankName: 'B', sepayVa: 'VA' },
        address: null,
      });

      accountRepository.find.mockResolvedValue([{ _id: 'm1' }, { _id: 'm2' }]);

      const qb = createMockQb();
      qb.getRawMany.mockResolvedValue([
        { role: 'DOCTOR', count: '3' },
        { role: 'CLINIC_STAFF', count: '5' },
      ]);
      accountRepository.createQueryBuilder.mockReturnValue(qb);

      clinicSubscriptionRepository.findOne.mockResolvedValue({
        service: { serviceName: 'S1' },
        subscriptionDate: new Date('2026-01-01'),
        expirationDate: new Date('2026-02-01'),
        subscriptionStatus: 'ACTIVE',
      });

      const result = await service.findOne('admin-1');

      expect(result.clinicManagerCount).toBe(2);
      expect(result.doctorCount).toBe(3);
      expect(result.staffCount).toBe(5);
      expect(result.subscriptionServiceName).toBe('S1');
    });

    it('maps address and google iframe into detail dto', async () => {
      accountRepository.findOne.mockResolvedValue({
        _id: 'admin-1',
        role: AccountRole.CLINIC_ADMIN,
        clinicAdminInformation: {},
        address: {
          _id: 'addr-1',
          address: '123 Street',
          ward: 'W1',
          district: 'D1',
          province: 'P1',
          wardName: 'Ward 1',
          districtName: 'District 1',
          provinceName: 'Province 1',
          googleIframe: {
            _id: 'g1',
            location: 'HCM',
            googleMapIframe: '<iframe />',
          },
        },
      });
      accountRepository.find.mockResolvedValue([]);
      clinicSubscriptionRepository.findOne.mockResolvedValue(null);

      const result = await service.findOne('admin-1');

      expect(result.address.address).toBe('123 Street');
      expect(result.address.googleIframe.location).toBe('HCM');
    });
  });

  describe('sniper extra branches', () => {
    it('getSubscriptionHistory throws when clinic admin not found', async () => {
      accountRepository.findOne.mockResolvedValue(null);

      await expect(
        (service as any).getSubscriptionHistory('missing', 1, 10),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('getSubscriptionHistory maps unknown service fallback', async () => {
      accountRepository.findOne.mockResolvedValue({ _id: 'admin-1', role: AccountRole.CLINIC_ADMIN });

      const historyQb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{
          _id: 'h1',
          service: null,
          subscriptionDate: new Date('2026-01-01'),
          expirationDate: new Date('2026-02-01'),
          subscriptionStatus: 'ACTIVE',
          createdAt: new Date('2026-01-01'),
        }], 1]),
      };
      (service as any).clinicSubscriptionHistoryRepository = {
        createQueryBuilder: jest.fn().mockReturnValue(historyQb),
      };

      const result = await (service as any).getSubscriptionHistory('admin-1', 1, 10);
      expect(result.total).toBe(1);
      expect(result.data[0].serviceName).toBe('Unknown');
    });

    it('getTransactionHistory maps transaction type and fields', async () => {
      accountRepository.findOne.mockResolvedValue({ _id: 'admin-1', role: AccountRole.CLINIC_ADMIN });

      const txQb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{
          id: 'tx1',
          amount: 1000,
          currency: 'VND',
          status: 'SUCCESS',
          transactionDate: new Date('2026-01-01'),
          gateway: 'SEPAY',
          content: 'abc',
          description: 'desc',
          code: 'code',
          transactionType: { name: 'Renewal' },
          createdAt: new Date('2026-01-01'),
        }], 1]),
      };
      (service as any).transactionRepository = {
        createQueryBuilder: jest.fn().mockReturnValue(txQb),
      };

      const result = await (service as any).getTransactionHistory('admin-1', 1, 10);
      expect(result.total).toBe(1);
      expect(result.data[0].transactionTypeName).toBe('Renewal');
    });

    it('getClinicServices returns empty when no managers', async () => {
      accountRepository.findOne.mockResolvedValue({ _id: 'admin-1', role: AccountRole.CLINIC_ADMIN });
      accountRepository.find.mockResolvedValue([]);

      const result = await (service as any).getClinicServices('admin-1', 1, 10);
      expect(result).toEqual({ data: [], total: 0 });
    });

    it('getFeedbacks splits clinic and doctor feedback arrays', async () => {
      accountRepository.findOne.mockResolvedValue({ _id: 'admin-1', role: AccountRole.CLINIC_ADMIN });
      accountRepository.find.mockResolvedValue([{ _id: 'm1' }]);

      const feedbackQb: any = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { id: 'f1', rating: 5, description: 'ok', clinicId: 'm1', type: FeedbackType.CLINIC, createdAt: new Date(), clinicUsername: 'c', clinicName: 'branch', doctorName: null, patientName: null, patientAvatar: null },
          { id: 'f2', rating: 4, description: 'ok2', clinicId: 'm1', type: FeedbackType.DOCTOR, createdAt: new Date(), clinicUsername: 'c', clinicName: 'branch', doctorName: 'Dr A', patientName: 'P', patientAvatar: null },
        ]),
        getCount: jest.fn().mockResolvedValue(2),
      };
      (service as any).feedbackRepository = {
        createQueryBuilder: jest.fn().mockReturnValue(feedbackQb),
      };

      const result = await (service as any).getFeedbacks('admin-1');
      expect(result.total).toBe(2);
      expect(result.data.clinics).toHaveLength(1);
      expect(result.data.doctors).toHaveLength(1);
    });
  });

  describe('heavy transaction sniper: ban/unban clinic admin', () => {
    it('banClinicAdmin warning path (banCounts < 3) commits and sends warning email', async () => {
      const qr = dataSource.createQueryRunner();
      qr.manager.findOne.mockResolvedValue({
        _id: 'admin-2',
        role: AccountRole.CLINIC_ADMIN,
        email: 'warning@clinic.com',
        username: 'warning-admin',
        banCounts: 1,
        banDescription: null,
        status: AccountStatus.ACTIVE,
        clinicAdminInformation: null,
      });
      qr.manager.find.mockResolvedValue([]);
      (service as any).banHistoryRepository = {
        create: jest.fn((x: any) => x),
        save: jest.fn().mockResolvedValue(undefined),
      };

      const result = await service.banClinicAdmin('admin-2', undefined);

      expect(qr.commitTransaction).toHaveBeenCalled();
      expect(mailerService.sendClinicAdminWarningEmail).toHaveBeenCalled();
      expect(mailerService.sendClinicAdminBannedEmail).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('unbanClinicAdmin not found triggers rollback and throws', async () => {
      const qr = dataSource.createQueryRunner();
      qr.manager.findOne.mockResolvedValue(null);

      await expect(service.unbanClinicAdmin('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });

    it('unbanClinicAdmin non-BAN status does rollback branch and still returns dto', async () => {
      const qr = dataSource.createQueryRunner();
      qr.manager.findOne.mockResolvedValue({
        _id: 'admin-3',
        role: AccountRole.CLINIC_ADMIN,
        email: 'active@clinic.com',
        username: 'active-admin',
        banCounts: 1,
        banDescription: 'warn',
        status: AccountStatus.ACTIVE,
        clinicAdminInformation: { clinicName: 'Clinic C' },
      });
      (service as any).banHistoryRepository = {
        create: jest.fn((x: any) => x),
        save: jest.fn().mockResolvedValue(undefined),
      };

      const result = await service.unbanClinicAdmin('admin-3');

      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(mailerService.sendClinicAdminUnbannedEmail).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('banClinicAdmin not found triggers rollback and throws', async () => {
      const qr = dataSource.createQueryRunner();
      qr.manager.findOne.mockResolvedValue(null);

      await expect(service.banClinicAdmin('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });

    it('banClinicAdmin success path with cascade and commit', async () => {
      const qr = dataSource.createQueryRunner();
      qr.manager.findOne.mockResolvedValue({
        _id: 'admin-1',
        role: AccountRole.CLINIC_ADMIN,
        email: 'admin@clinic.com',
        username: 'admin',
        banCounts: 2,
        banDescription: null,
        status: AccountStatus.ACTIVE,
        clinicAdminInformation: { clinicName: 'Clinic A' },
      });
      qr.manager.find.mockResolvedValue([{ _id: 'm1' }]);
      (service as any).banHistoryRepository = {
        create: jest.fn((x: any) => x),
        save: jest.fn().mockResolvedValue(undefined),
      };

      const result = await service.banClinicAdmin('admin-1', 'violation');

      expect(qr.startTransaction).toHaveBeenCalled();
      expect(qr.commitTransaction).toHaveBeenCalled();
      expect(mailerService.sendClinicAdminBannedEmail).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('unbanClinicAdmin rollback+rethrow on manager.find failure', async () => {
      const qr = dataSource.createQueryRunner();
      qr.manager.findOne.mockResolvedValue({
        _id: 'admin-1',
        role: AccountRole.CLINIC_ADMIN,
        email: 'admin@clinic.com',
        username: 'admin',
        banCounts: 3,
        banDescription: 'x',
        status: AccountStatus.BAN,
        clinicAdminInformation: { clinicName: 'Clinic A' },
      });
      qr.manager.find.mockRejectedValue(new Error('cascade-fail'));

      await expect(service.unbanClinicAdmin('admin-1')).rejects.toThrow('cascade-fail');
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('Business Scenario TODO Sweep', () => {
    it.todo(
      'Nghiệp vụ danh sách CLINIC_ADMIN: chỉ hiển thị role CLINIC_ADMIN và hỗ trợ tìm kiếm đa trường',
    );
    it.todo(
      'Nghiệp vụ chi tiết CLINIC_ADMIN: thống kê theo cây Admin -> Manager -> Doctor/Staff và map subscription hiện tại',
    );
    it.todo(
      'Nghiệp vụ dịch vụ chi nhánh: nếu chưa có manager thì trả dữ liệu rỗng thay vì lỗi',
    );
    it.todo(
      'Nghiệp vụ khóa tài khoản: dưới ngưỡng 3 lần vi phạm gửi cảnh báo; từ lần thứ 3 khóa cả hệ thống liên kết',
    );
    it.todo(
      'Nghiệp vụ mở khóa tài khoản: chỉ mở khóa đầy đủ khi trạng thái hiện tại là BAN',
    );
    it.todo(
      'Nghiệp vụ phản hồi đánh giá: tách danh sách feedback theo nhóm CLINIC và DOCTOR',
    );
    it.todo(
      'Nghiệp vụ chi tiết feedback: chỉ trả feedback thuộc đúng clinic manager và phải có thông tin lịch hẹn liên quan',
    );
    it.todo(
      'Nghiệp vụ lịch sử xử lý vi phạm: chỉ truy xuất được khi tài khoản CLINIC_ADMIN tồn tại hợp lệ',
    );
  });
});
