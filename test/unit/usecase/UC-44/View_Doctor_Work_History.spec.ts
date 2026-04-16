import { NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AppointmentsController } from '../../../../src/modules/appointments/appointments.controller';
import { AppointmentsService } from '../../../../src/modules/appointments/appointments.service';
import { WorkHistoryQueryDto } from '../../../../src/modules/appointments/dto/work-history-query.dto';
import { AppointmentStatus } from '../../../../src/modules/appointments/enums';
import { AccountRole } from '../../../../src/modules/accounts/enums';

describe('UC-44 View Doctor Work History', () => {
  const createQueryBuilder = ({ total = 1, appointments = [{ _id: 'appointment-1' }] } = {}) => {
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(total),
      getMany: jest.fn().mockResolvedValue(appointments),
    };

    return queryBuilder;
  };

  const createServiceContext = ({
    userRole = AccountRole.DOCTOR,
    userId = 'requester-1',
    parentId = 'clinic-admin-1',
    managers = [{ _id: 'manager-2' }],
    total = 1,
    appointments = [{ _id: 'appointment-1' }],
  }: {
    userRole?: AccountRole;
    userId?: string;
    parentId?: string;
    managers?: Array<{ _id: string }>;
    total?: number;
    appointments?: any[];
  } = {}) => {
    const queryBuilder = createQueryBuilder({ total, appointments });

    return {
      queryBuilder,
      serviceContext: {
        accountRepository: {
          findAccountById: jest.fn().mockResolvedValue({
            _id: userId,
            role: userRole,
            parentId,
          }),
          findByParentIdAndRole: jest.fn().mockResolvedValue(managers),
        },
        appointmentRepository: {
          createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
        },
        appointmentPackageRepository: {
          findServicesByAppointmentIds: jest.fn().mockResolvedValue(new Map()),
        },
        employeeScheduleRepository: {
          findClinicRoomsForMultipleAppointments: jest.fn().mockResolvedValue(new Map()),
        },
        transformToResponseDto: jest
          .fn()
          .mockImplementation((appointment: any) => ({ id: appointment._id })),
      } as any,
    };
  };

  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(WorkHistoryQueryDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  it('UT-44-01: View work history successfully as DOCTOR.', async () => {
    const { serviceContext, queryBuilder } = createServiceContext();

    const result = await AppointmentsService.prototype.getDoctorWorkHistory.call(
      serviceContext,
      'doctor-actor-1',
      'doctor-1',
      { page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'DESC' },
    );

    expect(queryBuilder.andWhere).not.toHaveBeenCalledWith('appointment.clinicId = :clinicId', {
      clinicId: 'doctor-actor-1',
    });
    expect(result).toEqual({
      data: [{ id: 'appointment-1' }],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
  });

  it('UT-44-02: View work history successfully as CLINIC_MANAGER.', async () => {
    const { serviceContext, queryBuilder } = createServiceContext({
      userRole: AccountRole.CLINIC_MANAGER,
      userId: 'manager-1',
    });

    const result = await AppointmentsService.prototype.getDoctorWorkHistory.call(
      serviceContext,
      'manager-1',
      'doctor-1',
      {
        page: 1,
        limit: 10,
        fromDate: '2023-01-01',
        toDate: '2023-12-31',
        status: AppointmentStatus.COMPLETED,
      },
    );

    expect(queryBuilder.andWhere).toHaveBeenCalledWith('appointment.clinicId = :clinicId', {
      clinicId: 'manager-1',
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('appointment.appointmentDate >= :fromDate', {
      fromDate: '2023-01-01',
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('appointment.appointmentDate <= :toDate', {
      toDate: '2023-12-31',
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('appointment.status = :status', {
      status: AppointmentStatus.COMPLETED,
    });
    expect(result.total).toBe(1);
  });

  it('UT-44-03: View work history successfully as CLINIC_ADMIN.', async () => {
    const { serviceContext, queryBuilder } = createServiceContext({
      userRole: AccountRole.CLINIC_ADMIN,
      userId: 'admin-1',
      managers: [{ _id: 'manager-1' }, { _id: 'manager-2' }],
    });

    const result = await AppointmentsService.prototype.getDoctorWorkHistory.call(
      serviceContext,
      'admin-1',
      'doctor-1',
      { page: 1, limit: 10 },
    );

    expect(serviceContext.accountRepository.findByParentIdAndRole).toHaveBeenCalledWith(
      'admin-1',
      AccountRole.CLINIC_MANAGER,
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('appointment.clinicId = ANY(:managerIds)', {
      managerIds: ['manager-1', 'manager-2'],
    });
    expect(result.data).toHaveLength(1);
  });

  it('UT-44-04: Reject missing or invalid JWT.', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AppointmentsController.prototype.getDoctorWorkHistory,
    );

    expect(guards).toHaveLength(2);
  });

  it('UT-44-05: Reject unauthorized role.', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      AppointmentsController.prototype.getDoctorWorkHistory,
    );

    expect(roles).toEqual([
      AccountRole.DOCTOR,
      AccountRole.CLINIC_ADMIN,
      AccountRole.CLINIC_MANAGER,
    ]);
  });

  it('UT-44-06: Reject missing requester account.', async () => {
    const { serviceContext } = createServiceContext();
    serviceContext.accountRepository.findAccountById.mockResolvedValue(null);

    await expect(
      AppointmentsService.prototype.getDoctorWorkHistory.call(
        serviceContext,
        'manager-1',
        'doctor-1',
        { page: 1, limit: 10 },
      ),
    ).rejects.toThrow(new NotFoundException('Account not found'));
  });

  it('UT-44-07: Return empty result when no scoped work history exists.', async () => {
    const { serviceContext, queryBuilder } = createServiceContext({
      userRole: AccountRole.CLINIC_ADMIN,
      userId: 'admin-1',
      managers: [],
      total: 0,
      appointments: [],
    });

    const result = await AppointmentsService.prototype.getDoctorWorkHistory.call(
      serviceContext,
      'admin-1',
      'doctor-missing',
      { page: 999, limit: 10 },
    );

    expect(queryBuilder.andWhere).toHaveBeenCalledWith('1 = 0');
    expect(result).toEqual({
      data: [],
      total: 0,
      page: 999,
      limit: 10,
      totalPages: 0,
    });
  });

  it('UT-44-08: Reject invalid query DTO values.', async () => {
    const messages = await collectMessages({
      fromDate: 'not-a-date',
      toDate: 'not-a-date',
      status: 'INVALID',
      page: 0,
      limit: 0,
      sortBy: 'INVALID',
      sortOrder: 'INVALID',
    });
    const pipe = new ParseUUIDPipe();

    expect(messages).toContain('fromDate must be a valid ISO 8601 date string');
    expect(messages).toContain('toDate must be a valid ISO 8601 date string');
    expect(messages).toContain('status must be one of the following values: PENDING, PENDING_DOCTOR, CONFIRMED, CHECKED_IN, IN_PROGRESS, NEED_FINAL_PAYMENT, COMPLETED, CANCELLED, ABSENT');
    expect(messages).toContain('page must not be less than 1');
    expect(messages).toContain('limit must not be less than 1');
    expect(messages).toContain(
      'sortBy must be one of the following values: createdAt, clinicName',
    );
    expect(messages).toContain('sortOrder must be one of the following values: ASC, DESC');
    await expect(pipe.transform('invalid_format_doctor_id', {} as any)).rejects.toThrow(
      'Validation failed (uuid is expected)',
    );
  });
});
