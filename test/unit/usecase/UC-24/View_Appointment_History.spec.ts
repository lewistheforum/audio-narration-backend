import { NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AppointmentsController } from '../../../../src/modules/appointments/appointments.controller';
import { DoctorPatientHistoryQueryDto } from '../../../../src/modules/appointments/dto/doctor-patient-history-query.dto';
import { AppointmentStatus } from '../../../../src/modules/appointments/enums';
import { AppointmentsService } from '../../../../src/modules/appointments/appointments.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';

describe('UC-24 View Appointment History', () => {
  const createQueryBuilder = (rows: any[]) => ({
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    clone: jest.fn(),
    getRawMany: jest.fn().mockResolvedValue(rows),
  });

  const createServiceContext = (options?: {
    staffAccount?: any;
    patients?: any[];
    totalRows?: any[];
    lastAppointment?: any;
    addresses?: any[];
  }) => {
    const patients = options?.patients ?? [];
    const totalRows = options?.totalRows ?? patients;
    const mainBuilder = createQueryBuilder(patients);
    const totalBuilder = createQueryBuilder(totalRows);
    mainBuilder.clone.mockReturnValue(totalBuilder);

    return {
      accountRepository: {
        findAccountById: jest.fn().mockResolvedValue(
          options?.staffAccount ?? {
            _id: 'staff-1',
            parentId: 'clinic-1',
          },
        ),
      },
      dataSource: {
        getRepository: jest.fn().mockImplementation(() => ({
          createQueryBuilder: jest.fn().mockReturnValue(mainBuilder),
          findOne: jest.fn().mockResolvedValue(options?.lastAppointment ?? null),
        })),
        query: jest.fn().mockResolvedValue(options?.addresses ?? []),
      },
      formatDate: AppointmentsService.prototype['formatDate'],
    } as any;
  };

  it('UT-24-01: View patient history successfully with default sorting.', async () => {
    const appointmentsService = {
      getStaffPatientHistory: jest.fn().mockResolvedValue({ patients: [] }),
    };
    const controller = new AppointmentsController(
      appointmentsService as any,
      {} as any,
      {} as any,
    );
    const query = plainToInstance(DoctorPatientHistoryQueryDto, {
      page: 1,
      limit: 20,
      sort_by: 'last_visit_date',
      order: 'DESC',
    });

    await controller.getStaffPatientHistory({ user: { _id: 'staff-1' } }, query);

    expect(appointmentsService.getStaffPatientHistory).toHaveBeenCalledWith(
      'staff-1',
      query,
    );
  });

  it('UT-24-02: View patient history successfully with search filter.', async () => {
    const appointmentsService = {
      getStaffPatientHistory: jest.fn().mockResolvedValue({ patients: [] }),
    };
    const controller = new AppointmentsController(
      appointmentsService as any,
      {} as any,
      {} as any,
    );
    const query = plainToInstance(DoctorPatientHistoryQueryDto, {
      page: 1,
      limit: 20,
      search: 'John Doe',
      sort_by: 'last_visit_date',
      order: 'DESC',
    });

    await controller.getStaffPatientHistory({ user: { _id: 'staff-1' } }, query);

    expect(appointmentsService.getStaffPatientHistory).toHaveBeenCalledWith(
      'staff-1',
      query,
    );
  });

  it('UT-24-03: View patient history successfully with alternate sorting.', async () => {
    const appointmentsService = {
      getStaffPatientHistory: jest.fn().mockResolvedValue({ patients: [] }),
    };
    const controller = new AppointmentsController(
      appointmentsService as any,
      {} as any,
      {} as any,
    );
    const query = plainToInstance(DoctorPatientHistoryQueryDto, {
      page: 1,
      limit: 20,
      sort_by: 'total_visits',
      order: 'ASC',
    });

    await controller.getStaffPatientHistory({ user: { _id: 'staff-1' } }, query);

    expect(appointmentsService.getStaffPatientHistory).toHaveBeenCalledWith(
      'staff-1',
      query,
    );
  });

  it('UT-24-04: Reject missing or invalid JWT.', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AppointmentsController.prototype.getStaffPatientHistory,
    );

    expect(guards).toHaveLength(2);
  });

  it('UT-24-05: Reject authenticated non-staff role.', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      AppointmentsController.prototype.getStaffPatientHistory,
    );

    expect(roles).toEqual([AccountRole.CLINIC_STAFF]);
  });

  it('UT-24-06: Reject missing staff clinic assignment or invalid query DTO.', async () => {
    const serviceContext = createServiceContext({ staffAccount: { _id: 'staff-1', parentId: null } });

    await expect(
      AppointmentsService.prototype.getStaffPatientHistory.call(serviceContext, 'staff-1', {}),
    ).rejects.toThrow(new NotFoundException('Account not found'));

    const errors = await validate(
      plainToInstance(DoctorPatientHistoryQueryDto, {
        page: 0,
        limit: 0,
        search: 123,
        sort_by: 'INVALID',
        order: 'INVALID',
      }),
    );
    const messages = errors.flatMap((error) => Object.values(error.constraints ?? {}));

    expect(messages).toContain('page must not be less than 1');
    expect(messages).toContain('limit must not be less than 1');
    expect(messages).toContain('search must be a string');
    expect(messages).toContain('sort_by must be one of the following values: last_visit_date, patient_name, total_visits');
    expect(messages).toContain('order must be one of the following values: ASC, DESC');
  });

  it('UT-24-07: Return empty history list.', async () => {
    const serviceContext = createServiceContext();

    const result = await AppointmentsService.prototype.getStaffPatientHistory.call(
      serviceContext,
      'staff-1',
      {},
    );

    expect(result).toEqual({ total: 0, page: 1, limit: 20, patients: [] });
  });

  it('UT-24-08: Return empty page when page exceeds available data.', async () => {
    const serviceContext = createServiceContext({ totalRows: [{ patientId: 'patient-1' }] });

    const result = await AppointmentsService.prototype.getStaffPatientHistory.call(
      serviceContext,
      'staff-1',
      { page: 999, limit: 20 },
    );

    expect(result).toEqual({ total: 1, page: 999, limit: 20, patients: [] });
  });

  it('UT-24-09: Return history successfully when patient age resolves to null.', async () => {
    const serviceContext = createServiceContext({
      patients: [
        {
          patientId: 'patient-1',
          fullName: 'John Doe',
          dateOfBirth: null,
          gender: 'male',
          phone: '0123',
          email: 'john@example.com',
          profilePicture: null,
          firstVisitDate: '2026-03-01',
          lastVisitDate: '2026-03-15',
          totalVisits: '2',
        },
      ],
      totalRows: [{ patientId: 'patient-1' }],
      lastAppointment: null,
      addresses: [],
    });

    const result = await AppointmentsService.prototype.getStaffPatientHistory.call(
      serviceContext,
      'staff-1',
      {},
    );

    expect(result.patients[0]).toMatchObject({
      patientId: 'patient-1',
      age: null,
      lastAppointmentStatus: AppointmentStatus.COMPLETED,
    });
  });
});
