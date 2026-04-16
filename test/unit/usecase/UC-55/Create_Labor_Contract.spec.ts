import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ContractsController } from '../../../../src/modules/contracts/contracts.controller';
import { ContractsService } from '../../../../src/modules/contracts/contracts.service';
import { CreateContractInfoDto } from '../../../../src/modules/contracts/dto/create-contract-info.dto';
import { ContractStatus } from '../../../../src/modules/contracts/enums/contract-status.enum';
import { ContractType } from '../../../../src/modules/contracts/enums/contract-type.enum';
import { SalaryPaymentMethod } from '../../../../src/modules/contracts/enums/salary-payment-method.enum';

describe('UC-55 Create Labor Contract', () => {
  const baseDto: CreateContractInfoDto = {
    doctorSpecialty: 'Cardiology',
    nationality: 'Vietnamese',
    currentLiving: 'District 1',
    workSpecialtyAtClinic: 'General Examination',
    contractStartDate: '2026-01-01T00:00:00.000Z',
    contractEndDate: '2027-01-01T00:00:00.000Z',
    contractType: ContractType.INDEFINITE,
    jobDescription: 'Examine patients',
    workingTime: '2026-01-01T08:00:00.000Z',
    restPolicy: '1 hour break',
    leavePolicy: '12 days',
    baseSalary: 20000000,
    allowances: 'Lunch',
    performanceBonus: 'KPI based',
    salaryPaymentMethod: SalaryPaymentMethod.BANK_TRANSFER,
    salaryPaymentCycle: 'Monthly',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: '2027-01-01T00:00:00.000Z',
    partyASignerName: 'Manager A',
    partyBSignerName: 'Doctor B',
    contractFile: 'https://example.com/contract.pdf',
    contractStatus: ContractStatus.DRAFT,
  };

  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(CreateContractInfoDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const createServiceContext = ({
    packageExists = true,
    existingInfo = null,
    saveThrows = false,
  }: {
    packageExists?: boolean;
    existingInfo?: any;
    saveThrows?: boolean;
  } = {}) => ({
    contractPackageRepository: {
      findById: jest
        .fn()
        .mockResolvedValue(packageExists ? { _id: 'pkg-1' } : null),
    },
    clinicContractInfoRepository: {
      findByContractId: jest.fn().mockResolvedValue(existingInfo),
      create: jest.fn().mockImplementation((payload) => payload),
      save: jest.fn().mockImplementation(async (payload) => {
        if (saveThrows) {
          throw new Error('db failed');
        }
        return payload;
      }),
    },
  }) as any;

  it('UT-55-01: Create contract info in create branch.', async () => {
    const serviceContext = createServiceContext();

    const result = await ContractsService.prototype.createContractInfo.call(
      serviceContext,
      'pkg-1',
      baseDto,
    );

    expect(result.contractId).toBe('pkg-1');
    expect(result.contractStatus).toBe(ContractStatus.DRAFT);
  });

  it('UT-55-02: Update contract info in draft-only branch.', async () => {
    const existingInfo = { _id: 'info-1', contractStatus: ContractStatus.DRAFT };
    const serviceContext = createServiceContext({ existingInfo });

    const result = await ContractsService.prototype.createContractInfo.call(
      serviceContext,
      'pkg-1',
      baseDto,
    );

    expect(result.contractType).toBe(ContractType.INDEFINITE);
    expect(result.contractStatus).toBe(ContractStatus.DRAFT);
  });

  it('UT-55-03: Create contract info with optional fields omitted.', async () => {
    const serviceContext = createServiceContext();

    const result = await ContractsService.prototype.createContractInfo.call(
      serviceContext,
      'pkg-1',
      {
        ...baseDto,
        contractEndDate: undefined,
        effectiveTo: undefined,
        jobDescription: undefined,
        contractFile: undefined,
      },
    );

    expect(result.contractStatus).toBe(ContractStatus.DRAFT);
  });

  it('UT-55-04: Reject request without JWT.', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ContractsController.prototype.createContractInfo);

    expect(guards).toHaveLength(2);
  });

  it('UT-55-05: Reject when contract package not found.', async () => {
    const serviceContext = createServiceContext({ packageExists: false });

    await expect(
      ContractsService.prototype.createContractInfo.call(serviceContext, 'missing-pkg', baseDto),
    ).rejects.toThrow(new NotFoundException('Contract package not found'));
  });

  it('UT-55-06: Reject update when existing contract info is non-DRAFT.', async () => {
    const serviceContext = createServiceContext({
      existingInfo: { _id: 'info-1', contractStatus: ContractStatus.CURRENT },
    });

    await expect(
      ContractsService.prototype.createContractInfo.call(serviceContext, 'pkg-1', baseDto),
    ).rejects.toThrow('Cannot edit contract information when status is CURRENT');
  });

  it('UT-55-07: Reject missing required string properties.', async () => {
    const messages = await collectMessages({
      ...baseDto,
      doctorSpecialty: '',
      nationality: '',
      currentLiving: '',
      workSpecialtyAtClinic: '',
      restPolicy: '',
      leavePolicy: '',
      allowances: '',
      performanceBonus: '',
      salaryPaymentCycle: '',
      partyASignerName: '',
      partyBSignerName: '',
    });

    expect(messages).toContain('doctorSpecialty should not be empty');
    expect(messages).toContain('nationality should not be empty');
    expect(messages).toContain('partyBSignerName should not be empty');
  });

  it('UT-55-08: Reject missing required date properties.', async () => {
    const messages = await collectMessages({
      ...baseDto,
      contractStartDate: undefined,
      workingTime: undefined,
      effectiveFrom: undefined,
    });

    expect(messages).toContain('contractStartDate should not be empty');
    expect(messages).toContain('workingTime should not be empty');
    expect(messages).toContain('effectiveFrom should not be empty');
  });

  it('UT-55-09: Reject invalid date formats.', async () => {
    const messages = await collectMessages({
      ...baseDto,
      contractStartDate: 'invalid-date',
      contractEndDate: 'invalid-date',
      workingTime: 'invalid-date',
      effectiveFrom: 'invalid-date',
      effectiveTo: 'invalid-date',
    });

    expect(messages).toContain('contractStartDate must be a valid ISO 8601 date string');
    expect(messages).toContain('workingTime must be a valid ISO 8601 date string');
    expect(messages).toContain('effectiveFrom must be a valid ISO 8601 date string');
  });

  it('UT-55-10: Reject invalid contract type enum.', async () => {
    const messages = await collectMessages({
      ...baseDto,
      contractType: 'INVALID',
    });

    expect(messages).toContain(
      'contractType must be one of the following values: PROBATION, FIXED_TERM, INDEFINITE, SERVICE',
    );
  });

  it('UT-55-11: Reject invalid salary payment method enum.', async () => {
    const messages = await collectMessages({
      ...baseDto,
      salaryPaymentMethod: 'INVALID',
    });

    expect(messages).toContain(
      'salaryPaymentMethod must be one of the following values: BANK_TRANSFER, CASH',
    );
  });

  it('UT-55-12: Reject invalid numeric type for base salary.', async () => {
    const messages = await collectMessages({
      ...baseDto,
      baseSalary: 'not-a-number',
    });

    expect(messages.some((m) => m.includes('baseSalary must be a number'))).toBe(true);
  });

  it('UT-55-13: Return internal error when persistence fails.', async () => {
    const serviceContext = createServiceContext({ saveThrows: true });

    await expect(
      ContractsService.prototype.createContractInfo.call(serviceContext, 'pkg-1', baseDto),
    ).rejects.toThrow('db failed');
  });

  it('UT-55-14: Boundary validate-if accepts omitted end dates.', async () => {
    const messages = await collectMessages({
      ...baseDto,
      contractEndDate: undefined,
      effectiveTo: undefined,
    });

    expect(messages).toEqual([]);
  });

  it('UT-55-15: Boundary dto contractStatus ignored on create and remains DRAFT.', async () => {
    const serviceContext = createServiceContext();

    const result = await ContractsService.prototype.createContractInfo.call(
      serviceContext,
      'pkg-1',
      {
        ...baseDto,
        contractStatus: ContractStatus.CURRENT,
      },
    );

    expect(result.contractStatus).toBe(ContractStatus.DRAFT);
  });

});
