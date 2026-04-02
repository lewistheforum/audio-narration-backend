import { Test, TestingModule } from '@nestjs/testing';
import { StaffPatientsService } from '../../../../src/modules/accounts/api-staff/staff-patients.service';
import { DataSource } from 'typeorm';
import { AccountRepository, GeneralAccountRepository } from '../../../../src/modules/accounts/repositories';
import { MailerService } from '../../../../src/modules/mailer/mailer.service';
import { ZaloWebhookService } from '../../../../src/modules/accounts/zalo-webhook.service';
import { ConflictException } from '@nestjs/common';
import { AccountRole, AccountStatus } from '../../../../src/modules/accounts/enums';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('src/common/utils/date.util', () => ({
  getCurrentTime: jest.fn(() => '2026-03-31T00:00:00.000Z'),
}));

jest.mock('src/common/message', () => ({
  MESSAGES: {
    failMessage: {
      userEmailAlreadyExists: 'EMAIL_EXISTS',
    },
  },
}));

describe('StaffPatientsService', () => {
  const consoleErrorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  let service: StaffPatientsService;
  let dataSource: any;
  let accountRepository: any;
  let generalAccountRepository: any;
  let mailerService: any;
  let zaloWebhookService: any;
  let queryRunner: any;

  const createMockQueryRunner = () => ({
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager: {
      save: jest.fn(),
    },
  });

  beforeEach(async () => {
    queryRunner = createMockQueryRunner();

    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
      createQueryBuilder: jest.fn(),
    };

    accountRepository = {
      findByEmail: jest.fn(),
      findByPhone: jest.fn(),
      createAccount: jest.fn((x: any) => x),
    };

    generalAccountRepository = {
      createGeneralAccount: jest.fn((x: any) => x),
    };

    mailerService = {
      sendAccountNotification: jest.fn(),
    };

    zaloWebhookService = {
      sendFriendRequest: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffPatientsService,
        { provide: DataSource, useValue: dataSource },
        { provide: AccountRepository, useValue: accountRepository },
        { provide: GeneralAccountRepository, useValue: generalAccountRepository },
        { provide: MailerService, useValue: mailerService },
        { provide: ZaloWebhookService, useValue: zaloWebhookService },
      ],
    }).compile();

    service = module.get(StaffPatientsService);

    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy.mockClear();
  });

  describe('createPatientByStaff', () => {
    it('rejects when email already exists', async () => {
      accountRepository.findByEmail.mockResolvedValue({ _id: 'existing' });

      await expect(
        service.createPatientByStaff({
          email: 'p@x.com',
          phone: '0901',
          fullName: 'Patient',
        } as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates patient account and returns credentials when email is sent', async () => {
      accountRepository.findByEmail.mockResolvedValue(null);

      jest
        .spyOn(service as any, 'generateRandomPassword')
        .mockReturnValue('Aa12#xYz89!Q');

      queryRunner.manager.save
        .mockResolvedValueOnce({ _id: 'acc-1', email: 'p@x.com', phone: '0901' })
        .mockResolvedValueOnce({ _id: 'ga-1' });

      mailerService.sendAccountNotification.mockResolvedValue(undefined);

      const result = await service.createPatientByStaff({
        email: 'p@x.com',
        phone: '0901',
        fullName: 'Patient',
      } as any);

      expect(bcrypt.hash).toHaveBeenCalledWith('Aa12#xYz89!Q', 10);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(zaloWebhookService.sendFriendRequest).toHaveBeenCalledWith(
        '0901',
        'Staff Create Patient (With Email)',
      );

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          accountId: 'acc-1',
          email: 'p@x.com',
          phone: '0901',
          fullName: 'Patient',
          temporaryPassword: 'Aa12#xYz89!Q',
          emailSent: true,
          emailSentAt: '2026-03-31T00:00:00.000Z',
          activationStatus: 'ACTIVE',
        }),
      );

      expect(accountRepository.createAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'p@x.com',
          role: AccountRole.PATIENT,
          status: AccountStatus.ACTIVE,
        }),
      );
    });

    it('does not fail when sending email fails (emailSent=false)', async () => {
      accountRepository.findByEmail.mockResolvedValue(null);

      jest
        .spyOn(service as any, 'generateRandomPassword')
        .mockReturnValue('Aa12#xYz89!Q');

      queryRunner.manager.save
        .mockResolvedValueOnce({ _id: 'acc-1', email: 'p@x.com', phone: '0901' })
        .mockResolvedValueOnce({ _id: 'ga-1' });

      mailerService.sendAccountNotification.mockRejectedValue(new Error('smtp'));

      const result = await service.createPatientByStaff({
        email: 'p@x.com',
        phone: '0901',
        fullName: 'Patient',
      } as any);

      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(result.emailSent).toBe(false);
      expect(result.emailSentAt).toBeUndefined();
    });

    it('rolls back transaction when save fails', async () => {
      accountRepository.findByEmail.mockResolvedValue(null);
      jest
        .spyOn(service as any, 'generateRandomPassword')
        .mockReturnValue('Aa12#xYz89!Q');

      queryRunner.manager.save.mockRejectedValue(new Error('db-fail'));

      await expect(
        service.createPatientByStaff({
          email: 'p@x.com',
          phone: '0901',
          fullName: 'Patient',
        } as any),
      ).rejects.toThrow('db-fail');

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('createPatientNoEmail', () => {
    it('rejects when phone already exists', async () => {
      accountRepository.findByPhone.mockResolvedValue({ _id: 'existing' });

      await expect(
        service.createPatientNoEmail({
          phone: '0901',
          fullName: 'Patient',
          dateOfBirth: '1990-01-01',
        } as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates patient with generated email and returns manual credentials', async () => {
      accountRepository.findByPhone.mockResolvedValue(null);

      jest
        .spyOn(service as any, 'generateTempEmail')
        .mockResolvedValue('patient01011990@gmail.com');
      jest
        .spyOn(service as any, 'generateRandomPassword')
        .mockReturnValue('Aa12#xYz89!Q');

      queryRunner.manager.save
        .mockResolvedValueOnce({
          _id: 'acc-1',
          email: 'patient01011990@gmail.com',
          phone: '0901',
        })
        .mockResolvedValueOnce({ _id: 'ga-1' });

      mailerService.sendAccountNotification.mockResolvedValue(undefined);

      const result = await service.createPatientNoEmail({
        phone: '0901',
        fullName: 'Patient',
        dateOfBirth: '1990-01-01',
      } as any);

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          accountId: 'acc-1',
          email: 'patient01011990@gmail.com',
          isTempEmail: true,
          phone: '0901',
          fullName: 'Patient',
          dateOfBirth: '1990-01-01',
          temporaryPassword: 'Aa12#xYz89!Q',
          activationStatus: 'ACTIVE',
        }),
      );

      expect(result.manualLoginInfo).toEqual(
        expect.objectContaining({
          username: 'patient01011990@gmail.com',
          password: 'Aa12#xYz89!Q',
        }),
      );

      expect(zaloWebhookService.sendFriendRequest).toHaveBeenCalledWith(
        '0901',
        'Staff Create Patient (No Email)',
      );
    });

    it('does not fail when temp email notification fails', async () => {
      accountRepository.findByPhone.mockResolvedValue(null);

      jest
        .spyOn(service as any, 'generateTempEmail')
        .mockResolvedValue('patient01011990@gmail.com');
      jest
        .spyOn(service as any, 'generateRandomPassword')
        .mockReturnValue('Aa12#xYz89!Q');

      queryRunner.manager.save
        .mockResolvedValueOnce({
          _id: 'acc-1',
          email: 'patient01011990@gmail.com',
          phone: '0901',
        })
        .mockResolvedValueOnce({ _id: 'ga-1' });

      mailerService.sendAccountNotification.mockRejectedValue(new Error('smtp'));

      const result = await service.createPatientNoEmail({
        phone: '0901',
        fullName: 'Patient',
        dateOfBirth: '1990-01-01',
      } as any);

      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(result.emailSent).toBe(false);
    });

    it('rolls back transaction when save fails', async () => {
      accountRepository.findByPhone.mockResolvedValue(null);
      jest
        .spyOn(service as any, 'generateTempEmail')
        .mockResolvedValue('patient01011990@gmail.com');
      jest
        .spyOn(service as any, 'generateRandomPassword')
        .mockReturnValue('Aa12#xYz89!Q');

      queryRunner.manager.save.mockRejectedValue(new Error('db-fail-2'));

      await expect(
        service.createPatientNoEmail({
          phone: '0901',
          fullName: 'Patient',
          dateOfBirth: '1990-01-01',
        } as any),
      ).rejects.toThrow('db-fail-2');

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('sniper private helpers', () => {
    it('generateRandomPassword returns 12 chars with mixed classes', () => {
      const pwd = (service as any).generateRandomPassword();
      expect(pwd).toHaveLength(12);
      expect(/[A-Z]/.test(pwd)).toBe(true);
      expect(/[a-z]/.test(pwd)).toBe(true);
      expect(/[0-9]/.test(pwd)).toBe(true);
      expect(/[!@#$%^&*]/.test(pwd)).toBe(true);
    });

    it('removeVietnameseTones converts accented text', () => {
      const normalized = (service as any).removeVietnameseTones('Trần Văn Đ');
      expect(normalized).toBe('Tran Van D');
    });

    it('generateTempEmail returns unique base email on first check', async () => {
      accountRepository.findByEmail.mockResolvedValue(null);

      const email = await (service as any).generateTempEmail(
        'Trần Văn D',
        '1988-08-10',
        '0901',
      );

      expect(email).toBe('tranvand10081988@gmail.com');
    });

    it('generateTempEmail appends counter when base email already exists', async () => {
      accountRepository.findByEmail
        .mockResolvedValueOnce({ _id: 'dup' })
        .mockResolvedValueOnce(null);

      const email = await (service as any).generateTempEmail(
        'Trần Văn D',
        '1988-08-10',
        '0901',
      );

      expect(email).toBe('tranvand10081988_01@gmail.com');
    });
  });

  describe('getAllPatientAccounts', () => {
    it('maps raw records to response and formats date of birth', async () => {
      const qb: any = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            accountId: 'acc-1',
            email: 'x@gmail.com',
            phone: '0901',
            status: AccountStatus.ACTIVE,
            fullName: 'A',
            dob: new Date('1990-01-01T00:00:00.000Z'),
            gender: 'MALE',
          },
        ]),
      };

      dataSource.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getAllPatientAccounts();

      expect(result.success).toBe(true);
      expect(result.total).toBe(1);
      expect(result.data[0]).toEqual(
        expect.objectContaining({
          accountId: 'acc-1',
          email: 'x@gmail.com',
          phone: '0901',
          fullName: 'A',
          dateOfBirth: '1990-01-01',
          isActive: true,
          isTempEmail: true,
        }),
      );
    });
  });

  describe('Business Scenario TODO Sweep', () => {
    it.todo(
      'Nghiệp vụ tạo PATIENT có email: bắt buộc unique email và auto-generate mật khẩu tạm an toàn',
    );
    it.todo(
      'Nghiệp vụ tạo PATIENT walk-in: account được kích hoạt ngay để phục vụ khám tại quầy',
    );
    it.todo(
      'Nghiệp vụ gửi email thông báo: thất bại gửi mail không làm hỏng kết quả tạo tài khoản',
    );
    it.todo(
      'Nghiệp vụ tạo PATIENT không email: bắt buộc unique phone và sinh email tạm từ họ tên + ngày sinh',
    );
    it.todo(
      'Nghiệp vụ email tạm: phải có cơ chế chống trùng bằng hậu tố và fallback phone/uuid',
    );
    it.todo(
      'Nghiệp vụ danh sách PATIENT: chuẩn hóa định dạng ngày sinh và đánh dấu tài khoản email tạm',
    );
  });
});
