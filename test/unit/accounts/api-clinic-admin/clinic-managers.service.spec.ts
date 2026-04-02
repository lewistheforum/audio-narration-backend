import { Test, TestingModule } from '@nestjs/testing';
import { ClinicManagersService } from '../../../../src/modules/accounts/api-clinic-admin/clinic-managers.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../../../../src/modules/accounts/entities/accounts.entity';
import { BanHistory } from '../../../../src/modules/accounts/entities/ban-history.entity';
import { MailerService } from '../../../../src/modules/mailer/mailer.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AccountStatus } from '../../../../src/modules/accounts/enums/account-status.enum';
import { BanType } from '../../../../src/modules/accounts/enums/ban-type.enum';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('ClinicManagersService', () => {
  let service: ClinicManagersService;
  let accountRepository: any;
  let banHistoryRepository: any;
  let mailerService: any;

  const createManager = (overrides: any = {}) => ({
    _id: 'm1',
    role: AccountRole.CLINIC_MANAGER,
    parentId: 'admin-1',
    email: 'm@c.com',
    username: 'manager',
    clinicManagerInformation: { clinicBranchName: 'B1' },
    banCounts: 0,
    banDescription: null,
    status: AccountStatus.ACTIVE,
    ...overrides,
  });

  const createMockManagerChildrenQb = () => {
    const qb: any = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };
    return qb;
  };

  const createMockUpdateQb = () => {
    const qb: any = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    return qb;
  };

  beforeEach(async () => {
    accountRepository = {
      findOne: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(),
    };

    banHistoryRepository = {
      create: jest.fn((x: any) => x),
      save: jest.fn().mockResolvedValue(undefined),
      find: jest.fn(),
    };

    mailerService = {
      sendAccountBannedEmail: jest.fn().mockResolvedValue(undefined),
      sendAccountWarningEmail: jest.fn().mockResolvedValue(undefined),
      sendAccountUnbannedEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicManagersService,
        { provide: getRepositoryToken(Account), useValue: accountRepository },
        { provide: getRepositoryToken(BanHistory), useValue: banHistoryRepository },
        { provide: MailerService, useValue: mailerService },
      ],
    }).compile();

    service = module.get(ClinicManagersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('banClinicManager', () => {
    it('throws NotFoundException when manager not found', async () => {
      accountRepository.findOne.mockResolvedValue(null);

      await expect(service.banClinicManager('admin-1', 'm1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when manager not owned by admin', async () => {
      accountRepository.findOne.mockResolvedValue(createManager({ parentId: 'other' }));

      await expect(service.banClinicManager('admin-1', 'm1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('bans manager and cascades BAN to children when banCounts reaches 3', async () => {
      const manager = createManager({ banCounts: 2 });
      accountRepository.findOne.mockResolvedValue(manager);

      const childrenQb = createMockManagerChildrenQb();
      childrenQb.getMany.mockResolvedValue([{ _id: 'c1' }, { _id: 'c2' }]);

      const updateQb = createMockUpdateQb();

      accountRepository.createQueryBuilder
        .mockReturnValueOnce(childrenQb)
        .mockReturnValueOnce(updateQb);

      await service.banClinicManager('admin-1', 'm1', 'reason');

      expect(manager.status).toBe(AccountStatus.BAN);
      expect(updateQb.execute).toHaveBeenCalled();
      expect(mailerService.sendAccountBannedEmail).toHaveBeenCalled();
    });

    it('issues warning when banCounts below 3 and does not cascade', async () => {
      const manager = createManager({ banCounts: 0 });
      accountRepository.findOne.mockResolvedValue(manager);

      await service.banClinicManager('admin-1', 'm1', 'reason');

      expect(manager.status).toBe(AccountStatus.ACTIVE);
      expect(mailerService.sendAccountWarningEmail).toHaveBeenCalled();
      expect(accountRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('uses username fallback and default warning description', async () => {
      const manager = createManager({
        clinicManagerInformation: null,
        username: 'manager_u',
        banCounts: 0,
      });
      accountRepository.findOne.mockResolvedValue(manager);

      await service.banClinicManager('admin-1', 'm1');

      expect(mailerService.sendAccountWarningEmail).toHaveBeenCalledWith(
        'm@c.com',
        'manager_u',
        'Violation of clinic policies.',
        1,
      );
      expect(banHistoryRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: BanType.WARNING }),
      );
    });

    it('uses clinic manager fallback name and skips cascade when no children', async () => {
      const manager = createManager({
        clinicManagerInformation: null,
        username: '',
        banCounts: 2,
      });
      accountRepository.findOne.mockResolvedValue(manager);

      const childrenQb = createMockManagerChildrenQb();
      childrenQb.getMany.mockResolvedValue([]);
      accountRepository.createQueryBuilder.mockReturnValueOnce(childrenQb);

      await service.banClinicManager('admin-1', 'm1');

      expect(mailerService.sendAccountBannedEmail).toHaveBeenCalledWith(
        'm@c.com',
        'Clinic Manager',
        'Multiple violations of terms or clinic policies.',
      );
      expect(banHistoryRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: BanType.BANNED }),
      );
      expect(accountRepository.createQueryBuilder).toHaveBeenCalledTimes(1);
    });
  });

  describe('unbanClinicManager', () => {
    it('unbans manager and cascades ACTIVE to children when manager is BAN', async () => {
      const manager = createManager({ status: AccountStatus.BAN, banCounts: 3 });
      accountRepository.findOne.mockResolvedValue(manager);

      const childrenQb = createMockManagerChildrenQb();
      childrenQb.getMany.mockResolvedValue([{ _id: 'c1' }]);

      const updateQb = createMockUpdateQb();

      accountRepository.createQueryBuilder
        .mockReturnValueOnce(childrenQb)
        .mockReturnValueOnce(updateQb);

      await service.unbanClinicManager('admin-1', 'm1');

      expect(manager.status).toBe(AccountStatus.ACTIVE);
      expect(updateQb.execute).toHaveBeenCalled();
      expect(mailerService.sendAccountUnbannedEmail).toHaveBeenCalled();
    });

    it('records unban history even when manager is not BAN', async () => {
      const manager = createManager({ status: AccountStatus.ACTIVE, banCounts: 1 });
      accountRepository.findOne.mockResolvedValue(manager);

      const result = await service.unbanClinicManager('admin-1', 'm1');

      expect(accountRepository.createQueryBuilder).not.toHaveBeenCalled();
      expect(mailerService.sendAccountUnbannedEmail).not.toHaveBeenCalled();
      expect(banHistoryRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: BanType.UNBANNED, banCounts: 0 }),
      );
      expect(result.status).toBe(AccountStatus.ACTIVE);
    });
  });

  describe('getBanHistory', () => {
    it('returns history ordered desc after ownership verification', async () => {
      accountRepository.findOne.mockResolvedValue(createManager());
      banHistoryRepository.find.mockResolvedValue([{ id: 1 }]);

      await expect(service.getBanHistory('admin-1', 'm1')).resolves.toEqual([{ id: 1 }]);
      expect(banHistoryRepository.find).toHaveBeenCalledWith({
        where: { accountId: 'm1' },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('Business Scenario TODO Sweep', () => {
    it.todo(
      'Nghiệp vụ xác thực quản lý: CLINIC_ADMIN chỉ được thao tác với CLINIC_MANAGER thuộc parentId của mình',
    );
    it.todo(
      'Nghiệp vụ cảnh cáo manager: dưới ngưỡng BAN chỉ gửi warning email và vẫn ghi nhận lịch sử',
    );
    it.todo(
      'Nghiệp vụ BAN manager: đạt ngưỡng 3 lần vi phạm thì cascade BAN toàn bộ doctor/staff trực thuộc',
    );
    it.todo(
      'Nghiệp vụ UNBAN manager: chỉ reset trạng thái khi manager đang BAN, không BAN thì vẫn ghi lịch sử UNBANNED',
    );
    it.todo(
      'Nghiệp vụ lịch sử xử lý manager: luôn trả theo thứ tự mới nhất trước sau khi qua bước xác thực quyền',
    );
  });
});
