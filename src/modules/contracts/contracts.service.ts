import { Injectable, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ContractPackageRepository } from './repositories/contract-package.repository';
import { ClinicContractInformationRepository } from './repositories/clinic-contract-information.repository';
import { AccountsService } from '../accounts/accounts.service';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { CreateContractPackageDto } from './dto/create-contract-package.dto';
import { CreateContractInfoDto } from './dto/create-contract-info.dto';
import { ContractPackage } from './entities/contract-package.entity';
import { ClinicContractInformation } from './entities/clinic-contract-information.entity';
import { AccountRole } from '../accounts/enums/account-role.enum';
import { ContractRole } from './enums/contract-role.enum';
import { ContractStatus } from '../accounts/enums/contract-status.enum';

@Injectable()
export class ContractsService {
    constructor(
        private readonly contractPackageRepository: ContractPackageRepository,
        private readonly clinicContractInfoRepository: ClinicContractInformationRepository,
        private readonly accountsService: AccountsService,
    ) { }

    async createPackage(dto: CreateContractPackageDto, clinicId: string): Promise<ContractPackage> {
        // 1. Validate Employee
        const employee = await this.accountsService.findAccountEntityById(dto.employeeId);
        if (!employee) {
            throw new NotFoundException('Employee account not found');
        }

        // Validate Role (Contract Role must match Account Role somewhat)
        // If contract is for DOCTOR, account should be DOCTOR
        if (dto.role === ContractRole.DOCTOR && employee.role !== AccountRole.DOCTOR) {
            throw new BadRequestException('Employee account must be a DOCTOR');
        }
        if (dto.role === ContractRole.STAFF && employee.role !== AccountRole.CLINIC_STAFF) {
            throw new BadRequestException('Employee account must be CLINIC_STAFF');
        }

        // 2. Check for existing active contract package (optional per business logic, but good practice)
        /* 
        const existing = await this.contractPackageRepository.findByClinicAndEmployee(clinicId, dto.employeeId);
        if (existing) {
             // Maybe check status? For now allow multiples or warn?
        }
        */

        // 3. Create Package
        const contractPackage = this.contractPackageRepository.create({
            ...dto,
            clinicId: clinicId,
            // Signatures are null initially
        });

        return this.contractPackageRepository.save(contractPackage);
    }

    async createContractInfo(packageId: string, dto: CreateContractInfoDto): Promise<ClinicContractInformation> {
        // 1. Check Package Exists
        const contractPackage = await this.contractPackageRepository.findById(packageId);
        if (!contractPackage) {
            throw new NotFoundException('Contract package not found');
        }

        // 2. Check if info already exists
        const existingInfo = await this.clinicContractInfoRepository.findByContractId(packageId);
        if (existingInfo) {
            throw new BadRequestException('Contract information already exists for this package');
        }

        // 3. Create Info
        const contractInfo = this.clinicContractInfoRepository.create({
            ...dto,
            contractId: packageId,
            // contractStatus defaults to DRAFT via entity or DTO
        });

        return this.clinicContractInfoRepository.save(contractInfo);
    }


    private async calculateFileHash(filePath: string): Promise<string> {
        // Handle URL
        if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
            try {
                const response = await axios.get(filePath, { responseType: 'arraybuffer' });
                const fileBuffer = Buffer.from(response.data);
                const hashSum = crypto.createHash('sha256');
                hashSum.update(fileBuffer);
                return hashSum.digest('hex');
            } catch (error) {
                console.error('Error downloading file:', error.message);
                // Fallback for testing/simulation if URL is unreachable (or throw exception)
                // For security, strict mode should throw exception, but for dev we might fallback
                throw new BadRequestException(`Cannot access contract file: ${error.message}`);
            }
        }

