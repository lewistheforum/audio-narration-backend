// Mock uuid before any imports to bypass ESM incompatibility with Jest
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mocked-uuid-v4-xxxx-xxxx-xxxx-xxxxxxxxxxxx'),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsService } from '../../../../src/modules/appointments/appointments.service';
import { BookingSessionService } from '../../../../src/modules/appointments/booking-session.service';
import { TransactionsService } from '../../../../src/modules/transactions/transactions.service';
import { MailerService } from '../../../../src/modules/mailer/mailer.service';
import { AppointmentRepository, AppointmentPackageRepository } from '../../../../src/modules/appointments/repositories';
import { AccountRepository, ClinicStaffInformationRepository } from '../../../../src/modules/accounts/repositories';
import { EmployeeScheduleRepository } from '../../../../src/modules/schedules/repositories/employee-schedule.repository';
import { DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { REDIS_CLIENT } from '../../../../src/config/redis.config';
import { AccountRole } from '../../../../src/modules/accounts/enums';
import { AppointmentStatus } from '../../../../src/modules/appointments/enums';

/**
 * ============================================================================
 * WORK HISTORY SERVICE UNIT TESTS
 * Test Coverage: getDoctorWorkHistory
 * ============================================================================
 *
 * 1. ✅ Phân Quyền & clinicId Resolution (4 tests)
 * 2. ✅ Filter & Query Logic (4 tests)
 * 3. ✅ Dữ Liệu Trả Về - services + clinicRooms (3 tests)
 * 4. ✅ Phân Trang (2 tests)
 * 5. ✅ Edge Cases (2 tests)
 *
 * @version 1.0
 * @date 03/03/2026
 */

describe('AppointmentsService - getDoctorWorkHistory', () => {
  let appointmentsService: AppointmentsService;

  // ============================================================================
  // MOCK DATA FACTORIES
  // ============================================================================

  const createMockAdmin = (overrides = {}) => ({
    _id: 'admin-uuid',
    role: AccountRole.CLINIC_ADMIN,
    parentId: null,
    username: 'clinic_admin_1',
    email: 'admin@test.com',
    ...overrides,
  });

  const createMockManager = (overrides = {}) => ({
    _id: 'manager-uuid',
    role: AccountRole.CLINIC_MANAGER,
    parentId: 'admin-uuid',
    username: 'clinic_manager_1',
    email: 'manager@test.com',
    ...overrides,
  });

  const createMockAppointment = (overrides = {}) => ({
    _id: 'apt-uuid-1',
    patientId: 'patient-uuid',
    clinicId: 'admin-uuid',
    doctorId: 'doctor-uuid',
    doctorShiftHourId: 'shift-uuid',
    appointmentDate: new Date('2026-02-01'),
    appointmentHour: new Date('2026-02-01T08:00:00'),
    extraHour: null,
    status: AppointmentStatus.COMPLETED,
    total: 300000,
    patientNote: null,
    rejectReason: null,
    isRemider: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    patient: {
      _id: 'patient-uuid',
      username: 'Nguyen Van A',
      email: 'patient@test.com',
      phone: '0901234567',
    },
    clinic: {
      _id: 'admin-uuid',
      username: 'Phong kham XYZ',
    },
    ...overrides,
  });

  // ============================================================================
  // MOCK REPOSITORIES & SERVICES
  // ============================================================================

  let mockAccountRepository: any;
  let mockAppointmentRepository: any;
  let mockAppointmentPackageRepository: any;
  let mockEmployeeScheduleRepository: any;
  let mockQueryBuilder: any;

  // ============================================================================
  // SETUP & TEARDOWN
  // ============================================================================

  beforeEach(async () => {
    // Mock QueryBuilder chain
    mockQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getSql: jest.fn().mockReturnValue('SELECT * FROM appointments ...'),
      getParameters: jest.fn().mockReturnValue({ doctorId: 'doctor-uuid' }),
      getCount: jest.fn().mockResolvedValue(5),
      getMany: jest.fn().mockResolvedValue([createMockAppointment()]),
    };

    mockAppointmentRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    mockAccountRepository = {
      findAccountById: jest.fn(),
      findByParentIdAndRole: jest.fn(),
    };

    mockAppointmentPackageRepository = {
      findServicesByAppointmentIds: jest.fn().mockResolvedValue(new Map()),
    };

    mockEmployeeScheduleRepository = {
      findClinicRoomsForMultipleAppointments: jest.fn().mockResolvedValue(new Map()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        BookingSessionService,
        {
          provide: REDIS_CLIENT,
          useValue: {
            setex: jest.fn().mockResolvedValue('OK'),
            get: jest.fn().mockResolvedValue(null),
            del: jest.fn().mockResolvedValue(1),
            ttl: jest.fn().mockResolvedValue(1500),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(),
            createQueryRunner: jest.fn(),
          },
        },
        {
          provide: AppointmentRepository,
          useValue: mockAppointmentRepository,
        },
        {
          provide: AppointmentPackageRepository,
          useValue: mockAppointmentPackageRepository,
        },
        {
          provide: ClinicStaffInformationRepository,
          useValue: {},
        },
        {
          provide: EmployeeScheduleRepository,
          useValue: mockEmployeeScheduleRepository,
        },
        {
          provide: AccountRepository,
          useValue: mockAccountRepository,
        },
        {
          provide: TransactionsService,
          useValue: {
            createTransaction: jest.fn(),
          },
        },
        {
          provide: MailerService,
          useValue: {
            sendAppointmentReminder: jest.fn(),
            sendMail: jest.fn(),
          },
        },
      ],
    }).compile();

    appointmentsService = module.get<AppointmentsService>(AppointmentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // TEST SUITE 1: PHÂN QUYỀN & clinicId RESOLUTION
  // ============================================================================

  describe('Phân Quyền & clinicId Resolution', () => {
    it('1.1 - CLINIC_ADMIN dùng findByParentIdAndRole để lấy danh sách managerIds', async () => {
      // Arrange
      const adminAccount = createMockAdmin();
      mockAccountRepository.findAccountById.mockResolvedValue(adminAccount);
      mockAccountRepository.findByParentIdAndRole.mockResolvedValue([{ _id: 'manager-1' }, { _id: 'manager-2' }]);

      const queryDto = { page: 1, limit: 10 };

      // Act
      const result = await appointmentsService.getDoctorWorkHistory(
        adminAccount._id,
        'doctor-uuid',
        queryDto as any,
      );

      // Assert
      expect(mockAccountRepository.findAccountById).toHaveBeenCalledWith(adminAccount._id);
      expect(mockAccountRepository.findByParentIdAndRole).toHaveBeenCalledWith(adminAccount._id, AccountRole.CLINIC_MANAGER);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'appointment.clinicId IN (:...managerIds)',
        { managerIds: ['manager-1', 'manager-2'] },
      );
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
    });

    it('1.2 - CLINIC_MANAGER dùng _id của chính mình làm clinicId', async () => {
      // Arrange
      const managerAccount = createMockManager({ parentId: 'admin-uuid' });
      mockAccountRepository.findAccountById.mockResolvedValue(managerAccount);

      const queryDto = { page: 1, limit: 10 };

      // Act
      const result = await appointmentsService.getDoctorWorkHistory(
        managerAccount._id,
        'doctor-uuid',
        queryDto as any,
      );

      // Assert
      // CLINIC_MANAGER → clinicId = managerAccount._id
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'appointment.clinicId = :clinicId',
        { clinicId: managerAccount._id },
      );
      expect(result).toHaveProperty('data');
    });

    it('1.3 - CLINIC_ADMIN không có branch nào → query 1=0', async () => {
      // Arrange
      const adminAccount = createMockAdmin();
      mockAccountRepository.findAccountById.mockResolvedValue(adminAccount);
      mockAccountRepository.findByParentIdAndRole.mockResolvedValue([]); // Không có branch

      const queryDto = { page: 1, limit: 10 };

      // Act
      await appointmentsService.getDoctorWorkHistory(
        adminAccount._id,
        'doctor-uuid',
        queryDto as any,
      );

      // Assert
      // list branch rỗng → filter an toàn 1=0
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('1 = 0');
    });

    it('1.4 - User không tồn tại → NotFoundException', async () => {
      // Arrange
      mockAccountRepository.findAccountById.mockResolvedValue(null);

      const queryDto = { page: 1, limit: 10 };

      // Act & Assert
      await expect(
        appointmentsService.getDoctorWorkHistory(
          'non-existent-user',
          'doctor-uuid',
          queryDto as any,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================================================
  // TEST SUITE 2: FILTER & QUERY LOGIC
  // ============================================================================

  describe('Filter & Query Logic', () => {
    beforeEach(() => {
      mockAccountRepository.findAccountById.mockResolvedValue(createMockAdmin());
      mockAccountRepository.findByParentIdAndRole.mockResolvedValue([{ _id: 'manager-1' }]);
    });

    it('2.1 - Filter bắt buộc theo doctorId', async () => {
      // Arrange
      const doctorId = 'doctor-uuid-123';
      const queryDto = { page: 1, limit: 10 };

      // Act
      await appointmentsService.getDoctorWorkHistory(
        'admin-uuid',
        doctorId,
        queryDto as any,
      );

      // Assert
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'appointment.doctorId = :doctorId',
        { doctorId },
      );
    });

    it('2.2 - Filter theo fromDate và toDate', async () => {
      // Arrange
      const queryDto = {
        page: 1,
        limit: 10,
        fromDate: '2026-02-01',
        toDate: '2026-02-28',
      };

      // Act
      await appointmentsService.getDoctorWorkHistory(
        'admin-uuid',
        'doctor-uuid',
        queryDto as any,
      );

      // Assert
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'appointment.appointmentDate >= :fromDate',
        { fromDate: '2026-02-01' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'appointment.appointmentDate <= :toDate',
        { toDate: '2026-02-28' },
      );
    });

    it('2.3 - Filter theo status', async () => {
      // Arrange
      const queryDto = {
        page: 1,
        limit: 10,
        status: AppointmentStatus.COMPLETED,
      };

      // Act
      await appointmentsService.getDoctorWorkHistory(
        'admin-uuid',
        'doctor-uuid',
        queryDto as any,
      );

      // Assert
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'appointment.status = :status',
        { status: AppointmentStatus.COMPLETED },
      );
    });

    it('2.4 - Không truyền filter → không có clause ngày hay status', async () => {
      // Arrange
      const queryDto = { page: 1, limit: 10 };

      // Act
      await appointmentsService.getDoctorWorkHistory(
        'admin-uuid',
        'doctor-uuid',
        queryDto as any,
      );

      // Assert
      const andWhereCalls = mockQueryBuilder.andWhere.mock.calls.map(
        (call: any[]) => call[0],
      );
      expect(andWhereCalls).not.toContain('appointment.appointmentDate >= :fromDate');
      expect(andWhereCalls).not.toContain('appointment.appointmentDate <= :toDate');
      expect(andWhereCalls).not.toContain('appointment.status = :status');
    });
  });

  // ============================================================================
  // TEST SUITE 3: DỮ LIỆU TRẢ VỀ (services + clinicRooms)
  // ============================================================================

  describe('Dữ Liệu Trả Về (services + clinicRooms)', () => {
    beforeEach(() => {
      mockAccountRepository.findAccountById.mockResolvedValue(createMockAdmin());
      mockAccountRepository.findByParentIdAndRole.mockResolvedValue([{ _id: 'manager-1' }]);
    });

    it('3.1 - Services được populate đúng từ appointment packages', async () => {
      // Arrange
      const mockApt = createMockAppointment({ _id: 'apt-uuid-1' });
      mockQueryBuilder.getMany.mockResolvedValue([mockApt]);
      mockQueryBuilder.getCount.mockResolvedValue(1);

      const mockServicesMap = new Map([
        ['apt-uuid-1', [{ serviceName: 'Khám tổng quát', price: 200000 }]],
      ]);
      mockAppointmentPackageRepository.findServicesByAppointmentIds.mockResolvedValue(mockServicesMap);

      const queryDto = { page: 1, limit: 10 };

      // Act
      const result = await appointmentsService.getDoctorWorkHistory(
        'admin-uuid',
        'doctor-uuid',
        queryDto as any,
      );

      // Assert
      expect(
        mockAppointmentPackageRepository.findServicesByAppointmentIds,
      ).toHaveBeenCalledWith(['apt-uuid-1']);
      expect(result.data[0].services).toEqual([
        { serviceName: 'Khám tổng quát', price: 200000 },
      ]);
    });

    it('3.2 - clinicRooms được populate đúng từ employee schedules', async () => {
      // Arrange
      const mockApt = createMockAppointment({ _id: 'apt-uuid-1' });
      mockQueryBuilder.getMany.mockResolvedValue([mockApt]);
      mockQueryBuilder.getCount.mockResolvedValue(1);

      const mockRoomsMap = new Map([
        ['apt-uuid-1', [{ roomName: 'Phòng 101', floor: 1 }]],
      ]);
      mockEmployeeScheduleRepository.findClinicRoomsForMultipleAppointments.mockResolvedValue(mockRoomsMap);

      const queryDto = { page: 1, limit: 10 };

      // Act
      const result = await appointmentsService.getDoctorWorkHistory(
        'admin-uuid',
        'doctor-uuid',
        queryDto as any,
      );

      // Assert
      expect(
        mockEmployeeScheduleRepository.findClinicRoomsForMultipleAppointments,
      ).toHaveBeenCalledWith([
        expect.objectContaining({ appointmentId: 'apt-uuid-1' }),
      ]);
      expect(result.data[0].clinicRooms).toEqual([{ roomName: 'Phòng 101', floor: 1 }]);
    });

    it('3.3 - Trả về [] khi không có services và clinicRooms', async () => {
      // Arrange
      const mockApt = createMockAppointment({ _id: 'apt-uuid-1' });
      mockQueryBuilder.getMany.mockResolvedValue([mockApt]);
      mockQueryBuilder.getCount.mockResolvedValue(1);

      // Không có data trong Map
      mockAppointmentPackageRepository.findServicesByAppointmentIds.mockResolvedValue(new Map());
      mockEmployeeScheduleRepository.findClinicRoomsForMultipleAppointments.mockResolvedValue(new Map());

      const queryDto = { page: 1, limit: 10 };

      // Act
      const result = await appointmentsService.getDoctorWorkHistory(
        'admin-uuid',
        'doctor-uuid',
        queryDto as any,
      );

      // Assert
      expect(result.data[0].services).toEqual([]);
      expect(result.data[0].clinicRooms).toEqual([]);
    });
  });

  // ============================================================================
  // TEST SUITE 4: PHÂN TRANG
  // ============================================================================

  describe('Phân Trang', () => {
    beforeEach(() => {
      mockAccountRepository.findAccountById.mockResolvedValue(createMockAdmin());
      mockAccountRepository.findByParentIdAndRole.mockResolvedValue([{ _id: 'manager-1' }]);
      mockQueryBuilder.getCount.mockResolvedValue(12);
      mockQueryBuilder.getMany.mockResolvedValue([createMockAppointment()]);
    });

    it('4.1 - Phân trang đúng với page=2, limit=5', async () => {
      // Arrange
      const queryDto = { page: 2, limit: 5 };

      // Act
      const result = await appointmentsService.getDoctorWorkHistory(
        'admin-uuid',
        'doctor-uuid',
        queryDto as any,
      );

      // Assert
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(5); // (2-1) * 5
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(5);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(5);
      expect(result.total).toBe(12);
      expect(result.totalPages).toBe(3); // Math.ceil(12/5)
    });

    it('4.2 - Dùng default page=1, limit=10 khi không truyền', async () => {
      // Arrange
      const queryDto = {}; // Không truyền page/limit

      // Act
      const result = await appointmentsService.getDoctorWorkHistory(
        'admin-uuid',
        'doctor-uuid',
        queryDto as any,
      );

      // Assert
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0); // (1-1) * 10
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });

  // ============================================================================
  // TEST SUITE 5: EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    it('5.1 - Doctor không có appointment nào → trả về data rỗng', async () => {
      // Arrange
      mockAccountRepository.findAccountById.mockResolvedValue(createMockAdmin());
      mockAccountRepository.findByParentIdAndRole.mockResolvedValue([{ _id: 'manager-1' }]);
      mockQueryBuilder.getCount.mockResolvedValue(0);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      const queryDto = { page: 1, limit: 10 };

      // Act
      const result = await appointmentsService.getDoctorWorkHistory(
        'admin-uuid',
        'doctor-uuid',
        queryDto as any,
      );

      // Assert
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);

      // Tránh gọi DB không cần thiết khi không có appointments
      expect(
        mockAppointmentPackageRepository.findServicesByAppointmentIds,
      ).not.toHaveBeenCalled();
      expect(
        mockEmployeeScheduleRepository.findClinicRoomsForMultipleAppointments,
      ).not.toHaveBeenCalled();
    });

    it('5.2 - Doctor thuộc clinic khác → Manager không xem được', async () => {
      // Arrange
      // Manager của clinic-A muốn xem doctor thuộc clinic-B
      const managerClinicA = createMockManager({ parentId: 'clinic-A-admin-uuid' });
      mockAccountRepository.findAccountById.mockResolvedValue(managerClinicA);

      // Giả lập DB không trả về gì khi filter theo clinic-A (doctor chỉ có ở clinic-B)
      mockQueryBuilder.getCount.mockResolvedValue(0);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      const queryDto = { page: 1, limit: 10 };

      // Act
      const result = await appointmentsService.getDoctorWorkHistory(
        managerClinicA._id,
        'doctor-in-clinic-B',
        queryDto as any,
      );

      // Assert
      // clinicId = managerClinicA._id
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'appointment.clinicId = :clinicId',
        { clinicId: managerClinicA._id },
      );
      // Không có kết quả vì doctor thuộc clinic-B
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });
});
