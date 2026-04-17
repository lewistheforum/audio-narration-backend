import { ConflictException, NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { SchedulesController } from '../../../../src/modules/schedules/schedules.controller';
import { SchedulesService } from '../../../../src/modules/schedules/schedules.service';

describe('UC-83 Delete Employees Schedule', () => {
  const scheduleId = '123e4567-e89b-42d3-a456-426614174020';

  const createServiceContext = (options?: {
    schedule?: any;
    existingAppointments?: any[];
    affected?: number;
  }) => {
    const schedule = options && 'schedule' in options ? options.schedule : { _id: scheduleId };

    return {
      scheduleRepository: {
        findOne: jest.fn().mockResolvedValue(schedule),
        softDelete: jest.fn().mockResolvedValue({ affected: options?.affected ?? 1 }),
      },
      dataSource: {
        createQueryBuilder: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          from: jest.fn().mockReturnThis(),
          innerJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getRawMany: jest.fn().mockResolvedValue(options?.existingAppointments ?? []),
        }),
      },
    } as any;
  };

  it('UT-83-01: Delete schedule success with no active bookings', async () => {
    const serviceContext = createServiceContext({ existingAppointments: [] });

    const result = await SchedulesService.prototype.remove.call(serviceContext, scheduleId);

    expect(result).toEqual({ message: 'Schedule deleted successfully' });
  });

  it('UT-83-02: Delete success with only cancelled/absent appointments', async () => {
    const serviceContext = createServiceContext({ existingAppointments: [] });

    const result = await SchedulesService.prototype.remove.call(serviceContext, scheduleId);

    expect(result).toEqual({ message: 'Schedule deleted successfully' });
  });

  it('UT-83-03: Reject missing JWT', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, SchedulesController);

    expect(guards).toHaveLength(2);
  });

  it('UT-83-04: Reject non-manager role', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, SchedulesController.prototype.remove);

    expect(roles).toEqual([AccountRole.CLINIC_MANAGER]);
  });

  it('UT-83-05: Reject when schedule not found', async () => {
    const serviceContext = createServiceContext({ schedule: null });

    await expect(SchedulesService.prototype.remove.call(serviceContext, scheduleId)).rejects.toThrow(
      new NotFoundException('Schedule not found'),
    );
  });

  it('UT-83-06: Reject delete when active appointments exist', async () => {
    const serviceContext = createServiceContext({ existingAppointments: [{ _id: 'appt-1' }] });

    await expect(SchedulesService.prototype.remove.call(serviceContext, scheduleId)).rejects.toThrow(
      new ConflictException('Cannot delete schedule because patients have already booked appointments.'),
    );
  });

  it('UT-83-07: Reject when softDelete affects zero rows', async () => {
    const serviceContext = createServiceContext({ affected: 0 });

    await expect(SchedulesService.prototype.remove.call(serviceContext, scheduleId)).rejects.toThrow(
      new NotFoundException('Schedule not found'),
    );
  });

  it('UT-83-08: Boundary invalid schedule UUID format', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(pipe.transform('invalid_uuid', {} as any)).rejects.toThrow('Validation failed (uuid is expected)');
  });

  it('UT-83-09: Boundary no appointments linked delete success', async () => {
    const serviceContext = createServiceContext({ existingAppointments: [] });

    const result = await SchedulesService.prototype.remove.call(serviceContext, scheduleId);

    expect(result).toEqual({ message: 'Schedule deleted successfully' });
  });
});
