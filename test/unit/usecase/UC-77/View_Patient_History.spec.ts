import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AppointmentsController } from '../../../../src/modules/appointments/appointments.controller';
import { DoctorPatientHistoryQueryDto } from '../../../../src/modules/appointments/dto/doctor-patient-history-query.dto';
import { AppointmentsService } from '../../../../src/modules/appointments/appointments.service';

describe('UC-77 View Patient History', () => {
  const doctorId = 'doctor-1';

  const collectMessages = async (value: object) => {
    const errors = await validate(plainToInstance(DoctorPatientHistoryQueryDto, value));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const createQueryBuilder = (rows: any[] = [{ patientId: 'p1', totalVisits: '1', firstVisitDate: '2026-01-01', lastVisitDate: '2026-01-02' }]) => ({
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    clone: jest.fn(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rows),
  });

  const createServiceContext = (rows: any[] = [{ patientId: 'p1', totalVisits: '1', firstVisitDate: '2026-01-01', lastVisitDate: '2026-01-02' }]) => {
    const mainBuilder = createQueryBuilder(rows);
    const totalBuilder = createQueryBuilder(rows);
    (mainBuilder.clone as jest.Mock).mockReturnValue(totalBuilder);

    const appointmentRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mainBuilder),
      findOne: jest.fn().mockResolvedValue({ _id: 'a1', status: 'COMPLETED' }),
    };
    const ermRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ workingDiagnosis: { primary: 'Dx' } }),
      }),
    };

    return {
      dataSource: {
        getRepository: jest.fn().mockImplementation((entity: any) => {
          if (entity?.name === 'Appointment') return appointmentRepo;
          return ermRepo;
        }),
        query: jest
          .fn()
          .mockResolvedValueOnce([{ _id: 'addr-1', address: 'A', ward: 'W', ward_name: 'WN', district: 'D', district_name: 'DN', province: 'P', province_name: 'PN' }]),
      },
      formatDate: AppointmentsService.prototype['formatDate'],
    } as any;
  };

  it('UT-77-01: Get patient history with default query', async () => {
    const serviceContext = createServiceContext([{ patientId: 'p1', fullName: 'John', email: 'e', phone: 'p', totalVisits: '1', firstVisitDate: '2026-01-01', lastVisitDate: '2026-01-02', dateOfBirth: '2000-01-01', gender: 'male', profilePicture: null }]);

    const result = await AppointmentsService.prototype.getDoctorPatientHistory.call(serviceContext, doctorId, {});

    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
  });

  it('UT-77-02: Search history by name/phone/email', async () => {
    const serviceContext = createServiceContext([{ patientId: 'p1', fullName: 'John', email: 'e', phone: 'p', totalVisits: '1', firstVisitDate: '2026-01-01', lastVisitDate: '2026-01-02' }]);

    await AppointmentsService.prototype.getDoctorPatientHistory.call(serviceContext, doctorId, { search: 'John' });

    expect(serviceContext.dataSource.getRepository).toHaveBeenCalled();
  });

  it('UT-77-03: Sort history by patient name/total visits', async () => {
    const serviceContext = createServiceContext([{ patientId: 'p1', fullName: 'John', email: 'e', phone: 'p', totalVisits: '2', firstVisitDate: '2026-01-01', lastVisitDate: '2026-01-02' }]);

    const result = await AppointmentsService.prototype.getDoctorPatientHistory.call(serviceContext, doctorId, { sort_by: 'patient_name', order: 'ASC' } as any);

    expect(result.patients).toHaveLength(1);
  });

  it('UT-77-04: Include last diagnosis when consultation data exists', async () => {
    const serviceContext = createServiceContext([{ patientId: 'p1', fullName: 'John', email: 'e', phone: 'p', totalVisits: '1', firstVisitDate: '2026-01-01', lastVisitDate: '2026-01-02' }]);

    const result = await AppointmentsService.prototype.getDoctorPatientHistory.call(serviceContext, doctorId, {});

    expect(result.patients[0].lastDiagnosis).toBe('Dx');
  });

  it('UT-77-05: Reject missing JWT', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AppointmentsController.prototype.getDoctorPatientHistory);

    expect(guards).toHaveLength(2);
  });

  it('UT-77-06: Reject non-doctor role', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AppointmentsController.prototype.getDoctorPatientHistory);

    expect(roles).toEqual([AccountRole.DOCTOR]);
  });

  it('UT-77-07: Reject invalid sort enum', async () => {
    const messages = await collectMessages({ sort_by: 'invalid', order: 'INVALID' });

    expect(messages.length).toBeGreaterThan(0);
  });

  it('UT-77-08: Reject invalid page/limit lower bound', async () => {
    const messages = await collectMessages({ page: 0, limit: 0 });

    expect(messages.length).toBeGreaterThan(0);
  });

  it('UT-77-09: Reject invalid search type', async () => {
    const messages = await collectMessages({ search: 123 as any });

    expect(messages.length).toBeGreaterThan(0);
  });

  it('UT-77-10: Boundary minimal pagination values', async () => {
    const serviceContext = createServiceContext([{ patientId: 'p1', fullName: 'John', email: 'e', phone: 'p', totalVisits: '1', firstVisitDate: '2026-01-01', lastVisitDate: '2026-01-02' }]);

    const result = await AppointmentsService.prototype.getDoctorPatientHistory.call(serviceContext, doctorId, { page: 1, limit: 1 });

    expect(result.page).toBe(1);
    expect(result.limit).toBe(1);
  });

  it('UT-77-11: Boundary high page returns empty rows', async () => {
    const serviceContext = createServiceContext([]);

    const result = await AppointmentsService.prototype.getDoctorPatientHistory.call(serviceContext, doctorId, { page: 999, limit: 20 });

    expect(result).toEqual({ total: 0, page: 999, limit: 20, patients: [] });
  });

  it('UT-77-12: Boundary empty dataset', async () => {
    const serviceContext = createServiceContext([]);

    const result = await AppointmentsService.prototype.getDoctorPatientHistory.call(serviceContext, doctorId, {});

    expect(result.total).toBe(0);
    expect(result.patients).toEqual([]);
  });
});
