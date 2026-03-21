import { Test, TestingModule } from '@nestjs/testing';
import { ContractsService } from '../../../src/modules/contracts/contracts.service';
import { ContractPackageRepository } from '../../../src/modules/contracts/repositories/contract-package.repository';
import { ClinicContractInformationRepository } from '../../../src/modules/contracts/repositories/clinic-contract-information.repository';
import { AccountsService } from '../../../src/modules/accounts/accounts.service';
import { MailerService } from '../../../src/modules/mailer/mailer.service';
import { CodeVerificationRepository } from '../../../src/modules/accounts/repositories/code-verification.repository';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ContractStatus } from '../../../src/modules/contracts/enums/contract-status.enum';
import { AccountStatus } from '../../../src/modules/accounts/enums/account-status.enum';
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
            findExpiredCurrentContracts: jest.fn(),
            updateStatusBulk: jest.fn(),
        };

        accountsService = {
            findAccountEntityById: jest.fn(),
            updateAccountEntity: jest.fn(),
        };

        mailerService = {
            sendContractSigningCode: jest.fn(),
            sendContractSignedNotificationToManager: jest.fn(),
            sendContractCompletedNotificationToEmployee: jest.fn(),
            sendContractRejectNotification: jest.fn(),
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

        it('should THROW BadRequestException if status is PENDING_SIGNATURE', async () => {
            contractPackageRepo.findById.mockResolvedValue({ _id: packageId });
            contractInfoRepo.findByContractId.mockResolvedValue({
                _id: 'info-1',
                contractStatus: ContractStatus.PENDING_SIGNATURE,
            });

            await expect(service.createContractInfo(packageId, dto))
                .rejects.toThrow(BadRequestException);
        });

        it('should IGNORE contractStatus in DTO during update', async () => {
            contractPackageRepo.findById.mockResolvedValue({ _id: packageId });
            contractInfoRepo.findByContractId.mockResolvedValue({
                _id: 'info-1',
                contractStatus: ContractStatus.DRAFT,
            });
            contractInfoRepo.save.mockImplementation((info) => Promise.resolve(info));

            const dtoWithStatus = { ...dto, contractStatus: ContractStatus.PENDING_SIGNATURE };
            const result = await service.createContractInfo(packageId, dtoWithStatus as any);

            expect(result.contractStatus).toBe(ContractStatus.DRAFT); // Remained DRAFT
        });
        
        it('should THROW BadRequestException if status is REJECTED', async () => {
            contractPackageRepo.findById.mockResolvedValue({ _id: packageId });
            contractInfoRepo.findByContractId.mockResolvedValue({
                _id: 'info-1',
                contractStatus: ContractStatus.REJECTED,
            });

            await expect(service.createContractInfo(packageId, dto))
                .rejects.toThrow(BadRequestException);
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
            contractPackageRepo.create.mockReturnValue({ ...dto, clinicManagerId: adminId });
            contractPackageRepo.save.mockResolvedValue({ ...dto, clinicManagerId: adminId, _id: 'pkg-1' });

            const result = await service.createPackage(dto, adminId);

            expect(result).toBeDefined();
            expect(result.clinicManagerId).toBe(adminId);
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
                clinicManagerId: 'other'
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
                clinicManagerId: 'other-2'
            });

            await expect(service.sendSigningOtp(contractId, userId)).rejects.toThrow(UnauthorizedException);
        });

        it('should throw BadRequestException if violation of signing flow', async () => {
            // Employee tries to sign but status is not PENDING_SIGNATURE
            contractPackageRepo.findById.mockResolvedValue({
                _id: contractId,
                employeeId: userId,
                clinicManagerId: 'other'
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
                clinicManagerId: managerId,
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
                clinicManagerId: managerId,
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
            expect(accountsService.updateAccountEntity).toHaveBeenCalledWith(expect.objectContaining({
                status: AccountStatus.ACTIVE,
                isEmailVerified: true,
            }));
            expect(mailerService.sendContractCompletedNotificationToEmployee).toHaveBeenCalledWith(
                'employee@test.com',
                'ManagerName',
                contractId
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

        it('should throw BadRequestException if Manager has no private key during sign', async () => {
            const managerId = 'mgr-1';
            contractPackageRepo.findById.mockResolvedValue({
                _id: contractId,
                employeeId: 'emp-1',
                clinicManagerId: managerId
            });
            contractInfoRepo.findByContractId.mockResolvedValue({
                contractStatus: ContractStatus.PENDING_MANAGER_SIGNATURE
            });
            codeVerificationRepo.findValidByUserIdAndCode.mockResolvedValue({ _id: 'code-1' });

            accountsService.findAccountEntityById.mockImplementation((id) => {
                if (id === managerId) return Promise.resolve({ encryptedPrivateKey: null }); // Missing Manager Private Key
                if (id === 'emp-1') return Promise.resolve({ publicKey: mockKeyPair.publicKey });
                return Promise.resolve(null);
            });

            await expect(service.signContract(contractId, managerId, '123456'))
                .rejects.toThrow(new BadRequestException('Clinic Manager does not have digital keys generated'));
        });

        it('should throw BadRequestException if Employee Public Key is missing during Manager sign', async () => {
            const managerId = 'mgr-1';
            contractPackageRepo.findById.mockResolvedValue({
                _id: contractId,
                employeeId: 'emp-1',
                clinicManagerId: managerId
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
                clinicManagerId: managerId,
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
                clinicManagerId: 'mgr-1',
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
                clinicManagerId: 'mgr-1',
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

    // ========================================
    // uploadContractFile
    // ========================================
    describe('uploadContractFile', () => {
        const contractId = 'pkg-1';

        it('should throw BadRequestException if contract is not DRAFT (e.g. REJECTED, PENDING)', async () => {
            contractInfoRepo.findByContractId.mockResolvedValue({
                contractStatus: ContractStatus.REJECTED,
            });

            await expect(service.uploadContractFile(contractId, {}))
                .rejects.toThrow(BadRequestException);
        });

        it('should throw NotFoundException if contract info not found', async () => {
            contractInfoRepo.findByContractId.mockResolvedValue(null);
            await expect(service.uploadContractFile(contractId, {}))
                .rejects.toThrow(NotFoundException);
        });
    });

    // ========================================
    // updateExpiredContractsToOld
    // ========================================
    describe('updateExpiredContractsToOld', () => {
        it('should return 0 if there are no expired contracts', async () => {
            contractInfoRepo.findExpiredCurrentContracts.mockResolvedValue([]);

            const result = await service.updateExpiredContractsToOld();

            expect(contractInfoRepo.findExpiredCurrentContracts).toHaveBeenCalled();
            expect(contractInfoRepo.updateStatusBulk).not.toHaveBeenCalled();
            expect(result).toBe(0);
        });

        it('should call updateStatusBulk with extracted IDs and return count', async () => {
            contractInfoRepo.findExpiredCurrentContracts.mockResolvedValue([
                { _id: 'id-1' },
                { _id: 'id-2' },
            ]);
            contractInfoRepo.updateStatusBulk.mockResolvedValue(2);

            const result = await service.updateExpiredContractsToOld();

            expect(contractInfoRepo.findExpiredCurrentContracts).toHaveBeenCalled();
            expect(contractInfoRepo.updateStatusBulk).toHaveBeenCalledWith(
                ['id-1', 'id-2'],
                ContractStatus.OLD
            );
            expect(result).toBe(2);
        });
    });

    // ========================================
    // rejectContract
    // ========================================
    describe('rejectContract', () => {
        const contractId = 'pkg-1';
        const empId = 'emp-1';
        const mgrId = 'mgr-1';
        const reason = 'Incorrect information';

        it('should allow Employee to reject if status is PENDING_SIGNATURE', async () => {
            contractPackageRepo.findById.mockResolvedValue({
                _id: contractId,
                employeeId: empId,
                clinicManagerId: mgrId,
            });
            contractInfoRepo.findByContractId.mockResolvedValue({
                contractStatus: ContractStatus.PENDING_SIGNATURE,
            });
            accountsService.findAccountEntityById.mockResolvedValue({
                username: 'EmpName',
                email: 'emp@test.com'
            });

            await service.rejectContract(contractId, empId, reason);

            expect(contractInfoRepo.save).toHaveBeenCalledWith(expect.objectContaining({
                contractStatus: ContractStatus.REJECTED,
                rejectionReason: reason,
            }));
            expect(mailerService.sendContractRejectNotification).toHaveBeenCalled();
        });

        it('should allow Manager to reject if status is PENDING_MANAGER_SIGNATURE', async () => {
            contractPackageRepo.findById.mockResolvedValue({
                _id: contractId,
                employeeId: empId,
                clinicManagerId: mgrId,
            });
            contractInfoRepo.findByContractId.mockResolvedValue({
                contractStatus: ContractStatus.PENDING_MANAGER_SIGNATURE,
            });
            accountsService.findAccountEntityById.mockResolvedValue({
                username: 'MgrName',
                email: 'mgr@test.com'
            });

            await service.rejectContract(contractId, mgrId, reason);

            expect(contractInfoRepo.save).toHaveBeenCalledWith(expect.objectContaining({
                contractStatus: ContractStatus.REJECTED,
                rejectionReason: reason,
            }));
            expect(mailerService.sendContractRejectNotification).toHaveBeenCalled();
        });

        it('should throw UnauthorizedException if user is not party in contract', async () => {
            contractPackageRepo.findById.mockResolvedValue({
                employeeId: 'other-1',
                clinicManagerId: 'other-2',
            });
            await expect(service.rejectContract(contractId, 'hacker-1', reason))
                .rejects.toThrow(UnauthorizedException);
        });

        it('should throw BadRequestException if employee rejects at wrong stage', async () => {
            contractPackageRepo.findById.mockResolvedValue({
                employeeId: empId,
                clinicManagerId: mgrId,
            });
            contractInfoRepo.findByContractId.mockResolvedValue({
                contractStatus: ContractStatus.PENDING_MANAGER_SIGNATURE, // Too late for employee
            });
            await expect(service.rejectContract(contractId, empId, reason))
                .rejects.toThrow(BadRequestException);
        });
    });

    // ========================================
    // deletePackage (Cancel)
    // ========================================
    describe('deletePackage', () => {
        const contractId = 'pkg-1';
        const mgrId = 'mgr-1';

        beforeEach(() => {
            contractPackageRepo.softDelete = jest.fn();
            contractInfoRepo.softDelete = jest.fn();
        });

        it('should allow Manager to cancel if contract is not CURRENT', async () => {
            contractPackageRepo.findById.mockResolvedValue({
                _id: contractId,
                clinicManagerId: mgrId,
            });
            contractInfoRepo.findByContractId.mockResolvedValue({
                _id: 'info-1',
                contractStatus: ContractStatus.PENDING_SIGNATURE,
            });

            await service.deletePackage(contractId, mgrId);

            expect(contractInfoRepo.softDelete).toHaveBeenCalledWith('info-1');
            expect(contractPackageRepo.softDelete).toHaveBeenCalledWith(contractId);
        });

        it('should throw UnauthorizedException if non-manager tries to delete', async () => {
            contractPackageRepo.findById.mockResolvedValue({
                clinicManagerId: 'other-mgr',
            });
            await expect(service.deletePackage(contractId, mgrId))
                .rejects.toThrow(UnauthorizedException);
        });

        it('should throw BadRequestException if contract is already CURRENT', async () => {
            contractPackageRepo.findById.mockResolvedValue({
                _id: contractId,
                clinicManagerId: mgrId,
            });
            contractInfoRepo.findByContractId.mockResolvedValue({
                contractStatus: ContractStatus.CURRENT,
            });
            await expect(service.deletePackage(contractId, mgrId))
                .rejects.toThrow(BadRequestException);
        });
    });

    // ========================================
    // handleTamperedContract & List Verification
    // ========================================
    describe('Contract Tampering Handling', () => {
        const pkgId = 'pkg-tampered';
        const empId = 'emp-tampered';
        const infoId = 'info-tampered';

        beforeEach(() => {
            jest.spyOn(service as any, 'calculateFileHash').mockResolvedValue('modified-hash');
            (service as any).contractPackageRepository.findPackagesByManagerWithFilters = jest.fn();
            accountsService.updateStatus = jest.fn();
        });

        it('should cancel contract and deactivate employee if signature is invalid in getPackagesByManager', async () => {
            const mockPkg = {
                _id: pkgId,
                employeeId: empId,
                managerSignature: 'some-sig',
                clinicContractInformation: {
                    _id: infoId,
                    contractStatus: ContractStatus.CURRENT,
                    contractFile: 'some-url'
                }
            };
            (service as any).contractPackageRepository.findPackagesByManagerWithFilters.mockResolvedValue([[mockPkg], 1]);
            
            // Mock verifyContract to return integrity: false
            jest.spyOn(service, 'verifyContract').mockResolvedValue({
                managerValid: false,
                employeeValid: false,
                integrity: false
            });

            const result = await service.getPackagesByManager('mgr-1');

            // handleTamperedContract should have been called
            expect(contractInfoRepo.save).toHaveBeenCalledWith(expect.objectContaining({
                contractStatus: ContractStatus.CANCELLED
            }));
            expect(accountsService.updateStatus).toHaveBeenCalledWith(empId, AccountStatus.PENDING_APPROVAL);
            expect(result.data[0].clinicContractInformation.contractStatus).toBe(ContractStatus.CANCELLED);
        });

        it('should NOT call handleTamperedContract if integrity is true', async () => {
            const mockPkg = {
                _id: pkgId,
                employeeId: empId,
                managerSignature: 'some-sig',
                clinicContractInformation: {
                    _id: infoId,
                    contractStatus: ContractStatus.CURRENT,
                    contractFile: 'some-url'
                }
            };
            (service as any).contractPackageRepository.findPackagesByManagerWithFilters.mockResolvedValue([[mockPkg], 1]);
            
            jest.spyOn(service, 'verifyContract').mockResolvedValue({
                managerValid: true,
                employeeValid: false,
                integrity: true
            });

            await service.getPackagesByManager('mgr-1');

            expect(contractInfoRepo.save).not.toHaveBeenCalled();
            expect(accountsService.updateStatus).not.toHaveBeenCalled();
        });

        it('should skip verification if NO signatures exist even if status is PENDING_SIGNATURE', async () => {
            const mockPkg = {
                _id: pkgId,
                employeeId: empId,
                managerSignature: null,
                employeeSignature: null,
                clinicContractInformation: {
                    _id: infoId,
                    contractStatus: ContractStatus.PENDING_SIGNATURE,
                    contractFile: 'some-url'
                }
            };
            (service as any).contractPackageRepository.findPackagesByManagerWithFilters.mockResolvedValue([[mockPkg], 1]);
            
            const verifySpy = jest.spyOn(service, 'verifyContract');

            await service.getPackagesByManager('mgr-1');

            expect(verifySpy).not.toHaveBeenCalled();
        });
    });
});
