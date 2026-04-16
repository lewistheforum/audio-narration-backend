import { ConflictException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { SchedulesController } from '../../../../src/modules/schedules/schedules.controller';
import { SchedulesService } from '../../../../src/modules/schedules/schedules.service';
import { UpdateScheduleDto } from '../../../../src/modules/schedules/dto/update-schedule.dto';

describe('UC-82 Update Employees Schedule', () => {
  const scheduleId = '123e4567-e89b-42d3-a456-426614174020';
  const clinicShiftId = '123e4567-e89b-42d3-a456-426614174011';
  const roomId = '123e4567-e89b-42d3-a456-426614174012';
  const employeeId = '123e4567-e89b-42d3-a456-426614174010';

  const collectMessages = async (value: object) => {
    const errors = await validate(plainToInstance(UpdateScheduleDto, value));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const createServiceContext = (options?: {
    schedule?: any;
    existingAppointments?: any[];
    room?: any;
    conflict?: any;
    roomConflict?: any;
  }) => {
    const schedule = options && 'schedule' in options ? options.schedule : { _id: scheduleId, clinicId: 'clinic-1', workDate: new Date('2026-01-10'), clinicShiftId, employeeId, rooms: [{ _id: roomId }] };

    return {
      scheduleRepository: {
        findOne: jest.fn().mockResolvedValue(schedule),
        findConflict: jest.fn().mockResolvedValue(options?.conflict ?? null),
        findRoomConflict: jest.fn().mockResolvedValue(options?.roomConflict ?? null),
        save: jest.fn().mockResolvedValue({}),
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
      roomRepository: {
        findOne: jest.fn().mockResolvedValue(options && 'room' in options ? options.room : { _id: roomId }),
      },
      accountRepository: {
        findOne: jest.fn().mockResolvedValue({ _id: employeeId, role: AccountRole.DOCTOR }),
      },
    } as any;
  };

  it('UT-82-01: Update workDate and weekDay success', async () => {
    const serviceContext = createServiceContext();

    const result = await SchedulesService.prototype.update.call(serviceContext, scheduleId, { workDate: '2026-01-12' });

    expect(result).toEqual({ message: 'Schedule updated successfully' });
  });

  it('UT-82-02: Update room success', async () => {
    const serviceContext = createServiceContext();

    const result = await SchedulesService.prototype.update.call(serviceContext, scheduleId, { roomId });

    expect(result).toEqual({ message: 'Schedule updated successfully' });
  });

  it('UT-82-03: Update employee and shift success', async () => {
    const serviceContext = createServiceContext();

    const result = await SchedulesService.prototype.update.call(serviceContext, scheduleId, {
      employeeId,
      clinicShiftId,
      workDate: '2026-01-12',
    });

    expect(result).toEqual({ message: 'Schedule updated successfully' });
  });

  it('UT-82-04: Partial update single field success', async () => {
    const serviceContext = createServiceContext();

    const result = await SchedulesService.prototype.update.call(serviceContext, scheduleId, { clinicShiftId });

    expect(result).toEqual({ message: 'Schedule updated successfully' });
  });

  it('UT-82-05: Reject missing JWT', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, SchedulesController);

    expect(guards).toHaveLength(2);
  });

  it('UT-82-06: Reject non-manager role', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, SchedulesController.prototype.update);

    expect(roles).toEqual([AccountRole.CLINIC_MANAGER]);
  });

  it('UT-82-07: Reject non-existing schedule', async () => {
    const serviceContext = createServiceContext({ schedule: null });

    await expect(SchedulesService.prototype.update.call(serviceContext, scheduleId, { clinicShiftId })).rejects.toThrow(
      new NotFoundException('Schedule not found'),
    );
  });

  it('UT-82-08: Reject update when active appointments already booked', async () => {
    const serviceContext = createServiceContext({ existingAppointments: [{ _id: 'appt-1' }] });

    await expect(
      SchedulesService.prototype.update.call(serviceContext, scheduleId, { clinicShiftId, workDate: '2026-01-12', employeeId }),
    ).rejects.toThrow(new ConflictException('Cannot modify schedule because patients have already booked appointments.'));
  });

  it('UT-82-09: Reject room not found', async () => {
    const serviceContext = createServiceContext({ room: null });

    await expect(SchedulesService.prototype.update.call(serviceContext, scheduleId, { roomId })).rejects.toThrow(
      new NotFoundException('Clinic Room not found'),
    );
  });

  it('UT-82-10: Reject shift conflict on update', async () => {
    const serviceContext = createServiceContext({ conflict: { _id: 'c1' } });

    await expect(
      SchedulesService.prototype.update.call(serviceContext, scheduleId, { clinicShiftId, workDate: '2026-01-12', employeeId }),
    ).rejects.toThrow(new ConflictException('Update failed: Shift conflict for doctor detected'));
  });

  it('UT-82-11: Reject room occupancy conflict', async () => {
    const serviceContext = createServiceContext({ roomConflict: { _id: 'rc1' } });

    await expect(
      SchedulesService.prototype.update.call(serviceContext, scheduleId, { roomId, clinicShiftId, workDate: '2026-01-12', employeeId }),
    ).rejects.toThrow(new ConflictException('Update failed: Room is already assigned to another doctor for this shift'));
  });

  it('UT-82-12: Boundary empty body no-op update', async () => {
    const serviceContext = createServiceContext();

    const result = await SchedulesService.prototype.update.call(serviceContext, scheduleId, {});

    expect(result).toEqual({ message: 'Schedule updated successfully' });
  });

  it('UT-82-13: Boundary DTO invalid format check', async () => {
    const messages = await collectMessages({
      clinicShiftId: 'invalid',
      workDate: 'invalid',
      roomId: 'invalid',
      employeeId: 'invalid',
    });

    expect(messages.length).toBeGreaterThan(0);
  });
});
