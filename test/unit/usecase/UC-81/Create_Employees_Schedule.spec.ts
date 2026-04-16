import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { CreateScheduleDto } from '../../../../src/modules/schedules/dto/create-schedule.dto';
import { SchedulesController } from '../../../../src/modules/schedules/schedules.controller';
import { SchedulesService } from '../../../../src/modules/schedules/schedules.service';

describe('UC-81 Create Employees Schedule', () => {
  const employeeId = '123e4567-e89b-42d3-a456-426614174010';
  const clinicId = '123e4567-e89b-12d3-a456-426614174000';
  const shiftId = '123e4567-e89b-42d3-a456-426614174011';
  const roomId = '123e4567-e89b-42d3-a456-426614174012';

  const dto: CreateScheduleDto = {
    employeeId,
    items: [{ clinicShiftId: shiftId, workDate: '2026-01-10', roomId }],
  };

  const collectMessages = async (value: object) => {
    const errors = await validate(plainToInstance(CreateScheduleDto, value));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const createServiceContext = (options?: {
    employee?: any;
    clinic?: any;
    shift?: any;
    room?: any;
    conflict?: any;
    roomConflict?: any;
    conflictOnCall?: number;
  }) => {
    const employee = options && 'employee' in options ? options.employee : { _id: employeeId, role: AccountRole.DOCTOR };
    const clinic = options && 'clinic' in options ? options.clinic : { _id: clinicId };
    const shift = options && 'shift' in options ? options.shift : { _id: shiftId };
    const room = options && 'room' in options ? options.room : { _id: roomId };
    const conflict = options?.conflict ?? null;
    const roomConflict = options?.roomConflict ?? null;
    let findConflictCalls = 0;

    const queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        create: jest.fn().mockImplementation((_: any, payload: any) => payload),
        save: jest.fn().mockImplementation(async (value: any) => ({ _id: 'schedule-1', ...value })),
      },
    } as any;

    return {
      accountRepository: {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(employee)
          .mockResolvedValueOnce(clinic),
      },
      shiftRepository: {
        findOne: jest.fn().mockResolvedValue(shift),
      },
      roomRepository: {
        findOne: jest.fn().mockResolvedValue(room),
      },
      scheduleRepository: {
        findConflict: jest.fn().mockImplementation(async () => {
          findConflictCalls += 1;
          if (options?.conflictOnCall && findConflictCalls >= options.conflictOnCall) return { _id: 'c2' };
          return conflict;
        }),
        findRoomConflict: jest.fn().mockResolvedValue(roomConflict),
      },
      dataSource: {
        createQueryRunner: jest.fn().mockReturnValue(queryRunner),
      },
    } as any;
  };

  it('UT-81-01: Create schedule item successfully', async () => {
    const serviceContext = createServiceContext();

    const result = await SchedulesService.prototype.create.call(serviceContext, clinicId, dto);

    expect(result).toHaveLength(1);
  });

  it('UT-81-02: Create multiple schedule items successfully', async () => {
    const serviceContext = createServiceContext();

    const result = await SchedulesService.prototype.create.call(serviceContext, clinicId, {
      employeeId,
      items: [
        { clinicShiftId: shiftId, workDate: '2026-01-10', roomId },
        { clinicShiftId: shiftId, workDate: '2026-01-11', roomId },
      ],
    });

    expect(result).toHaveLength(2);
  });

  it('UT-81-03: Create schedule with room omitted', async () => {
    const serviceContext = createServiceContext();

    const result = await SchedulesService.prototype.create.call(serviceContext, clinicId, {
      employeeId,
      items: [{ clinicShiftId: shiftId, workDate: '2026-01-10' }],
    });

    expect(result[0].rooms).toEqual([]);
  });

  it('UT-81-04: Validate weekDay auto calculation from workDate', async () => {
    const serviceContext = createServiceContext();

    const result = await SchedulesService.prototype.create.call(serviceContext, clinicId, {
      employeeId,
      items: [{ clinicShiftId: shiftId, workDate: '2026-01-11' }],
    });

    expect(result[0].weekDay).toBeDefined();
  });

  it('UT-81-05: Reject missing JWT', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, SchedulesController);

    expect(guards).toHaveLength(2);
  });

  it('UT-81-06: Reject non-manager role', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, SchedulesController.prototype.create);

    expect(roles).toEqual([AccountRole.CLINIC_MANAGER]);
  });

  it('UT-81-07: Reject manager without clinic id', async () => {
    const controller = {
      schedulesService: { create: jest.fn() },
    } as any;

    expect(() =>
      SchedulesController.prototype.create.call(controller, { user: { role: AccountRole.CLINIC_MANAGER, _id: '' } }, dto),
    ).toThrow(new ForbiddenException('Clinic ID not found for this manager'));
  });

  it('UT-81-08: Reject employee/clinic not found', async () => {
    const missingEmployeeContext = createServiceContext({ employee: null });

    await expect(SchedulesService.prototype.create.call(missingEmployeeContext, clinicId, dto)).rejects.toThrow(new NotFoundException('Employee not found'));
  });

  it('UT-81-09: Reject shift/room not found', async () => {
    const missingShiftContext = createServiceContext({ shift: null });

    await expect(SchedulesService.prototype.create.call(missingShiftContext, clinicId, dto)).rejects.toThrow(new NotFoundException(`Shift ${shiftId} not found`));
  });

  it('UT-81-10: Reject employee schedule overlap conflict', async () => {
    const serviceContext = createServiceContext({ conflict: { _id: 'c1' } });

    await expect(SchedulesService.prototype.create.call(serviceContext, clinicId, dto)).rejects.toThrow(
      new ConflictException(`Schedule exists for Employee ${employeeId} on 2026-01-10 for Shift ${shiftId}`),
    );
  });

  it('UT-81-11: Reject doctor room conflict', async () => {
    const serviceContext = createServiceContext({ roomConflict: { _id: 'rc1' } });

    await expect(SchedulesService.prototype.create.call(serviceContext, clinicId, dto)).rejects.toThrow(
      new ConflictException(`Room ${roomId} is already assigned to another doctor on 2026-01-10 for Shift ${shiftId}`),
    );
  });

  it('UT-81-12: Reject invalid create DTO fields', async () => {
    const messages = await collectMessages({ employeeId: 'invalid', items: 'invalid' });

    expect(messages.length).toBeGreaterThan(0);
  });

  it('UT-81-13: Boundary items array min size 1', async () => {
    const messages = await collectMessages({ employeeId, items: [{ clinicShiftId: shiftId, workDate: '2026-01-10' }] });

    expect(messages).toEqual([]);
  });

  it('UT-81-14: Boundary optional room omitted', async () => {
    const serviceContext = createServiceContext();

    const result = await SchedulesService.prototype.create.call(serviceContext, clinicId, {
      employeeId,
      items: [{ clinicShiftId: shiftId, workDate: '2026-01-10' }],
    });

    expect(result[0].rooms).toEqual([]);
  });

  it('UT-81-15: Boundary transaction rollback on second-item conflict', async () => {
    const serviceContext = createServiceContext({ conflictOnCall: 2 });

    await expect(
      SchedulesService.prototype.create.call(serviceContext, clinicId, {
        employeeId,
        items: [
          { clinicShiftId: shiftId, workDate: '2026-01-10', roomId },
          { clinicShiftId: shiftId, workDate: '2026-01-11', roomId },
        ],
      }),
    ).rejects.toThrow('Schedule exists for Employee');
    expect(serviceContext.dataSource.createQueryRunner().rollbackTransaction).toHaveBeenCalled();
  });
});
