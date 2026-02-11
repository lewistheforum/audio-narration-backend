import { Test, TestingModule } from '@nestjs/testing';
import { ContractsService } from '../../../src/modules/contracts/contracts.service';
import { ContractPackageRepository } from '../../../src/modules/contracts/repositories/contract-package.repository';
import { ClinicContractInformationRepository } from '../../../src/modules/contracts/repositories/clinic-contract-information.repository';
import { AccountsService } from '../../../src/modules/accounts/accounts.service';
import { MailerService } from '../../../src/modules/mailer/mailer.service';
import { CodeVerificationRepository } from '../../../src/modules/accounts/repositories/code-verification.repository';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ContractStatus } from '../../../src/modules/accounts/enums/contract-status.enum';
import { CreateContractInfoDto } from '../../../src/modules/contracts/dto/create-contract-info.dto';
import { VerificationType } from '../../../src/modules/accounts/enums';
import * as crypto from 'crypto';

describe('ContractsService', () => {
    let service: ContractsService;
    let contractPackageRepo: any;
    let contractInfoRepo: any;
    let accountsService: any;
    let mailerService: any;
    let codeVerificationRepo: any;

    // Helpers for crypto mocking
    const mockKeyPair = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    beforeEach(async () => {
        contractPackageRepo = {
            findById: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
        };

        contractInfoRepo = {
            findByContractId: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
        };

        accountsService = {
            findAccountEntityById: jest.fn(),
        };

        mailerService = {
            sendContractSigningCode: jest.fn(),
            sendContractSignedNotificationToManager: jest.fn(),
            sendContractCompletedNotificationToEmployee: jest.fn(),
        };

        codeVerificationRepo = {
            create: jest.fn(),
            save: jest.fn(),
            findValidByUserIdAndCode: jest.fn(),
            markAsUsed: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ContractsService,
                { provide: ContractPackageRepository, useValue: contractPackageRepo },
                { provide: ClinicContractInformationRepository, useValue: contractInfoRepo },
                { provide: AccountsService, useValue: accountsService },
                { provide: MailerService, useValue: mailerService },
                { provide: CodeVerificationRepository, useValue: codeVerificationRepo },
            ],
        }).compile();

        service = module.get<ContractsService>(ContractsService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    // ========================================
    // createContractInfo (Locking Logic)
    // ========================================
    describe('createContractInfo', () => {
        const packageId = 'pkg-123';
        const dto: CreateContractInfoDto = { jobDescription: 'Updated Terms' } as any;

        it('should update info if exists and status is DRAFT', async () => {
            contractPackageRepo.findById.mockResolvedValue({ _id: packageId });
            contractInfoRepo.findByContractId.mockResolvedValue({
                _id: 'info-1',
                contractStatus: ContractStatus.DRAFT,
                jobDescription: 'Old Terms',
            });
            contractInfoRepo.save.mockImplementation((info) => Promise.resolve(info));

            const result = await service.createContractInfo(packageId, dto);

            expect(result.jobDescription).toBe('Updated Terms');
            expect(result.contractStatus).toBe(ContractStatus.DRAFT);
        });

        it('should RESET status to DRAFT and clear file if status is PENDING_SIGNATURE', async () => {
            contractPackageRepo.findById.mockResolvedValue({ _id: packageId });
            contractInfoRepo.findByContractId.mockResolvedValue({
                _id: 'info-1',
                contractStatus: ContractStatus.PENDING_SIGNATURE, // File uploaded
                contractFile: 'https://url.com/file.pdf',
                jobDescription: 'Old Terms',
            });
            contractInfoRepo.save.mockImplementation((info) => Promise.resolve(info));

            const result = await service.createContractInfo(packageId, dto);

            expect(result.jobDescription).toBe('Updated Terms');
            expect(result.contractStatus).toBe(ContractStatus.DRAFT); // Reset
            expect(result.contractFile).toBeNull(); // Clear file
        });

        it('should THROW BadRequestException if status is PENDING_MANAGER_SIGNATURE (Locked)', async () => {
            contractPackageRepo.findById.mockResolvedValue({ _id: packageId });
            contractInfoRepo.findByContractId.mockResolvedValue({
                _id: 'info-1',
                contractStatus: ContractStatus.PENDING_MANAGER_SIGNATURE,
            });

            await expect(service.createContractInfo(packageId, dto))
                .rejects.toThrow(BadRequestException);
        });

        it('should THROW BadRequestException if status is CURRENT (Locked)', async () => {
            contractPackageRepo.findById.mockResolvedValue({ _id: packageId });
            contractInfoRepo.findByContractId.mockResolvedValue({
                _id: 'info-1',
                contractStatus: ContractStatus.CURRENT,
            });

            await expect(service.createContractInfo(packageId, dto))
                .rejects.toThrow(BadRequestException);
        });
    });

    // ========================================
    // createPackage
    // ========================================
    describe('createPackage', () => {
        const adminId = 'admin-1';
        const dto = {
            employeeId: 'emp-1',
            role: 'DOCTOR',
            salary: 1000
        } as any;

        it('should create package successfully', async () => {
            accountsService.findAccountEntityById.mockResolvedValue({
                _id: 'emp-1',
                role: 'DOCTOR'
            });
            contractPackageRepo.create.mockReturnValue({ ...dto, clinicId: adminId });
            contractPackageRepo.save.mockResolvedValue({ ...dto, clinicId: adminId, _id: 'pkg-1' });

            const result = await service.createPackage(dto, adminId);

            expect(result).toBeDefined();
            expect(result.clinicId).toBe(adminId);
            expect(contractPackageRepo.save).toHaveBeenCalled();
        });

        it('should throw NotFoundException if employee not found', async () => {
            accountsService.findAccountEntityById.mockResolvedValue(null);
            await expect(service.createPackage(dto, adminId)).rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException if role mismatch', async () => {
            accountsService.findAccountEntityById.mockResolvedValue({
                _id: 'emp-1',
                role: 'CLINIC_STAFF' // Mismatch with DOCTOR in dto
            });
            await expect(service.createPackage(dto, adminId)).rejects.toThrow(BadRequestException);
        });
    });

    // ========================================
    // sendSigningOtp
    // ========================================
    describe('sendSigningOtp', () => {
        const contractId = 'pkg-1';
        const userId = 'user-1';

        it('should send OTP successfully for valid user and turn', async () => {
            contractPackageRepo.findById.mockResolvedValue({
                _id: contractId,
                employeeId: userId,
                clinicId: 'other'
            });
            contractInfoRepo.findByContractId.mockResolvedValue({
                contractStatus: ContractStatus.PENDING_SIGNATURE
            });
            accountsService.findAccountEntityById.mockResolvedValue({
                _id: userId,
                email: 'test@mail.com'
            });
            codeVerificationRepo.create.mockReturnValue({ code: '123456' });

            await service.sendSigningOtp(contractId, userId);

            expect(mailerService.sendContractSigningCode).toHaveBeenCalled();
            expect(codeVerificationRepo.save).toHaveBeenCalled();
        });

        it('should throw UnauthorizedException if user not in contract', async () => {
            contractPackageRepo.findById.mockResolvedValue({
                _id: contractId,
                employeeId: 'other-1',
                clinicId: 'other-2'
            });

            await expect(service.sendSigningOtp(contractId, userId)).rejects.toThrow(UnauthorizedException);
        });

        it('should throw BadRequestException if violation of signing flow', async () => {
            // Employee tries to sign but status is not PENDING_SIGNATURE
            contractPackageRepo.findById.mockResolvedValue({
                _id: contractId,
                employeeId: userId,
                clinicId: 'other'
            });
            contractInfoRepo.findByContractId.mockResolvedValue({
                contractStatus: ContractStatus.DRAFT
            });

            await expect(service.sendSigningOtp(contractId, userId)).rejects.toThrow(BadRequestException);
        });
    });

    // ========================================
    // signContract (Notifications Logic)
    // ========================================
    describe('signContract', () => {
        const contractId = 'pkg-123';
        const employeeId = 'user-emp';
        const managerId = 'user-mgr';
        const otp = '123456';

        // Mock `calculateFileHash` to avoid axios/fs
        beforeEach(() => {
            jest.spyOn(service as any, 'calculateFileHash').mockResolvedValue('dummy-hash-sha256');
        });

        it('should notify Manager after Employee signs', async () => {
            contractPackageRepo.findById.mockResolvedValue({
                _id: contractId,
                employeeId: employeeId,
                clinicId: managerId,
            });
            contractInfoRepo.findByContractId.mockResolvedValue({
                _id: 'info-1',
                contractStatus: ContractStatus.PENDING_SIGNATURE,
                contractFile: 'file-url',
            });
            codeVerificationRepo.findValidByUserIdAndCode.mockResolvedValue({ _id: 'code-1' });
            accountsService.findAccountEntityById.mockImplementation((id) => {
                if (id === employeeId) return Promise.resolve({
                    _id: employeeId,
                    username: 'EmployeeName',
                    encryptedPrivateKey: mockKeyPair.privateKey,
                    publicKey: mockKeyPair.publicKey,
                });
                if (id === managerId) return Promise.resolve({
                    _id: managerId,
                    email: 'manager@test.com'
                });
                return Promise.resolve(null);
            });
            contractInfoRepo.save.mockImplementation((info) => Promise.resolve(info));
            contractPackageRepo.save.mockImplementation((pkg) => Promise.resolve(pkg));

            await service.signContract(contractId, employeeId, otp);

            expect(contractInfoRepo.save).toHaveBeenCalledWith(expect.objectContaining({
                contractStatus: ContractStatus.PENDING_MANAGER_SIGNATURE,
            }));
            expect(mailerService.sendContractSignedNotificationToManager).toHaveBeenCalledWith(
                'manager@test.com',
                'EmployeeName',
                contractId
            );
        });

        it('should notify Employee after Manager signs', async () => {
            // Pre-calculate employee signature
            const sign = crypto.createSign('SHA256');
            sign.update('dummy-hash-sha256');
            sign.end();
            const empSignature = sign.sign(mockKeyPair.privateKey, 'base64');

            contractPackageRepo.findById.mockResolvedValue({
                _id: contractId,
                employeeId: employeeId,
                clinicId: managerId,
                employeeSignature: empSignature,
            });
            contractInfoRepo.findByContractId.mockResolvedValue({
                _id: 'info-1',
                contractStatus: ContractStatus.PENDING_MANAGER_SIGNATURE,
                contractFile: 'file-url',
            });
            codeVerificationRepo.findValidByUserIdAndCode.mockResolvedValue({ _id: 'code-1' });

            accountsService.findAccountEntityById.mockImplementation((id) => {
                if (id === managerId) return Promise.resolve({
                    _id: managerId,
                    username: 'ManagerName',
                    encryptedPrivateKey: mockKeyPair.privateKey,
                });
                if (id === employeeId) return Promise.resolve({
                    _id: employeeId,
                    email: 'employee@test.com',
                    publicKey: mockKeyPair.publicKey,
                });
                return Promise.resolve(null);
            });

            contractInfoRepo.save.mockImplementation((info) => Promise.resolve(info));
            contractPackageRepo.save.mockImplementation((pkg) => Promise.resolve(pkg));

            await service.signContract(contractId, managerId, otp);

            expect(contractInfoRepo.save).toHaveBeenCalledWith(expect.objectContaining({
                contractStatus: ContractStatus.CURRENT,
            }));
            expect(mailerService.sendContractCompletedNotificationToEmployee).toHaveBeenCalledWith(
                'employee@test.com',
                'ManagerName',
                contractId,
                'file-url'
            );
        });

        it('should throw BadRequestException if OTP is invalid', async () => {
            contractPackageRepo.findById.mockResolvedValue({ _id: contractId });
            contractInfoRepo.findByContractId.mockResolvedValue({ _id: 'info-1' });
            codeVerificationRepo.findValidByUserIdAndCode.mockResolvedValue(null);

            await expect(service.signContract(contractId, employeeId, 'wrong-otp'))
                .rejects.toThrow(BadRequestException);
        });
    });

    // ========================================
    // Signature Error Cases
    // ========================================
    describe('Signature Error Handling', () => {
        const contractId = 'pkg-1';
        const userId = 'user-1';

        beforeEach(() => {
            jest.spyOn(service as any, 'calculateFileHash').mockResolvedValue('hash-123');
        });

        it('should throw BadRequestException if user has no private keys', async () => {
            contractPackageRepo.findById.mockResolvedValue({ _id: contractId, employeeId: userId });
            contractInfoRepo.findByContractId.mockResolvedValue({ contractStatus: ContractStatus.PENDING_SIGNATURE });
            codeVerificationRepo.findValidByUserIdAndCode.mockResolvedValue({ _id: 'code-1' });

            accountsService.findAccountEntityById.mockResolvedValue({
                _id: userId,
                encryptedPrivateKey: null // Missing Keys
            });

            await expect(service.signContract(contractId, userId, '123456'))
                .rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException if Employee Public Key is missing during Manager sign', async () => {
            const managerId = 'mgr-1';
            contractPackageRepo.findById.mockResolvedValue({
                _id: contractId,
                employeeId: 'emp-1',
                clinicId: managerId
            });
            contractInfoRepo.findByContractId.mockResolvedValue({
                contractStatus: ContractStatus.PENDING_MANAGER_SIGNATURE
            });
            codeVerificationRepo.findValidByUserIdAndCode.mockResolvedValue({ _id: 'code-1' });

            // Manager has keys
            accountsService.findAccountEntityById.mockImplementation((id) => {
                if (id === managerId) return Promise.resolve({ encryptedPrivateKey: mockKeyPair.privateKey });
                if (id === 'emp-1') return Promise.resolve({ publicKey: null }); // Missing Employee Public Key
                return Promise.resolve(null);
            });

            await expect(service.signContract(contractId, managerId, '123456'))
                .rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException if Integrity Check fails (Hash Mismatch/Bad Sig)', async () => {
            const managerId = 'mgr-1';
            contractPackageRepo.findById.mockResolvedValue({
                _id: contractId,
                employeeId: 'emp-1',
                clinicId: managerId,
                employeeSignature: 'sig-1'
            });
            contractInfoRepo.findByContractId.mockResolvedValue({
                contractStatus: ContractStatus.PENDING_MANAGER_SIGNATURE,
                contractFile: 'file-url'
            });
            codeVerificationRepo.findValidByUserIdAndCode.mockResolvedValue({ _id: 'code-1' });

            accountsService.findAccountEntityById.mockImplementation((id) => {
                if (id === managerId) return Promise.resolve({ encryptedPrivateKey: mockKeyPair.privateKey });
                if (id === 'emp-1') return Promise.resolve({ publicKey: mockKeyPair.publicKey });
                return Promise.resolve(null);
            });

            // Mock Verification Failure
            const mockVerify = {
                update: jest.fn(),
                end: jest.fn(),
                verify: jest.fn().mockReturnValue(false) // FAIL
            };
            jest.spyOn(crypto, 'createVerify').mockReturnValue(mockVerify as any);

            await expect(service.signContract(contractId, managerId, '123456'))
                .rejects.toThrow(BadRequestException);
        });
    });

    // ========================================
    // verifyContract
    // ========================================
    describe('verifyContract', () => {
        const contractId = 'pkg-1';

        beforeEach(() => {
            jest.spyOn(service as any, 'calculateFileHash').mockResolvedValue('dummy-hash-sha256');
        });

        it('should verify contract successfully when signatures are valid', async () => {
            contractPackageRepo.findById.mockResolvedValue({
                _id: contractId,
                employeeId: 'emp-1',
                clinicId: 'mgr-1',
                employeeSignature: 'valid-sig-emp',
                managerSignature: 'valid-sig-mgr'
            });
            contractInfoRepo.findByContractId.mockResolvedValue({ contractFile: 'file-url' });

            accountsService.findAccountEntityById.mockImplementation((id) => {
                return Promise.resolve({
                    _id: id,
                    publicKey: mockKeyPair.publicKey
                });
            });

            // Mock crypto.createVerify
            const mockVerify = {
                update: jest.fn(),
                end: jest.fn(),
                verify: jest.fn().mockReturnValue(true)
            };
            jest.spyOn(crypto, 'createVerify').mockReturnValue(mockVerify as any);

            const result = await service.verifyContract(contractId);

            expect(result.managerValid).toBe(true);
            expect(result.employeeValid).toBe(true);
            expect(result.integrity).toBe(true);
        });

        it('should return false for invalid signature', async () => {
            contractPackageRepo.findById.mockResolvedValue({
                _id: contractId,
                employeeId: 'emp-1',
                clinicId: 'mgr-1',
                employeeSignature: 'bad-sig',
                managerSignature: 'bad-sig'
            });
            contractInfoRepo.findByContractId.mockResolvedValue({ contractFile: 'file-url' });
            accountsService.findAccountEntityById.mockResolvedValue({ publicKey: mockKeyPair.publicKey });

            const mockVerify = {
                update: jest.fn(),
                end: jest.fn(),
                verify: jest.fn().mockReturnValue(false) // Invalid
            };
            jest.spyOn(crypto, 'createVerify').mockReturnValue(mockVerify as any);

            const result = await service.verifyContract(contractId);

            expect(result.managerValid).toBe(false);
            expect(result.employeeValid).toBe(false);
            expect(result.integrity).toBe(false);
        });
    });
});
