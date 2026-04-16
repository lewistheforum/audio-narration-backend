import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ErmsController } from '../../../../src/modules/prescriptions/erms.controller';
import { ErmsService } from '../../../../src/modules/prescriptions/erms.service';
import { SaveErmDataDto } from '../../../../src/modules/prescriptions/dto/save-erm-data.dto';
import { ERMRecordType, ERMStatus } from '../../../../src/modules/prescriptions/enums/erm-enums';

describe('UC-70 Update Medical Record', () => {
  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(SaveErmDataDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const createServiceContext = ({
    erm,
  }: {
    erm?: any;
  } = {}) => ({
    ermRepository: {
      findErmWithAppointment: jest.fn().mockResolvedValue(
        erm === undefined
          ? {
          _id: 'erm-1',
          recordType: ERMRecordType.CONSULTATION,
          status: ERMStatus.DRAFT,
          createdBy: 'doctor-1',
          appointment: { doctorId: 'doctor-1' },
            }
          : erm,
      ),
      saveConsultationData: jest.fn(),
      saveXrayData: jest.fn(),
      saveUltrasoundData: jest.fn(),
      saveLabData: jest.fn(),
      saveProcedureData: jest.fn(),
      saveBoneDensityData: jest.fn(),
      saveErm: jest.fn().mockImplementation(async (e) => ({ ...e, updatedAt: '2026-01-01' })),
    },
  }) as any;

  it('UT-70-01: Save consultation data from DRAFT', async () => {
    const serviceContext = createServiceContext();

    const result = await ErmsService.prototype.saveErmData.call(serviceContext, 'erm-1', { data: { visitType: 'FIRST' } }, 'doctor-1');

    expect(serviceContext.ermRepository.saveConsultationData).toHaveBeenCalledWith('erm-1', { visitType: 'FIRST' });
    expect(result.status).toBe(ERMStatus.IN_PROGRESS);
  });

  it('UT-70-02: Save xray data in IN_PROGRESS', async () => {
    const serviceContext = createServiceContext({
      erm: {
        _id: 'erm-1',
        recordType: ERMRecordType.XRAY,
        status: ERMStatus.IN_PROGRESS,
        createdBy: 'doctor-1',
        appointment: { doctorId: 'doctor-1' },
      },
    });

    await ErmsService.prototype.saveErmData.call(serviceContext, 'erm-1', { data: { region: 'Chest' } }, 'doctor-1');

    expect(serviceContext.ermRepository.saveXrayData).toHaveBeenCalledWith('erm-1', { region: 'Chest' });
  });

  it('UT-70-03: Save lab data branch', async () => {
    const serviceContext = createServiceContext({
      erm: {
        _id: 'erm-1',
        recordType: ERMRecordType.LAB,
        status: ERMStatus.IN_PROGRESS,
        createdBy: 'doctor-1',
        appointment: { doctorId: 'doctor-1' },
      },
    });

    await ErmsService.prototype.saveErmData.call(serviceContext, 'erm-1', { data: { panelName: 'CBC' } }, 'doctor-1');

    expect(serviceContext.ermRepository.saveLabData).toHaveBeenCalledWith('erm-1', { panelName: 'CBC' });
  });

  it('UT-70-04: Save procedure and bone density branch', async () => {
    const procedureContext = createServiceContext({
      erm: {
        _id: 'erm-1',
        recordType: ERMRecordType.PROCEDURE,
        status: ERMStatus.IN_PROGRESS,
        createdBy: 'doctor-1',
        appointment: { doctorId: 'doctor-1' },
      },
    });
    const boneContext = createServiceContext({
      erm: {
        _id: 'erm-2',
        recordType: ERMRecordType.BONE_DENSITY,
        status: ERMStatus.IN_PROGRESS,
        createdBy: 'doctor-1',
        appointment: { doctorId: 'doctor-1' },
      },
    });

    await ErmsService.prototype.saveErmData.call(procedureContext, 'erm-1', { data: { code: 'PR1' } }, 'doctor-1');
    await ErmsService.prototype.saveErmData.call(boneContext, 'erm-2', { data: { site: 'Hip' } }, 'doctor-1');

    expect(procedureContext.ermRepository.saveProcedureData).toHaveBeenCalled();
    expect(boneContext.ermRepository.saveBoneDensityData).toHaveBeenCalled();
  });

  it('UT-70-05: Missing JWT rejected', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ErmsController);

    expect(guards).toHaveLength(2);
  });

  it('UT-70-06: ERM id not found', async () => {
    const serviceContext = createServiceContext({ erm: null });

    await expect(
      ErmsService.prototype.saveErmData.call(serviceContext, 'missing', { data: {} }, 'doctor-1'),
    ).rejects.toThrow(new NotFoundException('ERM not found'));
  });

  it('UT-70-07: No permission to modify ERM', async () => {
    const serviceContext = createServiceContext({
      erm: {
        _id: 'erm-1',
        recordType: ERMRecordType.CONSULTATION,
        status: ERMStatus.IN_PROGRESS,
        createdBy: 'doctor-x',
        appointment: { doctorId: 'doctor-x' },
      },
    });

    await expect(
      ErmsService.prototype.saveErmData.call(serviceContext, 'erm-1', { data: {} }, 'staff-1'),
    ).rejects.toThrow(new BadRequestException('You do not have permission to modify this ERM'));
  });

  it('UT-70-08: Completed ERM cannot be modified', async () => {
    const serviceContext = createServiceContext({
      erm: {
        _id: 'erm-1',
        recordType: ERMRecordType.CONSULTATION,
        status: ERMStatus.COMPLETED,
        createdBy: 'doctor-1',
        appointment: { doctorId: 'doctor-1' },
      },
    });

    await expect(
      ErmsService.prototype.saveErmData.call(serviceContext, 'erm-1', { data: {} }, 'doctor-1'),
    ).rejects.toThrow(new BadRequestException('Cannot modify completed ERM'));
  });

  it('UT-70-09: Unknown record type throws error', async () => {
    const serviceContext = createServiceContext({
      erm: {
        _id: 'erm-1',
        recordType: 'UNKNOWN',
        status: ERMStatus.IN_PROGRESS,
        createdBy: 'doctor-1',
        appointment: { doctorId: 'doctor-1' },
      },
    });

    await expect(
      ErmsService.prototype.saveErmData.call(serviceContext, 'erm-1', { data: {} }, 'doctor-1'),
    ).rejects.toThrow('Unknown record type: UNKNOWN');
  });

  it('UT-70-10: Missing required data field', async () => {
    const messages = await collectMessages({});

    expect(messages.length).toBeGreaterThan(0);
  });

  it('UT-70-11: Empty object data boundary', async () => {
    const serviceContext = createServiceContext({
      erm: {
        _id: 'erm-1',
        recordType: ERMRecordType.CONSULTATION,
        status: ERMStatus.IN_PROGRESS,
        createdBy: 'doctor-1',
        appointment: { doctorId: 'doctor-1' },
      },
    });

    const result = await ErmsService.prototype.saveErmData.call(serviceContext, 'erm-1', { data: {} }, 'doctor-1');

    expect(result.message).toBe('ERM data saved successfully');
  });

  it('UT-70-12: DRAFT transitions only to IN_PROGRESS', async () => {
    const serviceContext = createServiceContext();

    const result = await ErmsService.prototype.saveErmData.call(serviceContext, 'erm-1', { data: { any: 'value' } }, 'doctor-1');

    expect(serviceContext.ermRepository.saveErm).toHaveBeenCalledWith(expect.objectContaining({ status: ERMStatus.IN_PROGRESS }));
    expect(result.status).toBe(ERMStatus.IN_PROGRESS);
  });
});
