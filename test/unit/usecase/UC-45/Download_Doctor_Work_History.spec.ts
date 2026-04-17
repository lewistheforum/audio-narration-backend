import { NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountRole } from '../../../../src/modules/accounts/enums';
import { AppointmentsController } from '../../../../src/modules/appointments/appointments.controller';
import { AppointmentsService } from '../../../../src/modules/appointments/appointments.service';
import { WorkHistoryQueryDto } from '../../../../src/modules/appointments/dto/work-history-query.dto';
import { AppointmentStatus } from '../../../../src/modules/appointments/enums';

describe('UC-45 Download Doctor Work History', () => {
  const createQueryBuilder = (appointments: any[] = []) => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(appointments),
  });

  const createServiceContext = ({
    userRole = AccountRole.DOCTOR,
    userId = 'requester-1',
    managers = [{ _id: 'manager-2' }],
    appointments = [
      {
        _id: 'appointment-1',
        patient: { username: 'patient.one' },
        clinic: { username: 'clinic.one' },
        appointmentDate: '2026-01-15',
        appointmentHour: '2026-01-15T09:30:00.000Z',
        status: AppointmentStatus.COMPLETED,
        patientNote: 'follow,up',
        total: 500000,
      },
    ],
  }: {
    userRole?: AccountRole;
    userId?: string;
    managers?: Array<{ _id: string }>;
    appointments?: any[];
  } = {}) => {
    const queryBuilder = createQueryBuilder(appointments);

    return {
      queryBuilder,
      serviceContext: {
        accountRepository: {
          findAccountById: jest.fn().mockResolvedValue({ _id: userId, role: userRole }),
          findByParentIdAndRole: jest.fn().mockResolvedValue(managers),
        },
        appointmentRepository: {
          createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
        },
        toVietnamDateString: jest.fn().mockReturnValue('15/01/2026'),
      } as any,
    };
  };

  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(WorkHistoryQueryDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  it('UT-45-01: Export CSV successfully as DOCTOR.', async () => {
    const controllerContext = {
      appointmentsService: {
        exportDoctorWorkHistoryCSV: jest.fn().mockResolvedValue('Appointment ID\nappointment-1'),
      },
    } as any;
    const res = {
      header: jest.fn(),
      attachment: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    } as any;

    await AppointmentsController.prototype.exportDoctorWorkHistoryCSV.call(
      controllerContext,
      { user: { _id: 'doctor-1' } },
      'doctor-1',
      { page: 1, limit: 10 },
      res,
    );

    expect(controllerContext.appointmentsService.exportDoctorWorkHistoryCSV).toHaveBeenCalledWith(
      'doctor-1',
      'doctor-1',
      { page: 1, limit: 10 },
    );
    expect(res.header).toHaveBeenCalledWith('Content-Type', 'text/csv');
    expect(res.attachment.mock.calls[0][0]).toMatch(/^work-history-doctor-1-/);
    expect(res.write).toHaveBeenCalledWith('\uFEFF');
    expect(res.end).toHaveBeenCalledWith('Appointment ID\nappointment-1');
  });

  it('UT-45-02: Export CSV successfully as CLINIC_MANAGER.', async () => {
    const { serviceContext, queryBuilder } = createServiceContext({
      userRole: AccountRole.CLINIC_MANAGER,
      userId: 'manager-1',
    });

    const result = await AppointmentsService.prototype.exportDoctorWorkHistoryCSV.call(
      serviceContext,
      'manager-1',
      'doctor-1',
      {
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
    expect(result).toContain('appointment-1,patient.one,clinic.one,15/01/2026');
    expect(result).toContain('follow up');
  });

  it('UT-45-03: Export CSV successfully as CLINIC_ADMIN.', async () => {
    const { serviceContext, queryBuilder } = createServiceContext({
      userRole: AccountRole.CLINIC_ADMIN,
      userId: 'admin-1',
      managers: [{ _id: 'manager-1' }, { _id: 'manager-2' }],
    });

    const result = await AppointmentsService.prototype.exportDoctorWorkHistoryCSV.call(
      serviceContext,
      'admin-1',
      'doctor-1',
      {},
    );

    expect(serviceContext.accountRepository.findByParentIdAndRole).toHaveBeenCalledWith(
      'admin-1',
      AccountRole.CLINIC_MANAGER,
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('appointment.clinicId = ANY(:managerIds)', {
      managerIds: ['manager-1', 'manager-2'],
    });
    expect(result.startsWith('Appointment ID,Patient,Clinic,Date,Time,Status,Note,Total (VND)')).toBe(true);
  });

  it('UT-45-04: Reject missing or invalid JWT.', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AppointmentsController.prototype.exportDoctorWorkHistoryCSV,
    );

    expect(guards).toHaveLength(2);
  });

  it('UT-45-05: Reject unauthorized role.', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      AppointmentsController.prototype.exportDoctorWorkHistoryCSV,
    );

    expect(roles).toEqual([
      AccountRole.DOCTOR,
      AccountRole.CLINIC_ADMIN,
      AccountRole.CLINIC_MANAGER,
    ]);
  });

  it('UT-45-06: Reject missing requester account.', async () => {
    const { serviceContext } = createServiceContext();
    serviceContext.accountRepository.findAccountById.mockResolvedValue(null);

    await expect(
      AppointmentsService.prototype.exportDoctorWorkHistoryCSV.call(
        serviceContext,
        'manager-1',
        'doctor-1',
        {},
      ),
    ).rejects.toThrow(new NotFoundException('Account not found'));
  });

  it('UT-45-07: Export CSV with headers only when no rows exist.', async () => {
    const { serviceContext, queryBuilder } = createServiceContext({
      userRole: AccountRole.CLINIC_ADMIN,
      userId: 'admin-1',
      managers: [],
      appointments: [],
    });

    const result = await AppointmentsService.prototype.exportDoctorWorkHistoryCSV.call(
      serviceContext,
      'admin-1',
      'doctor-missing',
      {},
    );

    expect(queryBuilder.andWhere).toHaveBeenCalledWith('1 = 0');
    expect(result).toBe('Appointment ID,Patient,Clinic,Date,Time,Status,Note,Total (VND)');
  });

  it('UT-45-08: Reject invalid query DTO values.', async () => {
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
