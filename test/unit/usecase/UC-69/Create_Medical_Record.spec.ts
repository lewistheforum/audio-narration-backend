import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ErmsController } from '../../../../src/modules/prescriptions/erms.controller';
import { ErmsService } from '../../../../src/modules/prescriptions/erms.service';
import { InitializeErmDto } from '../../../../src/modules/prescriptions/dto/initialize-erm.dto';
import { ERMRecordType, ERMStatus } from '../../../../src/modules/prescriptions/enums/erm-enums';

describe('UC-69 Create Medical Record', () => {
  const serviceAppointmentId = '550e8400-e29b-41d4-a716-446655440000';
  const appointmentId = '660e8400-e29b-41d4-a716-446655440001';

  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(InitializeErmDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const createServiceContext = ({
    appointment = { _id: appointmentId, doctorId: 'doctor-1' },
    serviceAppointment = {
      _id: serviceAppointmentId,
      appointmentPackage: { appointmentId },
      clinicService: {
        service: {
          serviceCode: 'SV1',
          category: { type: ERMRecordType.CONSULTATION },
          serviceFunctions: [],
        },
      },
      erm: null,
    },
    createdErm = {
      _id: 'erm-1',
      serviceAppointmentsId: serviceAppointmentId,
      appointmentId,
      recordType: ERMRecordType.CONSULTATION,
      serviceCode: 'SV1',
      status: ERMStatus.DRAFT,
      createdBy: 'doctor-1',
      createdAt: '2026-01-01',
    },
  }: any = {}) => ({
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
            getOne: jest.fn().mockResolvedValue(serviceAppointment),
          }),
        }),
    },
    ermRepository: {
      createErm: jest.fn().mockResolvedValue(createdErm),
    },
  }) as any;

  const dto = {
    serviceAppointmentId,
    appointmentId,
  };

  it('UT-69-01: Initialize ERM with category type mapping', async () => {
    const serviceContext = createServiceContext();

    const result = await ErmsService.prototype.initializeErm.call(serviceContext, dto, 'doctor-1');

    expect(serviceContext.ermRepository.createErm).toHaveBeenCalledWith(expect.objectContaining({ recordType: ERMRecordType.CONSULTATION }));
    expect(result.status).toBe(ERMStatus.DRAFT);
  });

  it('UT-69-02: Fallback record type from serviceFunctions', async () => {
    const serviceContext = createServiceContext({
      serviceAppointment: {
        _id: 'sa-1',
        appointmentPackage: { appointmentId },
        clinicService: {
          service: {
            serviceCode: 'SV1',
            category: { type: 'UNKNOWN' },
            serviceFunctions: [ERMRecordType.XRAY],
          },
        },
        erm: null,
      },
      createdErm: {
        _id: 'erm-1',
        serviceAppointmentsId: serviceAppointmentId,
        appointmentId,
        recordType: ERMRecordType.XRAY,
        serviceCode: 'SV1',
        status: ERMStatus.DRAFT,
        createdBy: 'doctor-1',
        createdAt: '2026-01-01',
      },
    });

    await ErmsService.prototype.initializeErm.call(serviceContext, dto, 'doctor-1');

    expect(serviceContext.ermRepository.createErm).toHaveBeenCalledWith(expect.objectContaining({ recordType: ERMRecordType.XRAY }));
  });

  it('UT-69-03: Default CONSULTATION when no mapping exists', async () => {
    const serviceContext = createServiceContext({
      serviceAppointment: {
        _id: 'sa-1',
        appointmentPackage: { appointmentId },
        clinicService: {
          service: {
            serviceCode: 'SV1',
            category: { type: 'UNKNOWN' },
            serviceFunctions: ['UNKNOWN_FN'],
          },
        },
        erm: null,
      },
    });

    await ErmsService.prototype.initializeErm.call(serviceContext, dto, 'doctor-1');

    expect(serviceContext.ermRepository.createErm).toHaveBeenCalledWith(expect.objectContaining({ recordType: ERMRecordType.CONSULTATION }));
  });

  it('UT-69-04: Response metadata and DRAFT status', async () => {
    const serviceContext = createServiceContext();

    const result = await ErmsService.prototype.initializeErm.call(serviceContext, dto, 'doctor-1');

    expect(result).toMatchObject({
      ermId: 'erm-1',
      serviceAppointmentId,
      appointmentId,
      status: ERMStatus.DRAFT,
      createdBy: 'doctor-1',
    });
  });

  it('UT-69-05: Missing JWT rejected', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ErmsController);

    expect(guards).toHaveLength(2);
  });

  it('UT-69-06: Staff actor not assigned to appointment', async () => {
    const serviceContext = createServiceContext({ appointment: { _id: 'appt-1', doctorId: 'doctor-x' } });

    await expect(
      ErmsService.prototype.initializeErm.call(serviceContext, dto, 'staff-1'),
    ).rejects.toThrow(new BadRequestException('This appointment is not assigned to you'));
  });

  it('UT-69-07: Appointment does not exist', async () => {
    const serviceContext = createServiceContext({ appointment: null });

    await expect(
      ErmsService.prototype.initializeErm.call(serviceContext, dto, 'doctor-1'),
    ).rejects.toThrow(new NotFoundException('Appointment not found'));
  });

  it('UT-69-08: Service appointment missing', async () => {
    const serviceContext = createServiceContext({ serviceAppointment: null });

    await expect(
      ErmsService.prototype.initializeErm.call(serviceContext, dto, 'doctor-1'),
    ).rejects.toThrow(new NotFoundException('Service appointment not found'));
  });

  it('UT-69-09: Service appointment not linked to appointment', async () => {
    const serviceContext = createServiceContext({
      serviceAppointment: {
        _id: serviceAppointmentId,
        appointmentPackage: { appointmentId: 'another-appt' },
        clinicService: { service: { category: { type: ERMRecordType.CONSULTATION }, serviceFunctions: [] } },
        erm: null,
      },
    });

    await expect(
      ErmsService.prototype.initializeErm.call(serviceContext, dto, 'doctor-1'),
    ).rejects.toThrow(new BadRequestException('Service appointment does not belong to this appointment'));
  });

  it('UT-69-10: ERM already exists conflict', async () => {
    const serviceContext = createServiceContext({
      serviceAppointment: {
        _id: serviceAppointmentId,
        appointmentPackage: { appointmentId },
        clinicService: { service: { category: { type: ERMRecordType.CONSULTATION }, serviceFunctions: [] } },
        erm: { _id: 'existing-erm' },
      },
    });

    await expect(
      ErmsService.prototype.initializeErm.call(serviceContext, dto, 'doctor-1'),
    ).rejects.toThrow(new ConflictException('ERM already exists for this service appointment'));
  });

  it('UT-69-11: Invalid UUID format in DTO', async () => {
    const messages = await collectMessages({ serviceAppointmentId: 'invalid', appointmentId: 'invalid' });

    expect(messages).toContain('Service appointment ID must be a valid UUID');
    expect(messages).toContain('Appointment ID must be a valid UUID');
  });

  it('UT-69-12: Missing DTO required field', async () => {
    const messages = await collectMessages({});

    expect(messages).toContain('Service appointment ID is required');
    expect(messages).toContain('Appointment ID is required');
  });

  it('UT-69-13: First initialization on unique service appointment', async () => {
    const serviceContext = createServiceContext();

    const result = await ErmsService.prototype.initializeErm.call(serviceContext, dto, 'doctor-1');

    expect(result.ermId).toBe('erm-1');
  });

  it('UT-69-14: Re-initialize same service appointment blocked', async () => {
    const serviceContext = createServiceContext({
      serviceAppointment: {
        _id: serviceAppointmentId,
        appointmentPackage: { appointmentId },
        clinicService: { service: { category: { type: ERMRecordType.CONSULTATION }, serviceFunctions: [] } },
        erm: { _id: 'existing-erm' },
      },
    });

    await expect(
      ErmsService.prototype.initializeErm.call(serviceContext, dto, 'doctor-1'),
    ).rejects.toThrow('ERM already exists for this service appointment');
  });
});
