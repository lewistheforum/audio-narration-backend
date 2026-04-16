import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { SchedulesController } from '../../../../src/modules/schedules/schedules.controller';
import { SchedulesService } from '../../../../src/modules/schedules/schedules.service';
import { UpdateClinicRoomDto } from '../../../../src/modules/schedules/dto/update-clinic-room.dto';

describe('UC-39.3 Update Room', () => {
  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(UpdateClinicRoomDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  it('UT-39.3-01: Update room name successfully.', async () => {
    const room = { _id: 'room-1', roomName: 'Old Room' };
    const serviceContext = {
      getClinicRoomById: jest.fn().mockResolvedValue(room),
      roomRepository: {
        save: jest.fn().mockImplementation(async (value) => value),
      },
    } as any;

    const result = await SchedulesService.prototype.updateClinicRoom.call(
      serviceContext,
      'room-1',
      { _id: 'manager-1' },
      { roomName: 'Updated Room' },
    );

    expect(result.roomName).toBe('Updated Room');
  });

  it('UT-39.3-02: Submit empty payload successfully as no-op update.', async () => {
    const room = { _id: 'room-1', roomName: 'Existing Room' };
    const serviceContext = {
      getClinicRoomById: jest.fn().mockResolvedValue(room),
      roomRepository: {
        save: jest.fn().mockImplementation(async (value) => value),
      },
    } as any;

    const result = await SchedulesService.prototype.updateClinicRoom.call(
      serviceContext,
      'room-1',
      { _id: 'manager-1' },
      {},
    );

    expect(result.roomName).toBe('Existing Room');
  });

  it('UT-39.3-03: Reject missing or invalid JWT.', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, SchedulesController);

    expect(guards).toHaveLength(2);
  });

  it('UT-39.3-04: Reject authenticated non-manager role.', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, SchedulesController.prototype.updateRoom);

    expect(roles).toEqual([AccountRole.CLINIC_MANAGER]);
  });

  it('UT-39.3-05: Reject unresolved clinic or inaccessible room.', async () => {
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

  it('UT-39.3-06: Accept room name at length 255.', async () => {
    const room = { _id: 'room-1', roomName: 'Old Room' };
    const serviceContext = {
      getClinicRoomById: jest.fn().mockResolvedValue(room),
      roomRepository: {
        save: jest.fn().mockImplementation(async (value) => value),
      },
    } as any;
    const roomName = 'A'.repeat(255);

    const result = await SchedulesService.prototype.updateClinicRoom.call(
      serviceContext,
      'room-1',
      { _id: 'manager-1' },
      { roomName },
    );

    expect(result.roomName).toBe(roomName);
  });

  it('UT-39.3-07: Reject invalid or too-long roomName.', async () => {
    const invalidMessages = await collectMessages({ roomName: 123 });
    const longMessages = await collectMessages({ roomName: 'A'.repeat(256) });

    expect(invalidMessages).toContain('roomName must be a string');
    expect(longMessages).toContain('roomName must be shorter than or equal to 255 characters');
  });
});
