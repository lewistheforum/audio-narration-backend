import { Test, TestingModule } from '@nestjs/testing';
import { PatientsService } from '../../../../src/modules/accounts/api-admin-patients/patients.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Account } from '../../../../src/modules/accounts/entities/accounts.entity';
import { Appointment } from '../../../../src/modules/appointments/entities/appointment.entity';
import { BanHistory } from '../../../../src/modules/accounts/entities/ban-history.entity';
import { MailerService } from '../../../../src/modules/mailer/mailer.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AccountStatus } from '../../../../src/modules/accounts/enums/account-status.enum';
import { NotFoundException } from '@nestjs/common';

describe('PatientsService', () => {
  let service: PatientsService;
  let accountRepository: any;
  let appointmentRepository: any;
  let banHistoryRepository: any;
  let mailerService: any;
  let dataSource: any;

  const createMockQueryRunner = () => ({
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager: {
      save: jest.fn().mockResolvedValue(undefined),
    },
  });

  const createMockAppointmentQb = () => {
    const qb: any = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
    };
    return qb;
  };

  beforeEach(async () => {
    accountRepository = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    appointmentRepository = {
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

    const queryRunner = createMockQueryRunner();
    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientsService,
        { provide: getRepositoryToken(Account), useValue: accountRepository },
        { provide: getRepositoryToken(Appointment), useValue: appointmentRepository },
        { provide: getRepositoryToken(BanHistory), useValue: banHistoryRepository },
        { provide: MailerService, useValue: mailerService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(PatientsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAppointmentStatistics', () => {
    it('throws NotFoundException when patient not found', async () => {
      accountRepository.findOne.mockResolvedValue(null);

      await expect(service.getAppointmentStatistics('p1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('maps statistics with fallbacks for missing names', async () => {
      accountRepository.findOne.mockResolvedValue({ _id: 'p1', role: AccountRole.PATIENT });

      const qb = createMockAppointmentQb();
      qb.getRawMany.mockResolvedValue([
        {
          clinicId: 'c1',
          branchName: null,
          clinicAdminName: null,
          appointmentCount: 2,
          latestAppointmentDate: '2026-01-02',
        },
      ]);
      appointmentRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getAppointmentStatistics('p1');

      expect(result.totalClinics).toBe(1);
      expect(result.details[0]).toEqual({
        clinicId: 'c1',
        branchName: 'Unknown Branch',
        clinicAdminName: 'Unknown Brand',
        appointmentCount: 2,
        latestAppointmentDate: '2026-01-02',
      });
    });

    it('maps statistics with explicit names and numeric conversion', async () => {
      accountRepository.findOne.mockResolvedValue({ _id: 'p1', role: AccountRole.PATIENT });

      const qb = createMockAppointmentQb();
      qb.getRawMany.mockResolvedValue([
        {
          clinicId: 'c2',
          branchName: 'Branch A',
          clinicAdminName: 'Clinic A',
          appointmentCount: '4',
          latestAppointmentDate: '2026-02-01',
        },
      ]);
      appointmentRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getAppointmentStatistics('p1');

      expect(result.totalClinics).toBe(1);
      expect(result.details[0].branchName).toBe('Branch A');
      expect(result.details[0].clinicAdminName).toBe('Clinic A');
      expect(result.details[0].appointmentCount).toBe(4);
    });
  });

  describe('findAll/findOne sniper', () => {
    it('findAll returns paginated mapped patients with search', async () => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([
          [
            {
              _id: 'p1',
              role: AccountRole.PATIENT,
              email: 'p1@x.com',
              phone: '0901',
              status: AccountStatus.ACTIVE,
              generalAccount: { fullName: 'Patient One' },
              address: null,
            },
          ],
          1,
        ]),
      };

      accountRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(2, 10, 'p1');

      expect(qb.andWhere).toHaveBeenCalled();
      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('findOne throws not found for missing patient', async () => {
      accountRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('findOne returns mapped dto when patient exists', async () => {
      accountRepository.findOne.mockResolvedValue({
        _id: 'p1',
        role: AccountRole.PATIENT,
        email: 'p1@x.com',
        phone: '0901',
        status: AccountStatus.ACTIVE,
        generalAccount: { fullName: 'Patient One' },
        address: null,
      });

      const result = await service.findOne('p1');
      expect(result).toBeDefined();
      expect(result.email).toBe('p1@x.com');
    });
  });

  describe('banPatient', () => {
    it('throws NotFoundException when patient not found', async () => {
      accountRepository.findOne.mockResolvedValue(null);

      await expect(service.banPatient('p1', 'x')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('sets BAN status when banCounts reaches 3 and sends banned email', async () => {
      const patient = {
        _id: 'p1',
        role: AccountRole.PATIENT,
        email: 'p@e.com',
        username: 'u',
        generalAccount: { fullName: 'P' },
        banCounts: 2,
        banDescription: null,
        status: AccountStatus.ACTIVE,
      };
      accountRepository.findOne.mockResolvedValue(patient);

      await service.banPatient('p1', 'reason');

      expect(patient.banCounts).toBe(3);
      expect(patient.status).toBe(AccountStatus.BAN);
      expect(mailerService.sendAccountBannedEmail).toHaveBeenCalled();
    });

    it('issues warning when banCounts below 3 and sends warning email', async () => {
      const patient = {
        _id: 'p1',
        role: AccountRole.PATIENT,
        email: 'p@e.com',
        username: 'u',
        generalAccount: { fullName: 'P' },
        banCounts: 0,
        banDescription: null,
        status: AccountStatus.ACTIVE,
      };
      accountRepository.findOne.mockResolvedValue(patient);

      await service.banPatient('p1', 'reason');

      expect(patient.banCounts).toBe(1);
      expect(patient.status).toBe(AccountStatus.ACTIVE);
      expect(mailerService.sendAccountWarningEmail).toHaveBeenCalled();
    });

    it('uses default patient name/description when profile and username are missing', async () => {
      const patient = {
        _id: 'p1',
        role: AccountRole.PATIENT,
        email: 'p@e.com',
        username: '',
        generalAccount: null,
        banCounts: 2,
        banDescription: null,
        status: AccountStatus.ACTIVE,
      };
      accountRepository.findOne.mockResolvedValue(patient);

      await service.banPatient('p1');

      expect(mailerService.sendAccountBannedEmail).toHaveBeenCalledWith(
        'p@e.com',
        'Patient',
        'Multiple violations of terms of service.',
      );
    });
  });

  describe('unbanPatient', () => {
    it('throws NotFoundException when patient not found in unban flow', async () => {
      accountRepository.findOne.mockResolvedValue(null);

      await expect(service.unbanPatient('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('unbans when status is BAN, resets counters, and sends unbanned email', async () => {
      const patient = {
        _id: 'p1',
        role: AccountRole.PATIENT,
        email: 'p@e.com',
        username: 'u',
        generalAccount: { fullName: 'P' },
        banCounts: 3,
        banDescription: 'x',
        status: AccountStatus.BAN,
      };
      accountRepository.findOne.mockResolvedValue(patient);

      const res = await service.unbanPatient('p1');

      expect(patient.status).toBe(AccountStatus.ACTIVE);
      expect(patient.banCounts).toBe(0);
      expect(patient.banDescription).toBeNull();
      expect(mailerService.sendAccountUnbannedEmail).toHaveBeenCalled();
      expect(res).toBeDefined();
    });

    it('does not change status when not BAN', async () => {
      const patient = {
        _id: 'p1',
        role: AccountRole.PATIENT,
        email: 'p@e.com',
        username: 'u',
        generalAccount: { fullName: 'P' },
        banCounts: 1,
        banDescription: 'x',
        status: AccountStatus.ACTIVE,
      };
      accountRepository.findOne.mockResolvedValue(patient);

      await service.unbanPatient('p1');

      expect(mailerService.sendAccountUnbannedEmail).not.toHaveBeenCalled();
    });

    it('uses default patient name when sending unban email', async () => {
      const patient = {
        _id: 'p1',
        role: AccountRole.PATIENT,
        email: 'p@e.com',
        username: '',
        generalAccount: null,
        banCounts: 3,
        banDescription: 'x',
        status: AccountStatus.BAN,
      };
      accountRepository.findOne.mockResolvedValue(patient);

      await service.unbanPatient('p1');

      expect(mailerService.sendAccountUnbannedEmail).toHaveBeenCalledWith(
        'p@e.com',
        'Patient',
      );
    });

    it('rolls back and rethrows when save fails inside unban transaction', async () => {
      const patient = {
        _id: 'p1',
        role: AccountRole.PATIENT,
        email: 'p@e.com',
        username: 'u',
        generalAccount: { fullName: 'P' },
        banCounts: 3,
        banDescription: 'x',
        status: AccountStatus.BAN,
      };
      accountRepository.findOne.mockResolvedValue(patient);

      const qr = dataSource.createQueryRunner();
      qr.manager.save.mockRejectedValueOnce(new Error('save-failed'));

      await expect(service.unbanPatient('p1')).rejects.toThrow('save-failed');
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('getBanHistory', () => {
    it('throws NotFoundException when patient not found', async () => {
      accountRepository.findOne.mockResolvedValue(null);

      await expect(service.getBanHistory('p1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns ban history ordered desc', async () => {
      accountRepository.findOne.mockResolvedValue({ _id: 'p1', role: AccountRole.PATIENT });
      banHistoryRepository.find.mockResolvedValue([{ id: 1 }]);

      await expect(service.getBanHistory('p1')).resolves.toEqual([{ id: 1 }]);
      expect(banHistoryRepository.find).toHaveBeenCalledWith({
        where: { accountId: 'p1' },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('Business Scenario TODO Sweep', () => {
    it.todo(
      'Nghiệp vụ thống kê lịch hẹn: chỉ cho phép PATIENT hợp lệ và nhóm dữ liệu theo clinic/chi nhánh',
    );
    it.todo(
      'Nghiệp vụ thống kê lịch hẹn: fallback tên chi nhánh/thương hiệu khi dữ liệu phụ trợ không đầy đủ',
    );
    it.todo(
      'Nghiệp vụ cảnh cáo bệnh nhân: tăng banCounts và gửi email warning khi chưa đạt ngưỡng cấm',
    );
    it.todo(
      'Nghiệp vụ cấm bệnh nhân: đạt từ 3 lần vi phạm thì chuyển trạng thái BAN và lưu lịch sử xử lý',
    );
    it.todo(
      'Nghiệp vụ gỡ cấm: chỉ reset trạng thái khi tài khoản đang BAN, không BAN thì rollback nhánh xử lý',
    );
    it.todo(
      'Nghiệp vụ lịch sử vi phạm: chỉ truy xuất khi PATIENT tồn tại và phải sắp xếp mới nhất trước',
    );
  });
});
