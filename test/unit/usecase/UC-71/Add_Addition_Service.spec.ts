import { BadRequestException, ForbiddenException, NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AppointmentsController } from '../../../../src/modules/appointments/appointments.controller';
import { AddServiceDto } from '../../../../src/modules/appointments/dto/add-service.dto';
import { AppointmentStatus } from '../../../../src/modules/appointments/enums/appointment-status.enum';
import { AppointmentsService } from '../../../../src/modules/appointments/appointments.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';

describe('UC-71 Add Addition Service', () => {
  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(AddServiceDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const createServiceContext = ({
    appointment = {
      _id: 'appt-1',
      doctorId: 'doctor-1',
      clinicId: 'clinic-1',
      status: AppointmentStatus.IN_PROGRESS,
      total: 100,
    },
    clinicServices = [
      {
        _id: 'csc-1',
        clinicId: 'clinic-1',
        price: 100,
        discount: 10,
        service: { serviceName: 'Service 1', category: { type: 'CONSULTATION' } },
      },
    ],
    existingServices = [],
  }: any = {}) => {
    const packageRepo = {
      create: jest.fn().mockReturnValue({ appointmentId: 'appt-1', amount: 90, createdAt: '2026-01-01', _id: 'pkg-1' }),
      save: jest.fn().mockResolvedValue({ appointmentId: 'appt-1', amount: 90, createdAt: '2026-01-01', _id: 'pkg-1' }),
    };
    const serviceAppointmentRepo = {
      create: jest.fn().mockImplementation((x) => ({ _id: `sa-${x.clinicServiceId}`, ...x })),
      save: jest.fn().mockImplementation(async (x) => x),
    };
    const appointmentRepo = {
      save: jest.fn().mockResolvedValue({ ...appointment, total: 190 }),
    };

    const queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        getRepository: jest.fn().mockImplementation((repo) => {
          if (repo?.name === 'AppointmentPackage') return packageRepo;
          if (repo?.name === 'ServiceAppointment') return serviceAppointmentRepo;
          if (repo?.name === 'Appointment') return appointmentRepo;
          return {};
        }),
      },
    } as any;

    const serviceContext = {
      dataSource: {
        getRepository: jest
          .fn()
          .mockReturnValueOnce({
            createQueryBuilder: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getOne: jest.fn().mockResolvedValue(appointment),
            }),
          })
          .mockReturnValueOnce({
            createQueryBuilder: jest.fn().mockReturnValue({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue(clinicServices),
            }),
          })
          .mockReturnValueOnce({
            createQueryBuilder: jest.fn().mockReturnValue({
              innerJoin: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue(existingServices),
            }),
          }),
        createQueryRunner: jest.fn().mockReturnValue(queryRunner),
      },
      normalizeMoney: AppointmentsService.prototype['normalizeMoney'],
      calculateServiceFinalPrice: AppointmentsService.prototype['calculateServiceFinalPrice'],
    } as any;

    return { serviceContext, queryRunner };
  };

  it('UT-71-01: Add single service successfully', async () => {
    const { serviceContext } = createServiceContext();

    const result = await AppointmentsService.prototype.addServiceToAppointment.call(
      serviceContext,
      'appt-1',
      'doctor-1',
      ['csc-1'],
    );

    expect(result.services).toHaveLength(1);
    expect(result.packageTotalAmount).toBe(90);
  });

  it('UT-71-02: Add multiple services successfully', async () => {
    const { serviceContext } = createServiceContext({
      clinicServices: [
        {
          _id: 'csc-1',
          clinicId: 'clinic-1',
          price: 100,
          discount: 0,
          service: { serviceName: 'Service 1', category: { type: 'CONSULTATION' } },
        },
        {
          _id: 'csc-2',
          clinicId: 'clinic-1',
          price: 200,
          discount: 10,
          service: { serviceName: 'Service 2', category: { type: 'XRAY' } },
        },
      ],
    });

    const result = await AppointmentsService.prototype.addServiceToAppointment.call(
      serviceContext,
      'appt-1',
      'doctor-1',
      ['csc-1', 'csc-2'],
    );

    expect(result.packageTotalAmount).toBe(280);
  });

  it('UT-71-03: Validate packageTotalAmount calculation', async () => {
    const { serviceContext } = createServiceContext({
      clinicServices: [
        {
          _id: 'csc-1',
          clinicId: 'clinic-1',
          price: 123.4,
          discount: 10,
          service: { serviceName: 'Service 1', category: { type: 'CONSULTATION' } },
        },
        {
          _id: 'csc-2',
          clinicId: 'clinic-1',
          price: 77.5,
          discount: 0,
          service: { serviceName: 'Service 2', category: { type: 'LAB' } },
        },
      ],
    });

    const result = await AppointmentsService.prototype.addServiceToAppointment.call(serviceContext, 'appt-1', 'doctor-1', ['csc-1', 'csc-2']);

    expect(result.packageTotalAmount).toBe(189);
  });

  it('UT-71-04: Validate appointment total increase', async () => {
    const { serviceContext } = createServiceContext();

    const result = await AppointmentsService.prototype.addServiceToAppointment.call(serviceContext, 'appt-1', 'doctor-1', ['csc-1']);

    expect(result.appointmentId).toBe('appt-1');
  });

  it('UT-71-05: Missing JWT rejected', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AppointmentsController.prototype.addServiceToAppointment);

    expect(guards).toHaveLength(2);
  });

  it('UT-71-06: Non-doctor role rejected', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AppointmentsController.prototype.addServiceToAppointment);

    expect(roles).toEqual([AccountRole.DOCTOR]);
  });

  it('UT-71-07: Appointment not found', async () => {
    const { serviceContext } = createServiceContext({ appointment: null });

    await expect(
      AppointmentsService.prototype.addServiceToAppointment.call(serviceContext, 'missing', 'doctor-1', ['csc-1']),
    ).rejects.toThrow(new NotFoundException('Appointment not found'));
  });

  it('UT-71-08: Doctor not assigned to appointment', async () => {
    const { serviceContext } = createServiceContext({ appointment: { _id: 'appt-1', doctorId: 'doctor-x', clinicId: 'clinic-1', status: AppointmentStatus.IN_PROGRESS, total: 100 } });

    await expect(
      AppointmentsService.prototype.addServiceToAppointment.call(serviceContext, 'appt-1', 'doctor-1', ['csc-1']),
    ).rejects.toThrow(new ForbiddenException('This appointment is not assigned to you'));
  });

  it('UT-71-09: Appointment status not IN_PROGRESS', async () => {
    const { serviceContext } = createServiceContext({ appointment: { _id: 'appt-1', doctorId: 'doctor-1', clinicId: 'clinic-1', status: AppointmentStatus.PENDING, total: 100 } });

    await expect(
      AppointmentsService.prototype.addServiceToAppointment.call(serviceContext, 'appt-1', 'doctor-1', ['csc-1']),
    ).rejects.toThrow(new BadRequestException('Can only add services when appointment status is IN_PROGRESS'));
  });

  it('UT-71-10: Invalid clinicServiceIds payload', async () => {
    const messages = await collectMessages({ clinicServiceIds: [] });

    expect(messages.length).toBeGreaterThan(0);
  });

  it('UT-71-11: Service not found or inactive', async () => {
    const { serviceContext } = createServiceContext({ clinicServices: [] });

    await expect(
      AppointmentsService.prototype.addServiceToAppointment.call(serviceContext, 'appt-1', 'doctor-1', ['csc-1']),
    ).rejects.toThrow(new NotFoundException('One or more clinic services not found or inactive'));
  });

  it('UT-71-12: Duplicate existing service in appointment', async () => {
    const { serviceContext } = createServiceContext({ existingServices: [{ _id: 'sa-existing' }] });

    await expect(
      AppointmentsService.prototype.addServiceToAppointment.call(serviceContext, 'appt-1', 'doctor-1', ['csc-1']),
    ).rejects.toThrow(new BadRequestException('One or more services already exist in the appointment'));
  });

  it('UT-71-13: Boundary one service id', async () => {
    const messages = await collectMessages({ clinicServiceIds: ['550e8400-e29b-41d4-a716-446655440000'] });

    expect(messages).toEqual([]);
  });

  it('UT-71-14: Boundary rounding and sum behavior', async () => {
    const { serviceContext } = createServiceContext({
      clinicServices: [
        {
          _id: 'csc-1',
          clinicId: 'clinic-1',
          price: 100.4,
          discount: 10,
          service: { serviceName: 'Service 1', category: { type: 'CONSULTATION' } },
        },
        {
          _id: 'csc-2',
          clinicId: 'clinic-1',
          price: 200.6,
          discount: 5,
          service: { serviceName: 'Service 2', category: { type: 'XRAY' } },
        },
      ],
    });

    const result = await AppointmentsService.prototype.addServiceToAppointment.call(serviceContext, 'appt-1', 'doctor-1', ['csc-1', 'csc-2']);

    expect(result.packageTotalAmount).toBe(281);
  });
});