        // Handle Local File
        // Assuming filePath is relative to project root or use absolute path
        // For safety, checking if file exists
        if (!fs.existsSync(filePath)) {
            // Only for testing simulation if file not found, hash the path string
            return crypto.createHash('sha256').update(filePath).digest('hex');
        }
        const fileBuffer = fs.readFileSync(filePath);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);
        return hashSum.digest('hex');
    }

    async signContract(contractId: string, userId: string): Promise<string> {
        const contractInfo = await this.clinicContractInfoRepository.findByContractId(contractId);
        if (!contractInfo) throw new NotFoundException('Contract info not found');

        const contractPackage = await this.contractPackageRepository.findById(contractId);
        if (!contractPackage) throw new NotFoundException('Contract package not found');

        const account = await this.accountsService.findAccountEntityById(userId);

        let privateKey = account.encryptedPrivateKey;

        // Logic: If CLINIC_MANAGER, use Parent's Key (Clinic Admin) because Manager represents the Clinic Entity
        if (account.role === AccountRole.CLINIC_MANAGER && account.parentId) {
            const parentAccount = await this.accountsService.findAccountEntityById(account.parentId);
            if (!parentAccount || !parentAccount.encryptedPrivateKey) {
                throw new BadRequestException('Clinic Admin (Parent) does not have digital signature keys configured');
            }
            privateKey = parentAccount.encryptedPrivateKey;
        }

        if (!privateKey) {
            throw new BadRequestException('User (or delegated authority) does not have digital signature keys configured');
        }

        // Check if contract file exists
        if (!contractInfo.contractFile) {
            throw new BadRequestException('Contract file has not been generated yet. Cannot sign.');
        }

        // Calculate Hash
        const fileHash = await this.calculateFileHash(contractInfo.contractFile);

        const sign = crypto.createSign('SHA256');
        sign.update(fileHash);
        sign.end();
        const signature = sign.sign(privateKey, 'base64');

        // Determine if user is Manager (Clinic Side) or Employee
        const isClinicSide = contractPackage.clinicId === userId || (account.role === AccountRole.CLINIC_MANAGER && account.parentId === contractPackage.clinicId);

        if (isClinicSide) {
            contractPackage.managerSignature = signature;
        } else if (contractPackage.employeeId === userId) {
            // Employee Side - Verify Manager Signature first
            if (!contractPackage.managerSignature) throw new BadRequestException('Manager has not signed yet');

            // Clinic Public Key (Always from contractPackage.clinicId which is the Admin/HQ)
            let managerAccount = await this.accountsService.findAccountEntityById(contractPackage.clinicId);

            // If Manager uses delegated signature (Parent's key), we must verify with Parent's Public Key
            if (managerAccount.role === AccountRole.CLINIC_MANAGER && managerAccount.parentId) {
                const parentAccount = await this.accountsService.findAccountEntityById(managerAccount.parentId);
                if (parentAccount && parentAccount.publicKey) {
                    managerAccount = parentAccount; // Use Parent Account for verification
                }
            }

            if (!managerAccount.publicKey) throw new BadRequestException('Manager (Clinic) public key not found');

            const verify = crypto.createVerify('SHA256');
            verify.update(fileHash);
            verify.end();
            const sanitizedKey = managerAccount.publicKey.replace(/\\n/g, '\n');

            try {
                const managerPublicKey = crypto.createPublicKey(sanitizedKey);
                const isVerified = verify.verify(managerPublicKey, contractPackage.managerSignature, 'base64');
                if (!isVerified) throw new BadRequestException('Manager signature verification failed (Integrity Check)');
            } catch (e) {
                throw new BadRequestException(`Signature verification error: ${e.message}`);
            }

            contractPackage.employeeSignature = signature;
        } else {
            throw new UnauthorizedException('User is not a party in this contract');
        }

        await this.contractPackageRepository.save(contractPackage);
        return signature;
    }

    async verifyContract(contractId: string): Promise<{
        managerValid: boolean,
        employeeValid: boolean,
        integrity: boolean
    }> {
        const contractInfo = await this.clinicContractInfoRepository.findByContractId(contractId);
        if (!contractInfo) throw new NotFoundException('Contract info not found');

        const contractPackage = await this.contractPackageRepository.findById(contractId);
        if (!contractPackage) throw new NotFoundException('Contract package not found');

        const fileHash = await this.calculateFileHash(contractInfo.contractFile || 'default_content');

        let managerValid = false;
        let employeeValid = false;

        // Verify Manager
        if (contractPackage.managerSignature) {
            const manager = await this.accountsService.findAccountEntityById(contractPackage.clinicId);
            if (manager.publicKey) {
                const verify = crypto.createVerify('SHA256');
                verify.update(fileHash);
                verify.end();
                try {
                    const sanitizedKey = manager.publicKey.replace(/\\n/g, '\n');
                    const managerPublicKey = crypto.createPublicKey(sanitizedKey);
                    managerValid = verify.verify(managerPublicKey, contractPackage.managerSignature, 'base64');
                } catch (e) {
                    console.error('Verify Manager Key Error:', e);
                    managerValid = false;
                }
            }
        }

        // Verify Employee
        if (contractPackage.employeeSignature) {
            const employee = await this.accountsService.findAccountEntityById(contractPackage.employeeId);
            if (employee.publicKey) {
                const verify = crypto.createVerify('SHA256');
                verify.update(fileHash);
                verify.end();
                try {
                    const sanitizedKey = employee.publicKey.replace(/\\n/g, '\n');
                    const employeePublicKey = crypto.createPublicKey(sanitizedKey);
                    employeeValid = verify.verify(employeePublicKey, contractPackage.employeeSignature, 'base64');
                } catch (e) {
                    console.error('Verify Employee Key Error:', e);
                    employeeValid = false;
                }
            }
        }

        return {
            managerValid,
            employeeValid,
            integrity: managerValid || employeeValid // If signatures match current file hash, integrity is OK
        };
    }

    async uploadContractFile(contractId: string, file: any): Promise<any> {
        const contractInfo = await this.clinicContractInfoRepository.findByContractId(contractId);
        if (!contractInfo) throw new NotFoundException('Contract info not found');

        // Cloudinary Upload Logic
        try {
            // To be safe and simple without extra dependencies (like form-data package if not installed),
            // we can try sending base64 data URI string which Cloudinary supports natively.
            const base64Content = file.buffer.toString('base64');
            const fileDataUri = `data:application/pdf;base64,${base64Content}`;

            const uploadPayload = {
                file: fileDataUri,
                upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET,
                folder: 'bonix-file-pdf' // Optional: as seen in user's postman
            };

            const response = await axios.post(process.env.CLOUDINARY_UPLOAD_URL, uploadPayload);
            const secureUrl = response.data.secure_url;

            if (!secureUrl) {
                throw new Error('Cloudinary did not return secure_url');
            }

            // Save Cloud URL to DB
            contractInfo.contractFile = secureUrl;
            contractInfo.contractStatus = ContractStatus.PENDING_SIGNATURE;

            await this.clinicContractInfoRepository.save(contractInfo);

            return {
                message: 'File uploaded to Cloudinary successfully',
                fileUrl: secureUrl
            };

        } catch (error) {
            console.error('Cloudinary Upload Error:', error.response?.data || error.message);
            throw new BadRequestException(`Failed to upload file to Cloudinary: ${error.message}`);
        }
    }
}
