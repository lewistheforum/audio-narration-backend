import { Test, TestingModule } from '@nestjs/testing';
import { ClinicAdminProfileService } from '../../../../src/modules/accounts/api-clinic-admin/clinic-admin-profile.service';
import { AccountsService } from '../../../../src/modules/accounts/accounts.service';
import { ClinicAdminInformationRepository, AccountRepository } from '../../../../src/modules/accounts/repositories';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('ClinicAdminProfileService', () => {
  let service: ClinicAdminProfileService;
  let clinicAdminInfoRepository: {
    findByAccountId: jest.Mock;
    findBySepayVa: jest.Mock;
    findBySepayKey: jest.Mock;
    save: jest.Mock;
  };
  let accountRepository: {
    findAccountById: jest.Mock;
    findByEmail: jest.Mock;
    findByPhone: jest.Mock;
    saveAccount: jest.Mock;
  };
  let accountsService: { getAccountInformationByRole: jest.Mock };

  const createMockAccount = (overrides: any = {}) => ({
    _id: 'admin-1',
    email: 'admin@clinic.com',
    phone: '0900000000',
    ...overrides,
  });

  const createMockProfile = (overrides: any = {}) => ({
    accountId: 'admin-1',
    sepayVa: 'VA-001',
    sepayKey: 'KEY-001',
    clinicName: 'Test Clinic',
    clinicPhone: '0900000000',
    description: 'desc',
    specializedIn: ['A'],
    pros: ['B'],
    paraclinical: ['C'],
    dob: null,
    profilePicture: null,
    bankName: 'VCB',
    bankNumber: '123',
    bankBranch: 'HCM',
    isVerify: false,
    ...overrides,
  });

  beforeEach(async () => {
    clinicAdminInfoRepository = {
      findByAccountId: jest.fn(),
      findBySepayVa: jest.fn(),
      findBySepayKey: jest.fn(),
      save: jest.fn(),
    };

    accountRepository = {
      findAccountById: jest.fn(),
      findByEmail: jest.fn(),
      findByPhone: jest.fn(),
      saveAccount: jest.fn(),
    };

    accountsService = {
      getAccountInformationByRole: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicAdminProfileService,
        { provide: ClinicAdminInformationRepository, useValue: clinicAdminInfoRepository },
        { provide: AccountRepository, useValue: accountRepository },
        { provide: AccountsService, useValue: accountsService },
      ],
    }).compile();

    service = module.get(ClinicAdminProfileService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateOwnProfile', () => {
    it('throws NotFoundException when account not found', async () => {
      accountRepository.findAccountById.mockResolvedValue(null);

      await expect(service.updateOwnProfile('admin-1', {} as any)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws NotFoundException when clinic admin profile not found', async () => {
      accountRepository.findAccountById.mockResolvedValue(createMockAccount());
      clinicAdminInfoRepository.findByAccountId.mockResolvedValue(null);

      await expect(service.updateOwnProfile('admin-1', {} as any)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects email change when email already used by another account', async () => {
      accountRepository.findAccountById.mockResolvedValue(createMockAccount());
      clinicAdminInfoRepository.findByAccountId.mockResolvedValue(createMockProfile());
      accountRepository.findByEmail.mockResolvedValue({ _id: 'someone-else' });

      await expect(
        service.updateOwnProfile('admin-1', { email: 'dup@clinic.com' } as any),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(accountRepository.saveAccount).not.toHaveBeenCalled();
      expect(clinicAdminInfoRepository.save).not.toHaveBeenCalled();
    });

    it('rejects phone change when phone already used', async () => {
      accountRepository.findAccountById.mockResolvedValue(createMockAccount());
      clinicAdminInfoRepository.findByAccountId.mockResolvedValue(createMockProfile());
      accountRepository.findByPhone.mockResolvedValue({ _id: 'someone-else' });

      await expect(
        service.updateOwnProfile('admin-1', { phone: '0911111111' } as any),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(accountRepository.saveAccount).not.toHaveBeenCalled();
      expect(clinicAdminInfoRepository.save).not.toHaveBeenCalled();
    });

    it('rejects sepayVa change when assigned to another clinic', async () => {
      accountRepository.findAccountById.mockResolvedValue(createMockAccount());
      clinicAdminInfoRepository.findByAccountId.mockResolvedValue(createMockProfile());
      clinicAdminInfoRepository.findBySepayVa.mockResolvedValue({ accountId: 'other' });

      await expect(
        service.updateOwnProfile('admin-1', { sepayVa: 'VA-999' } as any),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(accountRepository.saveAccount).not.toHaveBeenCalled();
      expect(clinicAdminInfoRepository.save).not.toHaveBeenCalled();
    });

    it('rejects sepayKey change when already used', async () => {
      accountRepository.findAccountById.mockResolvedValue(createMockAccount());
      clinicAdminInfoRepository.findByAccountId.mockResolvedValue(createMockProfile());
      clinicAdminInfoRepository.findBySepayKey.mockResolvedValue({ accountId: 'other' });

      await expect(
        service.updateOwnProfile('admin-1', { sepayKey: 'KEY-999' } as any),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(accountRepository.saveAccount).not.toHaveBeenCalled();
      expect(clinicAdminInfoRepository.save).not.toHaveBeenCalled();
    });

    it('updates provided fields only and returns updated account info', async () => {
      const account = createMockAccount();
      const profile = createMockProfile();

      accountRepository.findAccountById.mockResolvedValue(account);
      clinicAdminInfoRepository.findByAccountId.mockResolvedValue(profile);

      // uniqueness checks pass
      accountRepository.findByEmail.mockResolvedValue(null);
      accountRepository.findByPhone.mockResolvedValue(null);
      clinicAdminInfoRepository.findBySepayVa.mockResolvedValue(null);
      clinicAdminInfoRepository.findBySepayKey.mockResolvedValue(null);

      accountsService.getAccountInformationByRole.mockResolvedValue({
        _id: 'admin-1',
        email: 'new@clinic.com',
      });

      const result = await service.updateOwnProfile('admin-1', {
        email: 'new@clinic.com',
        clinicName: 'New Clinic',
        dob: '1990-01-01',
      } as any);

      expect(accountRepository.saveAccount).toHaveBeenCalledTimes(1);
      expect(clinicAdminInfoRepository.save).toHaveBeenCalledTimes(1);

      expect(account.email).toBe('new@clinic.com');
      expect(profile.clinicName).toBe('New Clinic');
      expect(profile.dob).toEqual(new Date('1990-01-01'));

      expect(result).toEqual({ _id: 'admin-1', email: 'new@clinic.com' });
    });

    it('updates phone sepayVa sepayKey when values are valid', async () => {
      const account = createMockAccount();
      const profile = createMockProfile();

      accountRepository.findAccountById.mockResolvedValue(account);
      clinicAdminInfoRepository.findByAccountId.mockResolvedValue(profile);
      accountRepository.findByPhone.mockResolvedValue(null);
      clinicAdminInfoRepository.findBySepayVa.mockResolvedValue(null);
      clinicAdminInfoRepository.findBySepayKey.mockResolvedValue(null);
      accountsService.getAccountInformationByRole.mockResolvedValue({ _id: 'admin-1' });

      await service.updateOwnProfile('admin-1', {
        phone: '0911222333',
        sepayVa: 'VA-NEW',
        sepayKey: 'KEY-NEW',
      } as any);

      expect(account.phone).toBe('0911222333');
      expect(profile.sepayVa).toBe('VA-NEW');
      expect(profile.sepayKey).toBe('KEY-NEW');
      expect(accountRepository.saveAccount).toHaveBeenCalledTimes(1);
      expect(clinicAdminInfoRepository.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('getOwnProfile', () => {
    it('returns account information by role', async () => {
      accountsService.getAccountInformationByRole.mockResolvedValue({ ok: true });

      await expect(service.getOwnProfile('admin-1')).resolves.toEqual({ ok: true });
      expect(accountsService.getAccountInformationByRole).toHaveBeenCalledWith('admin-1');
    });
  });

  describe('Business Scenario TODO Sweep', () => {
    it.todo(
      'Nghiệp vụ cập nhật hồ sơ: chỉ cho phép cập nhật khi tồn tại cả account và profile clinic admin',
    );
    it.todo(
      'Nghiệp vụ cập nhật hồ sơ: email và số điện thoại phải giữ tính duy nhất toàn hệ thống khi thay đổi',
    );
    it.todo(
      'Nghiệp vụ cập nhật hồ sơ: sepayVa và sepayKey phải duy nhất giữa các phòng khám',
    );
    it.todo(
      'Nghiệp vụ partial update: chỉ ghi đè các trường được gửi lên, không làm mất dữ liệu còn lại',
    );
    it.todo(
      'Nghiệp vụ xem hồ sơ của chính mình: luôn trả profile theo quyền CLINIC_ADMIN hiện hành',
    );
  });
});
