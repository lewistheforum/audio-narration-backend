import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { SchedulesController } from '../../../../src/modules/schedules/schedules.controller';
import { SchedulesService } from '../../../../src/modules/schedules/schedules.service';

describe('UC-39.4 Delete Room', () => {
  it('UT-39.4-01: Delete room successfully.', async () => {
    const serviceContext = {
      getClinicRoomById: jest.fn().mockResolvedValue({ _id: 'room-1' }),
      roomRepository: {
        softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
      },
    } as any;

    const result = await SchedulesService.prototype.deleteClinicRoom.call(
      serviceContext,
      'room-1',
      { _id: 'manager-1' },
    );

    expect(result).toEqual({ message: 'Clinic room deleted successfully' });
  });

  it('UT-39.4-02: Delete room successfully even with active schedule dependencies.', async () => {
    const serviceContext = {
      getClinicRoomById: jest.fn().mockResolvedValue({ _id: 'room-1', schedules: [{ _id: 'schedule-1' }] }),
      roomRepository: {
        softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
      },
    } as any;

    const result = await SchedulesService.prototype.deleteClinicRoom.call(
      serviceContext,
      'room-1',
      { _id: 'manager-1' },
    );

    expect(result).toEqual({ message: 'Clinic room deleted successfully' });
  });

  it('UT-39.4-03: Reject missing or invalid JWT.', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, SchedulesController);

    expect(guards).toHaveLength(2);
  });

  it('UT-39.4-04: Reject authenticated non-manager role.', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, SchedulesController.prototype.deleteRoom);

    expect(roles).toEqual([AccountRole.CLINIC_MANAGER]);
  });

  it('UT-39.4-05: Reject unresolved clinic or inaccessible room.', async () => {
    const unresolvedContext = {
      resolveClinicId: jest.fn().mockResolvedValue(null),
    } as any;
    const missingRoomContext = {
      resolveClinicId: jest.fn().mockResolvedValue('clinic-1'),
      roomRepository: {
        findOne: jest.fn().mockResolvedValue(null),
      },
    } as any;

    await expect(
      SchedulesService.prototype.getClinicRoomById.call(
        unresolvedContext,
        'invalid_format_room_id',
        { _id: 'manager-1' },
      ),
    ).rejects.toThrow(new BadRequestException('Clinic ID could not be resolved'));
    await expect(
      SchedulesService.prototype.getClinicRoomById.call(
        missingRoomContext,
        'non_existent_room_id',
        { _id: 'manager-1' },
      ),
    ).rejects.toThrow(
      new NotFoundException('Clinic room not found or you do not have permission'),
    );
  });

  it('UT-39.4-06: Reject already-missing room.', async () => {
    const serviceContext = {
      getClinicRoomById: jest.fn().mockRejectedValue(
        new NotFoundException('Clinic room not found or you do not have permission'),
      ),
    } as any;

    await expect(
      SchedulesService.prototype.deleteClinicRoom.call(serviceContext, 'room-missing', {
        _id: 'manager-1',
      }),
    ).rejects.toThrow(
      new NotFoundException('Clinic room not found or you do not have permission'),
    );
  });

  it('UT-39.4-07: Reject soft-delete result with zero affected rows.', async () => {
    const serviceContext = {
      getClinicRoomById: jest.fn().mockResolvedValue({ _id: 'room-1' }),
      roomRepository: {
        softDelete: jest.fn().mockResolvedValue({ affected: 0 }),
      },
    } as any;

    await expect(
      SchedulesService.prototype.deleteClinicRoom.call(serviceContext, 'room-1', {
        _id: 'manager-1',
      }),
    ).rejects.toThrow(new NotFoundException('Failed to delete clinic room'));
  });
});
