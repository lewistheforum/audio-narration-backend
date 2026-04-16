import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as crypto from 'crypto';

import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { ContractsController } from '../../../../src/modules/contracts/contracts.controller';
import { ContractsService } from '../../../../src/modules/contracts/contracts.service';
import { RejectContractDto } from '../../../../src/modules/contracts/dto/reject-contract.dto';
import { SignContractDto } from '../../../../src/modules/contracts/dto/sign-contract.dto';
import { ContractStatus } from '../../../../src/modules/contracts/enums/contract-status.enum';

describe('UC-58 Sign Reject Contract', () => {
  const managerKeys = crypto.generateKeyPairSync('rsa', {
    modulusLength: 1024,
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  });
  const employeeKeys = crypto.generateKeyPairSync('rsa', {
    modulusLength: 1024,
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  });
  const fileHash = 'hash-content';
  const employeeSignature = crypto
    .createSign('SHA256')
    .update(fileHash)
    .end()
    .sign(employeeKeys.privateKey, 'base64');

  const collectSignMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(SignContractDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const collectRejectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(RejectContractDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const createContractPackage = (overrides: any = {}) => ({
    _id: 'pkg-1',
    clinicManagerId: 'manager-1',
    employeeId: 'employee-1',
    employeeSignature: undefined,
    managerSignature: undefined,
    ...overrides,
  });

  const createServiceContext = ({
    contractPackage = createContractPackage(),
    contractInfo = { _id: 'info-1', contractStatus: ContractStatus.PENDING_SIGNATURE },
    userAccount = {
      _id: 'employee-1',
      role: AccountRole.CLINIC_STAFF,
      email: 'employee@clinic.com',
      username: 'employee1',
      encryptedPrivateKey: employeeKeys.privateKey,
      publicKey: employeeKeys.publicKey,
    },
    otpValid = true,
    transactionFails = false,
    missingKeys = false,
    legalDocsComplete = true,
    managerAccount = {
      _id: 'manager-1',
      role: AccountRole.CLINIC_MANAGER,
      email: 'manager@clinic.com',
      username: 'manager1',
      encryptedPrivateKey: managerKeys.privateKey,
      publicKey: managerKeys.publicKey,
    },
    employeeAccount = {
      _id: 'employee-1',
      role: AccountRole.CLINIC_STAFF,
      email: 'employee@clinic.com',
      username: 'employee1',
      encryptedPrivateKey: employeeKeys.privateKey,
      publicKey: employeeKeys.publicKey,
      status: 'PENDING_APPROVAL',
      isEmailVerified: false,
    },
    doctorInfo = {
      professionalLicense: { file: 'a' },
      certificatePracticalTraining: { file: 'b' },
      medicalLicense: { file: 'c' },
    },
  }: any = {}) => {
    if (missingKeys) {
      userAccount = { ...userAccount, encryptedPrivateKey: undefined };
      managerAccount = { ...managerAccount, encryptedPrivateKey: undefined };
    }
    if (!legalDocsComplete) {
      doctorInfo = { professionalLicense: null, certificatePracticalTraining: null, medicalLicense: null };
    }

    const queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        save: jest.fn().mockImplementation(async () => {
          if (transactionFails) {
            throw new Error('db failed');
          }
          return undefined;
        }),
      },
    };

    return {
      serviceContext: {
        dataSource: {
          createQueryRunner: jest.fn().mockReturnValue(queryRunner),
        },
        contractPackageRepository: {
          findById: jest.fn().mockResolvedValue(contractPackage),
        },
        clinicContractInfoRepository: {
          findByContractId: jest.fn().mockResolvedValue(contractInfo),
        },
        accountsService: {
          findAccountEntityById: jest.fn().mockImplementation(async (id: string) => {
            if (id === userAccount._id) {
              return userAccount;
            }
            if (id === 'manager-1') {
              return managerAccount;
            }
            if (id === 'employee-1') {
              return employeeAccount;
            }
            return userAccount;
          }),
          updateAccountEntity: jest.fn().mockResolvedValue(undefined),
        },
        codeVerificationRepository: {
          create: jest.fn().mockImplementation((payload) => payload),
          save: jest.fn().mockResolvedValue(undefined),
          findValidByUserIdAndCode: jest.fn().mockResolvedValue(otpValid ? { _id: 'otp-1' } : null),
          markAsUsed: jest.fn().mockResolvedValue(undefined),
        },
        doctorInfoRepository: {
          findByAccountId: jest.fn().mockResolvedValue(doctorInfo),
        },
        mailerService: {
          sendContractSigningCode: jest.fn().mockResolvedValue(undefined),
          sendContractSignedNotificationToManager: jest.fn().mockResolvedValue(undefined),
          sendContractCompletedNotificationToEmployee: jest.fn().mockResolvedValue(undefined),
          sendContractRejectNotification: jest.fn().mockResolvedValue(undefined),
        },
        calculateFileHash: jest.fn().mockResolvedValue(fileHash),
      } as any,
      queryRunner,
    };
  };

  it('UT-58-01: Send OTP successfully for employee turn.', async () => {
    const { serviceContext } = createServiceContext();

    await ContractsService.prototype.sendSigningOtp.call(serviceContext, 'pkg-1', 'employee-1');

    expect(serviceContext.codeVerificationRepository.save).toHaveBeenCalled();
    expect(serviceContext.mailerService.sendContractSigningCode).toHaveBeenCalled();
  });

  it('UT-58-02: Send OTP successfully for manager turn.', async () => {
    const { serviceContext } = createServiceContext({
      contractInfo: { _id: 'info-1', contractStatus: ContractStatus.PENDING_MANAGER_SIGNATURE },
      userAccount: {
        _id: 'manager-1',
        role: AccountRole.CLINIC_MANAGER,
        email: 'manager@clinic.com',
        username: 'manager1',
      },
    });

    await ContractsService.prototype.sendSigningOtp.call(serviceContext, 'pkg-1', 'manager-1');

    expect(serviceContext.mailerService.sendContractSigningCode).toHaveBeenCalled();
  });

  it('UT-58-03: Employee signs contract successfully.', async () => {
    const { serviceContext } = createServiceContext();

    const signature = await ContractsService.prototype.signContract.call(
      serviceContext,
      'pkg-1',
      'employee-1',
      '123456',
    );

    expect(typeof signature).toBe('string');
  });

  it('UT-58-04: Manager completes signing successfully.', async () => {
    const { serviceContext } = createServiceContext({
      contractPackage: createContractPackage({ employeeSignature }),
      contractInfo: { _id: 'info-1', contractStatus: ContractStatus.PENDING_MANAGER_SIGNATURE },
      userAccount: {
        _id: 'manager-1',
        role: AccountRole.CLINIC_MANAGER,
        email: 'manager@clinic.com',
        username: 'manager1',
        encryptedPrivateKey: managerKeys.privateKey,
        publicKey: managerKeys.publicKey,
      },
      managerAccount: {
        _id: 'manager-1',
        role: AccountRole.CLINIC_MANAGER,
        email: 'manager@clinic.com',
        username: 'manager1',
        encryptedPrivateKey: managerKeys.privateKey,
        publicKey: managerKeys.publicKey,
      },
      employeeAccount: {
        _id: 'employee-1',
        role: AccountRole.CLINIC_STAFF,
        email: 'employee@clinic.com',
        username: 'employee1',
        encryptedPrivateKey: employeeKeys.privateKey,
        publicKey: employeeKeys.publicKey,
        status: 'PENDING_APPROVAL',
        isEmailVerified: false,
      },
    });

    const signature = await ContractsService.prototype.signContract.call(
      serviceContext,
      'pkg-1',
      'manager-1',
      '123456',
    );

    expect(typeof signature).toBe('string');
    expect(serviceContext.accountsService.updateAccountEntity).toHaveBeenCalled();
  });

  it('UT-58-05: Reject contract successfully at allowed stage.', async () => {
    const { serviceContext } = createServiceContext();

    await expect(
      ContractsService.prototype.rejectContract.call(
        serviceContext,
        'pkg-1',
        'employee-1',
        'Reason text',
      ),
    ).resolves.toBeUndefined();
  });

  it('UT-58-06: Reject missing JWT.', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ContractsController.prototype.signContract);

    expect(guards).toHaveLength(1);
  });

  it('UT-58-07: Reject invalid sign DTO values.', async () => {
    const messages = await collectSignMessages({ otp: '12345', userId: 'invalid_uuid' });

    expect(messages).toContain('otp must be longer than or equal to 6 characters');
    expect(messages).toContain('userId must be a UUID');
  });

  it('UT-58-08: Reject when contract package or info not found.', async () => {
    const { serviceContext } = createServiceContext({ contractPackage: null, contractInfo: null });

    await expect(
      ContractsService.prototype.signContract.call(serviceContext, 'pkg-1', 'employee-1', '123456'),
    ).rejects.toThrow(new NotFoundException('Contract package not found'));
  });

  it('UT-58-09: Reject when user is not contract party.', async () => {
    const { serviceContext } = createServiceContext({
      userAccount: {
        _id: 'admin-1',
        role: AccountRole.ADMIN,
        email: 'admin@x.com',
        username: 'admin',
      },
    });

    await expect(
      ContractsService.prototype.sendSigningOtp.call(serviceContext, 'pkg-1', 'admin-1'),
    ).rejects.toThrow(new UnauthorizedException('User is not a party in this contract'));
  });

  it('UT-58-10: Reject OTP sending when status turn is invalid.', async () => {
    const { serviceContext } = createServiceContext({
      contractInfo: { _id: 'info-1', contractStatus: ContractStatus.CURRENT },
      userAccount: {
        _id: 'manager-1',
        role: AccountRole.CLINIC_MANAGER,
        email: 'manager@clinic.com',
        username: 'manager1',
      },
    });

    await expect(
      ContractsService.prototype.sendSigningOtp.call(serviceContext, 'pkg-1', 'manager-1'),
    ).rejects.toThrow(new BadRequestException('Contract already fully signed'));
  });

  it('UT-58-11: Reject signing with invalid or expired OTP.', async () => {
    const { serviceContext } = createServiceContext({ otpValid: false });

    await expect(
      ContractsService.prototype.signContract.call(serviceContext, 'pkg-1', 'employee-1', '654321'),
    ).rejects.toThrow(new BadRequestException('Invalid or expired OTP'));
  });

  it('UT-58-12: Reject signing when digital key is missing.', async () => {
    const { serviceContext } = createServiceContext({ missingKeys: true });

    await expect(
      ContractsService.prototype.signContract.call(serviceContext, 'pkg-1', 'employee-1', '123456'),
    ).rejects.toThrow(new BadRequestException('User does not have digital keys generated'));
  });

  it('UT-58-13: Reject doctor signing when legal documents incomplete.', async () => {
    const { serviceContext } = createServiceContext({
      userAccount: {
        _id: 'employee-1',
        role: AccountRole.DOCTOR,
        email: 'doctor@clinic.com',
        username: 'doctor1',
        encryptedPrivateKey: employeeKeys.privateKey,
      },
      legalDocsComplete: false,
    });

    await expect(
      ContractsService.prototype.signContract.call(serviceContext, 'pkg-1', 'employee-1', '123456'),
    ).rejects.toThrow('Please upload all legal documents');
  });

  it('UT-58-14: Reject manager signing when employee signature invalid.', async () => {
    const { serviceContext } = createServiceContext({
      contractPackage: createContractPackage({ employeeSignature: 'invalid-signature' }),
      contractInfo: { _id: 'info-1', contractStatus: ContractStatus.PENDING_MANAGER_SIGNATURE },
      userAccount: {
        _id: 'manager-1',
        role: AccountRole.CLINIC_MANAGER,
        email: 'manager@clinic.com',
        username: 'manager1',
        encryptedPrivateKey: managerKeys.privateKey,
      },
    });

    await expect(
      ContractsService.prototype.signContract.call(serviceContext, 'pkg-1', 'manager-1', '123456'),
    ).rejects.toThrow(new BadRequestException('Contract integrity check failed'));
  });

  it('UT-58-15: Reject contract at invalid stage.', async () => {
    const { serviceContext } = createServiceContext({
      contractInfo: { _id: 'info-1', contractStatus: ContractStatus.CURRENT },
    });

    await expect(
      ContractsService.prototype.rejectContract.call(serviceContext, 'pkg-1', 'employee-1', 'Reason text'),
    ).rejects.toThrow(new BadRequestException('Cannot reject at this stage'));
  });

  it('UT-58-16: Reject invalid reject DTO reason.', async () => {
    const messages = await collectRejectMessages({
      reason: 'A'.repeat(1001),
      userId: 123,
    });

    expect(messages).toContain('reason must be shorter than or equal to 1000 characters');
    expect(messages).toContain('userId must be a string');
  });

  it('UT-58-17: Return internal error when transaction fails.', async () => {
    const { serviceContext } = createServiceContext({ transactionFails: true });

    await expect(
      ContractsService.prototype.signContract.call(serviceContext, 'pkg-1', 'employee-1', '123456'),
    ).rejects.toThrow('db failed');
  });

  it('UT-58-18: OTP boundary with exactly 6 digits accepted.', async () => {
    const messages = await collectSignMessages({ otp: '123456' });

    expect(messages).toEqual([]);
  });

  it('UT-58-19: Reason length boundary behavior.', async () => {
    const okMessages = await collectRejectMessages({ reason: 'A'.repeat(1000) });
    const failMessages = await collectRejectMessages({ reason: 'A'.repeat(1001) });

    expect(okMessages).toEqual([]);
    expect(failMessages).toContain('reason must be shorter than or equal to 1000 characters');
  });
});
