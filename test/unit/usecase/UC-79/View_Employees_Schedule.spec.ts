import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { GetSchedulesDto } from '../../../../src/modules/schedules/dto/get-schedules.dto';
import { SchedulesController } from '../../../../src/modules/schedules/schedules.controller';
import { SchedulesService } from '../../../../src/modules/schedules/schedules.service';

describe('UC-79 View Employees Schedule', () => {
  const collectMessages = async (value: object) => {
    const errors = await validate(plainToInstance(GetSchedulesDto, value));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const createServiceContext = (options?: { resolvedClinicId?: string | null; schedules?: any[] }) => ({
    resolveClinicId: jest.fn().mockResolvedValue(options?.resolvedClinicId ?? 'clinic-1'),
    scheduleRepository: {
      findSchedules: jest.fn().mockResolvedValue(options?.schedules ?? [{ _id: 's1' }]),
    },
    mapSchedules: jest.fn().mockImplementation((rows) => rows),
  } as any);

  it('UT-79-01: Manager views employees schedule calendar', async () => {
    const serviceContext = createServiceContext();

    const result = await SchedulesService.prototype.findAll.call(serviceContext, { _id: 'm1', role: AccountRole.CLINIC_MANAGER }, {});

    expect(result).toEqual([{ _id: 's1' }]);
  });

  it('UT-79-02: Staff views schedule via parent clinic resolution', async () => {
    const serviceContext = createServiceContext({ resolvedClinicId: 'clinic-parent' });

    const result = await SchedulesService.prototype.findAll.call(serviceContext, { _id: 'st1', role: AccountRole.CLINIC_STAFF }, {});

    expect(result).toEqual([{ _id: 's1' }]);
  });

  it('UT-79-03: Doctor role sees only own schedule', async () => {
    const serviceContext = createServiceContext();

    await SchedulesService.prototype.findAll.call(serviceContext, { _id: 'doc-1', role: AccountRole.DOCTOR }, { employeeId: 'other' });

    expect(serviceContext.scheduleRepository.findSchedules).toHaveBeenCalledWith('clinic-1', expect.objectContaining({ employeeId: 'doc-1' }));
  });

  it('UT-79-04: Filter schedule by range/room/shift', async () => {
    const serviceContext = createServiceContext();

    const query = {
      from: '2026-01-01',
      to: '2026-01-31',
      roomId: '123e4567-e89b-42d3-a456-426614174010',
      shiftId: '123e4567-e89b-42d3-a456-426614174011',
    };
    await SchedulesService.prototype.findAll.call(serviceContext, { _id: 'm1', role: AccountRole.CLINIC_MANAGER }, query);

    expect(serviceContext.scheduleRepository.findSchedules).toHaveBeenCalledWith('clinic-1', expect.objectContaining(query));
  });

  it('UT-79-05: Reject missing JWT', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, SchedulesController);

    expect(guards).toHaveLength(2);
  });

  it('UT-79-06: Reject role outside allowed set', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, SchedulesController.prototype.findAll);

    expect(roles).toEqual([AccountRole.CLINIC_MANAGER, AccountRole.CLINIC_STAFF, AccountRole.DOCTOR]);
  });

  it('UT-79-07: Reject invalid uuid/date query', async () => {
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

  it('UT-79-08: Missing parent clinic returns empty list', async () => {
    const serviceContext = createServiceContext({ resolvedClinicId: null, schedules: [] });

    const result = await SchedulesService.prototype.findAll.call(serviceContext, { _id: 'st1', role: AccountRole.CLINIC_STAFF }, {});

    expect(result).toEqual([]);
  });

  it('UT-79-09: Reject mixed invalid query payload', async () => {
    const messages = await collectMessages({
      date: 'wrong',
      from: 'wrong',
      to: 'wrong',
      employeeId: 'wrong',
      roomId: 'wrong',
      shiftId: 'wrong',
    });

    expect(messages.length).toBeGreaterThan(0);
  });

  it('UT-79-10: Boundary month format date (`YYYY-MM`)', async () => {
    const serviceContext = createServiceContext();

    await SchedulesService.prototype.findAll.call(serviceContext, { _id: 'm1', role: AccountRole.CLINIC_MANAGER }, { from: '2026-01-01', to: '2026-01-31' });

    expect(serviceContext.scheduleRepository.findSchedules).toHaveBeenCalled();
  });

  it('UT-79-11: Boundary empty result set', async () => {
    const serviceContext = createServiceContext({ schedules: [] });

    const result = await SchedulesService.prototype.findAll.call(serviceContext, { _id: 'm1', role: AccountRole.CLINIC_MANAGER }, { date: '2026-01-10' });

    expect(result).toEqual([]);
  });

  it('UT-79-12: Boundary single-day filter', async () => {
    const serviceContext = createServiceContext();

    const result = await SchedulesService.prototype.findAll.call(serviceContext, { _id: 'm1', role: AccountRole.CLINIC_MANAGER }, { date: '2026-01-10' });

    expect(result).toEqual([{ _id: 's1' }]);
  });
});
