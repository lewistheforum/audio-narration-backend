import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { CreateClinicRoomDto } from '../../../../src/modules/schedules/dto/create-clinic-room.dto';
import { SchedulesController } from '../../../../src/modules/schedules/schedules.controller';
import { SchedulesService } from '../../../../src/modules/schedules/schedules.service';

describe('UC-39.2 Create Room', () => {
  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(CreateClinicRoomDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const createContext = (clinicId: string | null) => ({
    resolveClinicId: jest.fn().mockResolvedValue(clinicId),
    roomRepository: {
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockImplementation(async (value) => ({ _id: 'room-1', ...value })),
    },
  } as any);

  it('UT-39.2-01: Create room successfully with valid name.', async () => {
    const serviceContext = createContext('clinic-1');

    const result = await SchedulesService.prototype.createClinicRoom.call(serviceContext, { _id: 'manager-1' }, { roomName: 'Room 101' });

    expect(result).toMatchObject({ roomName: 'Room 101', clinicId: 'clinic-1' });
  });

  it('UT-39.2-02: Create room successfully with duplicate name under current implementation.', async () => {
    const serviceContext = createContext('clinic-1');

    const result = await SchedulesService.prototype.createClinicRoom.call(serviceContext, { _id: 'manager-1' }, { roomName: 'Room 101' });

    expect(result).toMatchObject({ roomName: 'Room 101', clinicId: 'clinic-1' });
    expect(serviceContext.roomRepository.save).toHaveBeenCalledTimes(1);
  });

  it('UT-39.2-03: Reject missing or invalid JWT.', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, SchedulesController);

    expect(guards).toHaveLength(2);
  });

  it('UT-39.2-04: Reject authenticated non-manager role.', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, SchedulesController.prototype.createRoom);

    expect(roles).toEqual([AccountRole.CLINIC_MANAGER]);
  });

  it('UT-39.2-05: Reject unresolved clinic id.', async () => {
    const serviceContext = createContext(null);

    await expect(
      SchedulesService.prototype.createClinicRoom.call(serviceContext, { _id: 'manager-1' }, { roomName: 'Room 101' }),
    ).rejects.toThrow(new BadRequestException('Clinic ID could not be resolved'));
  });

  it('UT-39.2-06: Accept room name at length 255.', async () => {
    const serviceContext = createContext('clinic-1');
    const roomName = 'A'.repeat(255);

    const result = await SchedulesService.prototype.createClinicRoom.call(serviceContext, { _id: 'manager-1' }, { roomName });

    expect(result).toMatchObject({ roomName, clinicId: 'clinic-1' });
  });

  it('UT-39.2-07: Reject missing empty non-string or too-long roomName.', async () => {
    const missingMessages = await collectMessages({});
    const emptyMessages = await collectMessages({ roomName: '' });
    const longMessages = await collectMessages({ roomName: 'A'.repeat(256) });

    expect(missingMessages).toContain('roomName should not be empty');
    expect(emptyMessages).toContain('roomName should not be empty');
    expect(longMessages).toContain('roomName must be shorter than or equal to 255 characters');
    expect(() => plainToInstance(CreateClinicRoomDto, { roomName: 123 })).not.toThrow();

    const invalidMessages = await collectMessages({ roomName: 123 });
    expect(invalidMessages).toContain('roomName must be a string');
  });
});
