import { Test, TestingModule } from '@nestjs/testing';
import { ManagedAccountsService } from '../../../../src/modules/accounts/api-clinic-manager/managed-accounts.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../../../../src/modules/accounts/entities/accounts.entity';
import { BanHistory } from '../../../../src/modules/accounts/entities/ban-history.entity';
import { MailerService } from '../../../../src/modules/mailer/mailer.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AccountStatus } from '../../../../src/modules/accounts/enums/account-status.enum';
import { BanType } from '../../../../src/modules/accounts/enums/ban-type.enum';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('ManagedAccountsService', () => {
  let service: ManagedAccountsService;
  let accountRepository: jest.Mocked<Partial<Repository<Account>>> & any;
  let banHistoryRepository: any;
  let mailerService: any;

  const createMockAccount = (overrides: any = {}) => ({
    _id: 'acc-1',
    role: AccountRole.DOCTOR,
    parentId: 'manager-1',
    email: 'a@b.com',
    username: 'u',
    generalAccount: { fullName: 'Name' },
    banCounts: 0,
    banDescription: null,
    status: AccountStatus.ACTIVE,
    ...overrides,
  });

  beforeEach(async () => {
    accountRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
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
        ManagedAccountsService,
        { provide: getRepositoryToken(Account), useValue: accountRepository },
        { provide: getRepositoryToken(BanHistory), useValue: banHistoryRepository },
        { provide: MailerService, useValue: mailerService },
      ],
    }).compile();

    service = module.get(ManagedAccountsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('banAccount', () => {
    it('throws NotFoundException when managed account not found', async () => {
      accountRepository.findOne.mockResolvedValue(null);

      await expect(service.banAccount('manager-1', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when account does not belong to manager', async () => {
      accountRepository.findOne.mockResolvedValue(createMockAccount({ parentId: 'other' }));

      await expect(service.banAccount('manager-1', 'acc-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('bans account when banCounts reaches 3', async () => {
      const account = createMockAccount({ banCounts: 2 });
      accountRepository.findOne.mockResolvedValue(account);
      accountRepository.save.mockResolvedValue({ ...account, banCounts: 3, status: AccountStatus.BAN });

      const res = await service.banAccount('manager-1', 'acc-1', 'reason');

      expect(mailerService.sendAccountBannedEmail).toHaveBeenCalled();
      expect(res.status).toBe(AccountStatus.BAN);
    });

    it('issues warning when banCounts below 3', async () => {
      const account = createMockAccount({ banCounts: 0 });
      accountRepository.findOne.mockResolvedValue(account);
      accountRepository.save.mockResolvedValue({ ...account, banCounts: 1, status: AccountStatus.ACTIVE });

      const res = await service.banAccount('manager-1', 'acc-1', 'reason');

      expect(mailerService.sendAccountWarningEmail).toHaveBeenCalled();
      expect(res.status).toBe(AccountStatus.ACTIVE);
    });

    it('uses username fallback and default warning description', async () => {
      const account = createMockAccount({
        generalAccount: null,
        username: 'doctor_username',
        banCounts: 0,
      });
      accountRepository.findOne.mockResolvedValue(account);
      accountRepository.save.mockResolvedValue({ ...account, banCounts: 1 });

      await service.banAccount('manager-1', 'acc-1');

      expect(mailerService.sendAccountWarningEmail).toHaveBeenCalledWith(
        'a@b.com',
        'doctor_username',
        'Violation of clinic policies.',
        1,
      );
    });

    it('uses account holder fallback and default banned description', async () => {
      const account = createMockAccount({
        generalAccount: null,
        username: '',
        banCounts: 2,
      });
      accountRepository.findOne.mockResolvedValue(account);
      accountRepository.save.mockResolvedValue({
        ...account,
        banCounts: 3,
        status: AccountStatus.BAN,
      });

      await service.banAccount('manager-1', 'acc-1');

      expect(mailerService.sendAccountBannedEmail).toHaveBeenCalledWith(
        'a@b.com',
        'Account Holder',
        'Multiple violations of terms or clinic policies.',
      );
    });
  });

  describe('unbanAccount', () => {
    it('unbans only when status is BAN', async () => {
      const account = createMockAccount({ status: AccountStatus.BAN, banCounts: 3, banDescription: 'x' });
      accountRepository.findOne.mockResolvedValue(account);
      accountRepository.save.mockResolvedValue({ ...account, status: AccountStatus.ACTIVE, banCounts: 0 });

      const res = await service.unbanAccount('manager-1', 'acc-1');

      expect(mailerService.sendAccountUnbannedEmail).toHaveBeenCalled();
      expect(res.status).toBe(AccountStatus.ACTIVE);
    });

    it('keeps status when account is not BAN and still records unban history', async () => {
      const account = createMockAccount({ status: AccountStatus.ACTIVE, banCounts: 1 });
      accountRepository.findOne.mockResolvedValue(account);
      accountRepository.save.mockResolvedValue(account);

      const res = await service.unbanAccount('manager-1', 'acc-1');

      expect(mailerService.sendAccountUnbannedEmail).not.toHaveBeenCalled();
      expect(banHistoryRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: BanType.UNBANNED, banCounts: 0 }),
      );
      expect(res.status).toBe(AccountStatus.ACTIVE);
    });
  });

  describe('getBanHistory', () => {
    it('returns ban history ordered desc after ownership verification', async () => {
      accountRepository.findOne.mockResolvedValue(createMockAccount());
      banHistoryRepository.find.mockResolvedValue([{ id: 1 }]);

      await expect(service.getBanHistory('manager-1', 'acc-1')).resolves.toEqual([{ id: 1 }]);
      expect(banHistoryRepository.find).toHaveBeenCalledWith({
        where: { accountId: 'acc-1' },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('Business Scenario TODO Sweep', () => {
    it.todo(
      'Nghiệp vụ phạm vi quản lý: CLINIC_MANAGER chỉ thao tác được lên DOCTOR/CLINIC_STAFF thuộc parentId của mình',
    );
    it.todo(
      'Nghiệp vụ cảnh cáo tài khoản: dưới ngưỡng BAN chỉ gửi warning email và vẫn lưu lịch sử xử lý',
    );
    it.todo(
      'Nghiệp vụ BAN tài khoản: đạt ngưỡng 3 lần vi phạm thì chuyển trạng thái BAN và gửi email bị khóa',
    );
    it.todo(
      'Nghiệp vụ UNBAN tài khoản: chỉ reset khi trạng thái hiện tại là BAN, không BAN thì không gửi email unban',
    );
    it.todo(
      'Nghiệp vụ lịch sử vi phạm: luôn trả mới nhất trước sau khi xác thực ownership',
    );
  });
});
