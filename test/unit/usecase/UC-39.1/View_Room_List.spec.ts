import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { SchedulesController } from '../../../../src/modules/schedules/schedules.controller';
import { ClinicRoomQueryDto } from '../../../../src/modules/schedules/dto/clinic-room-query.dto';
import { SchedulesService } from '../../../../src/modules/schedules/schedules.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';

describe('UC-39.1 View Room List', () => {
  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(ClinicRoomQueryDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  it('UT-39.1-01: View room options successfully by resolved clinic role.', async () => {
    const serviceContext = {
      resolveClinicId: jest.fn().mockResolvedValue('clinic-1'),
      roomRepository: {
        find: jest.fn().mockResolvedValue([
          { _id: 'room-1', roomName: 'Room A' },
          { _id: 'room-2', roomName: 'Room B' },
        ]),
      },
    } as any;

    const result = await SchedulesService.prototype.getRooms.call(serviceContext, {
      _id: 'manager-1',
      role: AccountRole.CLINIC_MANAGER,
    });

    expect(result).toEqual([
      { _id: 'room-1', roomName: 'Room A' },
      { _id: 'room-2', roomName: 'Room B' },
    ]);
  });

  it('UT-39.1-02: View paginated room list successfully by staff-linked clinic.', async () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[{ _id: 'room-1' }], 1]),
    };
    const serviceContext = {
      accountRepository: {
        findOne: jest.fn().mockResolvedValue({ _id: 'staff-1', parentId: 'clinic-1' }),
      },
      roomRepository: {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      },
    } as any;

    const result = await SchedulesService.prototype.getPaginatedClinicRoomsByStaffId.call(
      serviceContext,
      'staff-1',
      { page: 1, limit: 10 },
    );

    expect(result).toEqual({
      items: [{ _id: 'room-1' }],
      meta: {
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      },
    });
  });

  it('UT-39.1-03: View paginated room list successfully with search filter.', async () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[{ _id: 'room-2', roomName: 'Room 101' }], 1]),
    };
    const serviceContext = {
      accountRepository: {
        findOne: jest.fn().mockResolvedValue({ _id: 'staff-1', parentId: 'clinic-1' }),
      },
      roomRepository: {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      },
    } as any;

    const result = await SchedulesService.prototype.getPaginatedClinicRoomsByStaffId.call(
      serviceContext,
      'staff-1',
      { page: 1, limit: 10, search: 'Room' },
    );

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'LOWER(room.roomName) LIKE LOWER(:search)',
      { search: '%Room%' },
    );
    expect(result.items).toEqual([{ _id: 'room-2', roomName: 'Room 101' }]);
  });

  it('UT-39.1-04: Reject missing or invalid JWT.', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, SchedulesController);

    expect(guards).toHaveLength(2);
  });

  it('UT-39.1-05: Reject unauthorized role for room options endpoint.', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, SchedulesController.prototype.getRooms);

    expect(roles).toEqual([
      AccountRole.CLINIC_MANAGER,
      AccountRole.CLINIC_STAFF,
      AccountRole.DOCTOR,
    ]);
  });

  it('UT-39.1-06: Reject invalid staff linkage or invalid query DTO.', async () => {
    const serviceContext = {
      accountRepository: {
        findOne: jest.fn().mockResolvedValue(null),
      },
    } as any;
    const messages = await collectMessages({ search: 123, page: 0, limit: 0 });

    await expect(
      SchedulesService.prototype.getPaginatedClinicRoomsByStaffId.call(
        serviceContext,
        'invalid_staff',
        { page: 1, limit: 10 },
      ),
    ).rejects.toThrow(
      new BadRequestException('Staff not found or not assigned to a clinic'),
    );
    expect(messages).toContain('search must be a string');
    expect(messages).toContain('page must not be less than 1');
    expect(messages).toContain('limit must not be less than 1');
  });

  it('UT-39.1-07: Return empty options when clinic cannot be resolved.', async () => {
    const serviceContext = {
      resolveClinicId: jest.fn().mockResolvedValue(null),
    } as any;

    const result = await SchedulesService.prototype.getRooms.call(serviceContext, {
      _id: 'doctor-1',
      role: AccountRole.DOCTOR,
    });

    expect(result).toEqual([]);
  });

  it('UT-39.1-08: Return empty list when clinic has no rooms.', async () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    const serviceContext = {
      accountRepository: {
        findOne: jest.fn().mockResolvedValue({ _id: 'staff-1', parentId: 'clinic-1' }),
      },
      roomRepository: {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      },
    } as any;

    const result = await SchedulesService.prototype.getPaginatedClinicRoomsByStaffId.call(
      serviceContext,
      'staff-1',
      { page: 1, limit: 10 },
    );

    expect(result).toEqual({
      items: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
    });
  });

  it('UT-39.1-09: Return empty list when search has no matches.', async () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    const serviceContext = {
      accountRepository: {
        findOne: jest.fn().mockResolvedValue({ _id: 'staff-1', parentId: 'clinic-1' }),
      },
      roomRepository: {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      },
    } as any;

    const result = await SchedulesService.prototype.getPaginatedClinicRoomsByStaffId.call(
      serviceContext,
      'staff-1',
      { page: 1, limit: 10, search: 'XYZ' },
    );

    expect(result.items).toEqual([]);
    expect(result.meta.total).toBe(0);
  });
});
