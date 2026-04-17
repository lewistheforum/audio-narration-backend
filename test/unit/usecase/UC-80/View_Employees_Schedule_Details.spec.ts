import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { GetSchedulesDto } from '../../../../src/modules/schedules/dto/get-schedules.dto';
import { SchedulesController } from '../../../../src/modules/schedules/schedules.controller';
import { SchedulesService } from '../../../../src/modules/schedules/schedules.service';

describe('UC-80 View Employees Schedule Details', () => {
  const clinicId = '123e4567-e89b-12d3-a456-426614174000';

  const collectMessages = async (value: object) => {
    const errors = await validate(plainToInstance(GetSchedulesDto, value));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const createServiceContext = (options?: { resolvedClinicId?: string | null; hours?: any[] }) => ({
    resolveClinicId: jest
      .fn()
      .mockResolvedValue(options && 'resolvedClinicId' in options ? options.resolvedClinicId : clinicId),
    scheduleRepository: {
      findScheduleHours: jest.fn().mockResolvedValue(options?.hours ?? [{ _id: 'h1', bookedCount: 1 }]),
    },
    mapSchedules: jest.fn().mockImplementation((rows) => rows),
  } as any);

  it('UT-80-01: Manager views employee schedule detail successfully', async () => {
    const serviceContext = createServiceContext();

    const result = await SchedulesService.prototype.findDoctorScheduleHoursByClinic.call(serviceContext, clinicId, { _id: 'm1', role: AccountRole.CLINIC_MANAGER }, {});

    expect(result).toEqual([{ _id: 'h1', bookedCount: 1 }]);
  });

  it('UT-80-02: Staff filters detailed hours by employee', async () => {
    const serviceContext = createServiceContext();

    await SchedulesService.prototype.findDoctorScheduleHoursByClinic.call(
      serviceContext,
      clinicId,
      { _id: 'st1', role: AccountRole.CLINIC_STAFF },
      { employeeId: '123e4567-e89b-42d3-a456-426614174010' },
    );

    expect(serviceContext.scheduleRepository.findScheduleHours).toHaveBeenCalled();
  });

  it('UT-80-03: Doctor sees only own detailed hours', async () => {
    const serviceContext = createServiceContext();

    await SchedulesService.prototype.findDoctorScheduleHoursByClinic.call(
      serviceContext,
      clinicId,
      { _id: 'doc-1', role: AccountRole.DOCTOR },
      { employeeId: 'other' },
    );

    expect(serviceContext.scheduleRepository.findScheduleHours).toHaveBeenCalledWith(
      clinicId,
      expect.objectContaining({ employeeId: 'doc-1' }),
    );
  });

  it('UT-80-04: Includes slot booked count in hour-level detail', async () => {
    const serviceContext = createServiceContext({ hours: [{ _id: 'h1', bookedCount: 3 }] });

    const result = await SchedulesService.prototype.findDoctorScheduleHoursByClinic.call(serviceContext, clinicId, { _id: 'm1', role: AccountRole.CLINIC_MANAGER }, { date: '2026-01-10' });

    expect(result[0].bookedCount).toBe(3);
  });

  it('UT-80-05: Reject missing JWT', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, SchedulesController);

    expect(guards).toHaveLength(2);
  });

  it('UT-80-06: Reject unauthorized role', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, SchedulesController.prototype.findDoctorScheduleHoursByClinic);

    expect(roles).toEqual([AccountRole.CLINIC_MANAGER, AccountRole.CLINIC_STAFF, AccountRole.DOCTOR]);
  });

  it('UT-80-07: Reject clinic scope mismatch', async () => {
    const serviceContext = createServiceContext({ resolvedClinicId: 'another-clinic' });

    await expect(
      SchedulesService.prototype.findDoctorScheduleHoursByClinic.call(
        serviceContext,
        clinicId,
        { _id: 'st1', role: AccountRole.CLINIC_STAFF },
        {},
      ),
    ).rejects.toThrow(new ForbiddenException('Access denied to this clinic schedules'));
  });

  it('UT-80-08: Reject missing clinicId', async () => {
    const serviceContext = createServiceContext({ resolvedClinicId: null });

    await expect(
      SchedulesService.prototype.findDoctorScheduleHoursByClinic.call(serviceContext, '', { _id: 'm1', role: AccountRole.CLINIC_MANAGER }, {}),
    ).rejects.toThrow(new BadRequestException('Clinic ID is required'));
  });

  it('UT-80-09: Reject invalid uuid/date fields', async () => {
    const messages = await collectMessages({
      date: 'invalid',
      from: 'invalid',
      to: 'invalid',
      employeeId: 'invalid',
      roomId: 'invalid',
      shiftId: 'invalid',
    });

    expect(messages.length).toBeGreaterThan(0);
  });

  it('UT-80-10: Reject mixed invalid filter query', async () => {
    const messages = await collectMessages({
      date: 'bad',
      from: 'bad',
      to: 'bad',
      employeeId: 'bad',
      roomId: 'bad',
      shiftId: 'bad',
    });

    expect(messages.length).toBeGreaterThan(0);
  });

  it('UT-80-11: Boundary month-format date query', async () => {
    const serviceContext = createServiceContext();

    await SchedulesService.prototype.findDoctorScheduleHoursByClinic.call(serviceContext, clinicId, { _id: 'm1', role: AccountRole.CLINIC_MANAGER }, { from: '2026-01-01', to: '2026-01-31' });

    expect(serviceContext.scheduleRepository.findScheduleHours).toHaveBeenCalled();
  });

  it('UT-80-12: Boundary empty detailed schedule result', async () => {
    const serviceContext = createServiceContext({ hours: [] });

    const result = await SchedulesService.prototype.findDoctorScheduleHoursByClinic.call(serviceContext, clinicId, { _id: 'm1', role: AccountRole.CLINIC_MANAGER }, { date: '2026-01-10' });

    expect(result).toEqual([]);
  });
});
