import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ContractPackageRepository } from './repositories/contract-package.repository';
import { ClinicContractInformationRepository } from './repositories/clinic-contract-information.repository';
import { AccountsService } from '../accounts/accounts.service';
import { DoctorInformationRepository } from '../accounts/repositories/doctor-information.repository';
import { DoctorInformation } from '../accounts/entities/doctor_information.entity';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { MailerService } from '../mailer/mailer.service';
import { CodeVerificationRepository } from '../accounts/repositories/code-verification.repository';
import { VerificationType } from '../accounts/enums';
import { generateVerificationCode } from 'src/common/utils/util';
import {
  getStartOfDay,
  getCurrentTime,
  addToVietnamTime,
} from 'src/common/utils/date.util';
import axios from 'axios';
import { CreateContractPackageDto } from './dto/create-contract-package.dto';
import { CreateContractInfoDto } from './dto/create-contract-info.dto';
import { ContractPackage } from './entities/contract-package.entity';
import { ClinicContractInformation } from './entities/clinic-contract-information.entity';
import { AccountRole } from '../accounts/enums/account-role.enum';
import { ContractRole } from './enums/contract-role.enum';
import { ContractStatus } from './enums/contract-status.enum';
import { AccountStatus } from '../accounts/enums/account-status.enum';
import { Account } from '../accounts/entities/accounts.entity';
import { Express } from 'express';

/**
 * Contracts Service
 *
 * Manages the lifecycle of contracts between Clinics and Employees.
 * Handles creation, file uploads, digital signing, and verification.
 */
@Injectable()
export class ContractsService {
  constructor(
    private readonly contractPackageRepository: ContractPackageRepository,
    private readonly clinicContractInfoRepository: ClinicContractInformationRepository,
    private readonly doctorInfoRepository: DoctorInformationRepository,
    @Inject(forwardRef(() => AccountsService))
    private readonly accountsService: AccountsService,
    @Inject(forwardRef(() => MailerService))
    private readonly mailerService: MailerService,
    private readonly codeVerificationRepository: CodeVerificationRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * Create Contract Package (Step 1)
   *
   * Initializes a new contract package with basic details.
   * Validates employee existence and role matching.
   *
   * @param dto - Data for creating contract package
   * @param clinicId - ID of the clinic manager creating the contract
   * @returns Created ContractPackage entity
   * @throws NotFoundException if employee not found
   * @throws BadRequestException if roles do not match
   */
  async createPackage(
    dto: CreateContractPackageDto,
    clinicManagerId: string,
  ): Promise<ContractPackage> {
    // 1. Validate Employee
    const employee = await this.accountsService.findAccountEntityById(
      dto.employeeId,
    );
    if (!employee) {
      throw new NotFoundException('Employee account not found');
    }

    // Validate Role matching
    if (
      dto.role === ContractRole.DOCTOR &&
      employee.role !== AccountRole.DOCTOR
    ) {
      throw new BadRequestException('Employee account must be a DOCTOR');
    }
    if (
      dto.role === ContractRole.STAFF &&
      employee.role !== AccountRole.CLINIC_STAFF
    ) {
      throw new BadRequestException('Employee account must be CLINIC_STAFF');
    }

    // Check for active contracts
    const existingPackages =
      await this.contractPackageRepository.findByEmployeeId(dto.employeeId);
    for (const pkg of existingPackages) {
      const contractInfo =
        await this.clinicContractInfoRepository.findByContractId(pkg._id);
      // Check if the package has a CURRENT active status
      if (
        contractInfo &&
        contractInfo.contractStatus === ContractStatus.CURRENT
      ) {
        throw new BadRequestException(
          'There is currently an active contract. You need to deactivate that contract before you can create a new one.',
        );
      }
    }

    // 2. Auto-populate optional fields
    const headerDate = dto.headerDate || getCurrentTime();
    const headerAddress = dto.headerAddress || 'Vietnam';
    const clinicRepresentative =
      dto.clinicRepresentative || 'Clinic Representative';
    const position = dto.position || 'Manager';

    // 3. Create Package
    const contractPackage = this.contractPackageRepository.create({
      ...dto,
      headerDate,
      headerAddress,
      clinicRepresentative,
      position,
      clinicManagerId: clinicManagerId,
    });

    return this.contractPackageRepository.save(contractPackage);
  }

  /**
   * Send OTP for Contract Signing
   *
   * Generates and sends a 6-digit OTP to the user's email for contract signing verification.
   * Enforces strict flow: Employee must sign at PENDING_SIGNATURE, Manager must sign at PENDING_MANAGER_SIGNATURE.
   *
   * @param contractId - UUID of the contract package
   * @param userId - UUID of the user requesting OTP
   * @throws NotFoundException if contract or user not found
   * @throws UnauthorizedException if user is not a party to the contract
   * @throws BadRequestException if contract flow order is violated
   */
  async sendSigningOtp(contractId: string, userId: string): Promise<void> {
    const [contractPackage, contractInfo, user] = await Promise.all([
      this.contractPackageRepository.findById(contractId),
      this.clinicContractInfoRepository.findByContractId(contractId),
      this.accountsService.findAccountEntityById(userId),
    ]);

    if (!contractPackage)
      throw new NotFoundException('Contract package not found');
    if (!contractInfo) throw new NotFoundException('Contract info not found');
    if (!user) throw new NotFoundException('User not found');

    // Check for active contracts
    const existingPackages =
      await this.contractPackageRepository.findByEmployeeId(
        contractPackage.employeeId,
      );
    for (const pkg of existingPackages) {
      if (pkg._id === contractId) continue;
      const cInfo = await this.clinicContractInfoRepository.findByContractId(
        pkg._id,
      );
      if (cInfo && cInfo.contractStatus === ContractStatus.CURRENT) {
        throw new BadRequestException(
          'There is currently an active contract. You need to deactivate that contract before you can sign a new one.',
        );
      }
    }

    if (
      contractPackage.clinicManagerId !== userId &&
      contractPackage.employeeId !== userId
    ) {
      throw new UnauthorizedException('User is not a party in this contract');
    }

    if (contractPackage.employeeId === userId) {
      if (contractInfo.contractStatus !== ContractStatus.PENDING_SIGNATURE) {
        throw new BadRequestException(
          'Not your turn to sign or contract not ready',
        );
      }
    } else if (contractPackage.clinicManagerId === userId) {
      if (
        contractInfo.contractStatus !== ContractStatus.PENDING_MANAGER_SIGNATURE
      ) {
        if (contractInfo.contractStatus === ContractStatus.PENDING_SIGNATURE) {
          throw new BadRequestException('Waiting for employee to sign first');
        } else if (contractInfo.contractStatus === ContractStatus.CURRENT) {
          throw new BadRequestException('Contract already fully signed');
        } else {
          throw new BadRequestException('Contract status invalid for signing');
        }
      }
    }

    const code = generateVerificationCode();
    const expirationTime = addToVietnamTime(15, 'minute');

    const verification = this.codeVerificationRepository.create({
      accountId: userId,
      code: code,
      expiredAt: expirationTime,
      type: VerificationType.CONTRACT_SIGNING,
    });
    await this.codeVerificationRepository.save(verification);

    await this.mailerService.sendContractSigningCode(
      user.email,
      code,
      contractId.substring(0, 8).toUpperCase(),
      user.username || 'User',
    );
  }

  /**
   * Create Contract Information (Step 2)
   *
   * Adds creating terms and details to an existing contract package.
   * Updates relevant fields if information already exists.
   *
   * @param packageId - UUID of the contract package
   * @param dto - Data for contract terms
   * @returns Created/Updated ClinicContractInformation entity
   */
  async createContractInfo(
    packageId: string,
    dto: CreateContractInfoDto,
  ): Promise<ClinicContractInformation> {
    // 1. Check Package Exists
    const contractPackage =
      await this.contractPackageRepository.findById(packageId);
    if (!contractPackage) {
      throw new NotFoundException('Contract package not found');
    }

    // Check for active contracts
    const existingPackages =
      await this.contractPackageRepository.findByEmployeeId(
        contractPackage.employeeId,
      );
    for (const pkg of existingPackages) {
      if (pkg._id === packageId) continue;
      const cInfo = await this.clinicContractInfoRepository.findByContractId(
        pkg._id,
      );
      if (cInfo && cInfo.contractStatus === ContractStatus.CURRENT) {
        throw new BadRequestException(
          'There is currently an active contract. You need to deactivate that contract before you can create a new one.',
        );
      }
    }

    // 2. Check if info already exists - UPDATE if exists
    let contractInfo =
      await this.clinicContractInfoRepository.findByContractId(packageId);

    if (contractInfo) {
      // Absolute Lock: Only allow editing if status is DRAFT
      if (contractInfo.contractStatus !== ContractStatus.DRAFT) {
        throw new BadRequestException(
          `Cannot edit contract information when status is ${contractInfo.contractStatus}. Please cancel this package and create a new one if you need to make changes.`,
        );
      }

      // Update existing - EXCLUDE contractStatus from DTO to avoid premature state transition
      // Status should only change from DRAFT to PENDING_SIGNATURE AFTER file upload
      const { contractStatus, ...updateData } = dto;
      Object.assign(contractInfo, updateData);
      return this.clinicContractInfoRepository.save(contractInfo);
    } else {
      // Create new - EXCLUDE contractStatus from DTO to ensure it stays DRAFT
      const { contractStatus, ...createData } = dto;
      contractInfo = this.clinicContractInfoRepository.create({
        ...createData,
        contractId: packageId,
        contractStatus: ContractStatus.DRAFT, // Always start as DRAFT
      });
      return this.clinicContractInfoRepository.save(contractInfo);
    }
  }

  /**
   * Get Contract Package by ID
   *
   * Retrieves full contract package details.
   *
   * @param _id - UUID of the contract package
   */
  async getPackageById(_id: string): Promise<ContractPackage> {
    const contractPackage = await this.contractPackageRepository.findById(_id);
    if (
      contractPackage &&
      [
        ContractStatus.PENDING_SIGNATURE,
        ContractStatus.PENDING_MANAGER_SIGNATURE,
        ContractStatus.CURRENT,
      ].includes(contractPackage.clinicContractInformation?.contractStatus)
    ) {
      const verification = await this.verifyContract(_id);
      // Only cons_ider tampered if at least one signature exists but integrity is false
      const hasSignature = !!(
        contractPackage.managerSignature || contractPackage.employeeSignature
      );
      if (hasSignature && !verification.integrity) {
        await this.handleTamperedContract(contractPackage);
        // Status updated in handleTamperedContract, but we should reflect it in the returned object
      }
    }
    return contractPackage;
  }

  /**
   * Calculate SHA-256 Hash of a File
   *
   * Can handle both remote URLs (Cloudinary) and local file paths.
   * Used for verifying file integrity before signing.
   *
   * @param filePath - URL or local path to file
   * @returns Hex string of SHA-256 hash
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    // Handle URL
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      try {
        const response = await axios.get(filePath, {
          responseType: 'arraybuffer',
        });
        const fileBuffer = Buffer.from(response.data);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);
        return hashSum.digest('hex');
      } catch (error) {
        console.error('Error downloading file:', error.message);
        throw new BadRequestException(
          `Cannot access contract file: ${error.message}`,
        );
      }
    }

    // Handle Local File
    if (!fs.existsSync(filePath)) {
      // Only for testing simulation if file not found, hash the path string
      return crypto.createHash('sha256').update(filePath).digest('hex');
    }
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  }

  /**
   * Sign Contract with Digital Signature
   *
   * Performs digital signing using the user's Private Key.
   * Verifies OTP, checks integrity, and handles the signing flow (Employee -> Manager).
   *
   * @param contractId - UUID of contract
   * @param userId - UUID of signer
   * @param otp - OTP Code for verification
   * @returns Generated signature (Base64)
   */
  async signContract(
    contractId: string,
    userId: string,
    otp: string,
  ): Promise<string> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const [contractPackage, contractInfo, userAccount] = await Promise.all([
        this.contractPackageRepository.findById(contractId),
        this.clinicContractInfoRepository.findByContractId(contractId),
        this.accountsService.findAccountEntityById(userId),
      ]);

      if (!contractPackage)
        throw new NotFoundException('Contract package not found');
      if (!contractInfo)
        throw new NotFoundException('Contract information not found');
      if (!userAccount) throw new NotFoundException('User not found');

      // Check for active contracts
      const existingPackages =
        await this.contractPackageRepository.findByEmployeeId(
          contractPackage.employeeId,
        );
      for (const pkg of existingPackages) {
        if (pkg._id === contractId) continue;
        const cInfo = await this.clinicContractInfoRepository.findByContractId(
          pkg._id,
        );
        if (cInfo && cInfo.contractStatus === ContractStatus.CURRENT) {
          throw new BadRequestException(
            'There is currently an active contract. You need to deactivate that contract before you can sign a new one.',
          );
        }
      }

      // Security Check: Legal Documents for Doctors
      if (userAccount.role === AccountRole.DOCTOR) {
        const doctorInfo = await this.doctorInfoRepository.findByAccountId(
          userAccount._id,
        );

        if (
          !doctorInfo ||
          !doctorInfo.professionalLicense ||
          !doctorInfo.certificatePracticalTraining ||
          !doctorInfo.medicalLicense
        ) {
          throw new BadRequestException(
            'Please upload all legal documents (Professional License, Practical Training, Medical License) before signing the contract.',
          );
        }
      }

      const verification =
        await this.codeVerificationRepository.findValidByUserIdAndCode(
          userId,
          otp,
          VerificationType.CONTRACT_SIGNING,
        );

      if (!verification) {
        throw new BadRequestException('Invalid or expired OTP');
      }
      await this.codeVerificationRepository.markAsUsed(verification._id);

      let privateKey: string;
      if (contractPackage.clinicManagerId === userId) {
        if (!userAccount.encryptedPrivateKey) {
          throw new BadRequestException(
            'Clinic Manager does not have digital keys generated',
          );
        }
        privateKey = userAccount.encryptedPrivateKey;
      } else {
        if (!userAccount.encryptedPrivateKey) {
          throw new BadRequestException(
            'User does not have digital keys generated',
          );
        }
        privateKey = userAccount.encryptedPrivateKey;
      }

      const fileHash = await this.calculateFileHash(contractInfo.contractFile);

      const sign = crypto.createSign('SHA256');
      sign.update(fileHash);
      sign.end();
      const signature = sign.sign(privateKey, 'base64');

      if (contractPackage.employeeId === userId) {
        if (contractInfo.contractStatus !== ContractStatus.PENDING_SIGNATURE) {
          throw new BadRequestException(
            'It is not your turn to sign or contract is not in valid state',
          );
        }

        contractPackage.employeeSignature = signature;
        contractInfo.contractStatus = ContractStatus.PENDING_MANAGER_SIGNATURE;
        await queryRunner.manager.save(contractInfo);
        await queryRunner.manager.save(contractPackage);

        const manager = await this.accountsService.findAccountEntityById(
          contractPackage.clinicManagerId,
        );
        if (manager && manager.email) {
          await this.mailerService.sendContractSignedNotificationToManager(
            manager.email,
            userAccount.username || 'Employee',
            contractId,
          );
        }
      } else if (contractPackage.clinicManagerId === userId) {
        if (
          contractInfo.contractStatus !==
          ContractStatus.PENDING_MANAGER_SIGNATURE
        ) {
          throw new BadRequestException(
            'Employee must sign first before Manager',
          );
        }

        const employeeAccount =
          await this.accountsService.findAccountEntityById(
            contractPackage.employeeId,
          );
        if (!employeeAccount || !employeeAccount.publicKey) {
          throw new BadRequestException(
            'Employee public key verification failed',
          );
        }

        const verify = crypto.createVerify('SHA256');
        verify.update(fileHash);
        verify.end();

        try {
          const sanitizedKey = employeeAccount.publicKey.replace(/\\n/g, '\n');
          const employeePublicKey = crypto.createPublicKey(sanitizedKey);
          const isEmployeeSignatureValid = verify.verify(
            employeePublicKey,
            contractPackage.employeeSignature,
            'base64',
          );

          if (!isEmployeeSignatureValid) {
            throw new BadRequestException(
              'Contract integrity check failed: Employee signature invalid or file modified',
            );
          }
        } catch (e) {
          console.error('Integrity Check Error:', e);
          throw new BadRequestException('Contract integrity check failed');
        }

        contractPackage.managerSignature = signature;
        contractInfo.contractStatus = ContractStatus.CURRENT;
        await queryRunner.manager.save(contractInfo);
        await queryRunner.manager.save(contractPackage);

        if (employeeAccount) {
          employeeAccount.status = AccountStatus.ACTIVE;
          employeeAccount.isEmailVerified = true;
          await this.accountsService.updateAccountEntity(employeeAccount);
        }

        if (employeeAccount && employeeAccount.email) {
          await this.mailerService.sendContractCompletedNotificationToEmployee(
            employeeAccount.email,
            userAccount.username || 'Manager',
            contractId,
          );
        }
      } else {
        throw new UnauthorizedException('User is not a party in this contract');
      }

      await queryRunner.commitTransaction();
      return signature;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async verifyContract(contractId: string): Promise<{
    managerValid: boolean;
    employeeValid: boolean;
    integrity: boolean;
  }> {
    const [contractInfo, contractPackage] = await Promise.all([
      this.clinicContractInfoRepository.findByContractId(contractId),
      this.contractPackageRepository.findById(contractId),
    ]);

    if (!contractInfo) throw new NotFoundException('Contract info not found');
    if (!contractPackage)
      throw new NotFoundException('Contract package not found');

    const fileHash = await this.calculateFileHash(
      contractInfo.contractFile || 'default_content',
    );

    let managerValid = false;
    let employeeValid = false;

    const [manager, employee] = await Promise.all([
      contractPackage.managerSignature
        ? this.accountsService.findAccountEntityById(
            contractPackage.clinicManagerId,
          )
        : Promise.resolve(null),
      contractPackage.employeeSignature
        ? this.accountsService.findAccountEntityById(contractPackage.employeeId)
        : Promise.resolve(null),
    ]);

    if (contractPackage.managerSignature && manager?.publicKey) {
      const verify = crypto.createVerify('SHA256');
      verify.update(fileHash);
      verify.end();
      try {
        const sanitizedKey = manager.publicKey.replace(/\\n/g, '\n');
        const managerPublicKey = crypto.createPublicKey(sanitizedKey);
        managerValid = verify.verify(
          managerPublicKey,
          contractPackage.managerSignature,
          'base64',
        );
      } catch (e) {
        console.error('Verify Manager Key Error:', e);
        managerValid = false;
      }
    }

    if (contractPackage.employeeSignature && employee?.publicKey) {
      const verify = crypto.createVerify('SHA256');
      verify.update(fileHash);
      verify.end();
      try {
        const sanitizedKey = employee.publicKey.replace(/\\n/g, '\n');
        const employeePublicKey = crypto.createPublicKey(sanitizedKey);
        employeeValid = verify.verify(
          employeePublicKey,
          contractPackage.employeeSignature,
          'base64',
        );
      } catch (e) {
        console.error('Verify Employee Key Error:', e);
        employeeValid = false;
      }
    }

    return {
      managerValid,
      employeeValid,
      integrity: managerValid || employeeValid,
    };
  }

  private async handleTamperedContract(
    contractPackage: ContractPackage,
  ): Promise<void> {
    const contractId = contractPackage._id;
    console.warn(
      `[SECURITY] Tampered contract detected: ${contractId}. Cancelling contract and deactivating employee: ${contractPackage.employeeId}`,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (contractPackage.clinicContractInformation) {
        contractPackage.clinicContractInformation.contractStatus =
          ContractStatus.CANCELLED;
        await queryRunner.manager.save(
          contractPackage.clinicContractInformation,
        );
      }

      await this.accountsService.updateStatus(
        contractPackage.employeeId,
        AccountStatus.PENDING_APPROVAL,
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Failed to handle tampered contract:', error);
    } finally {
      await queryRunner.release();
    }

    try {
      const [manager, employee] = await Promise.all([
        this.accountsService.findAccountEntityById(
          contractPackage.clinicManagerId,
        ),
        this.accountsService.findAccountEntityById(contractPackage.employeeId),
      ]);
      const reason =
        'Contract file hash mismatch or digital signature invalid (Integrity Check Failed).';

      if (manager?.email) {
        await this.mailerService.sendContractCancelledNotification(
          manager.email,
          contractId,
          reason,
        );
      }
      if (employee?.email) {
        await this.mailerService.sendContractCancelledNotification(
          employee.email,
          contractId,
          reason,
        );
      }
    } catch (error) {
      console.error('Failed to send contract cancellation emails:', error);
    }
  }

  async uploadContractFile(
    contractId: string,
    file: Express.Multer.File,
  ): Promise<{ message: string; fileUrl: string }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const contractInfo =
        await this.clinicContractInfoRepository.findByContractId(contractId);
      if (!contractInfo) throw new NotFoundException('Contract info not found');

      if (contractInfo.contractStatus !== ContractStatus.DRAFT) {
        throw new BadRequestException(
          `Cannot upload file when contract status is ${contractInfo.contractStatus}. Only DRAFT contracts can have files uploaded.`,
        );
      }

      const base64Content = file.buffer.toString('base64');
      const fileDataUri = `data:application/pdf;base64,${base64Content}`;

      const FormData = require('form-data');
      const formData = new FormData();
      formData.append('file', fileDataUri);
      formData.append('upload_preset', process.env.CLOUDINARY_UPLOAD_PRESET);
      formData.append('folder', 'medicare-file-pdf');

      const response = await axios.post(
        process.env.CLOUDINARY_UPLOAD_URL,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
        },
      );
      const secureUrl = response.data.secure_url;

      if (!secureUrl) {
        throw new Error('Cloudinary did not return secure_url');
      }

      contractInfo.contractFile = secureUrl;
      contractInfo.contractStatus = ContractStatus.PENDING_SIGNATURE;
      await queryRunner.manager.save(contractInfo);

      await queryRunner.commitTransaction();

      return {
        message: 'File uploaded to Cloudinary successfully',
        fileUrl: secureUrl,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error(
        'Cloudinary Upload Error:',
        error.response?.data || error.message,
      );
      throw new BadRequestException(
        `Failed to upload file to Cloudinary: ${error.message}`,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async getPackagesByManager(
    clinicManagerId: string,
    employeeName?: string,
    page: number = 1,
    limit: number = 10,
    status?: string,
  ) {
    const [packages, total] =
      await this.contractPackageRepository.findPackagesByManagerWithFilters(
        clinicManagerId,
        employeeName,
        page,
        limit,
        status,
      );

    const packagesToVerify = packages.filter(
      (pkg) =>
        [
          ContractStatus.PENDING_SIGNATURE,
          ContractStatus.PENDING_MANAGER_SIGNATURE,
          ContractStatus.CURRENT,
        ].includes(pkg.clinicContractInformation?.contractStatus) &&
        !!(pkg.managerSignature || pkg.employeeSignature),
    );

    if (packagesToVerify.length > 0) {
      const verificationResults = await Promise.all(
        packagesToVerify.map((pkg) => this.verifyContract(pkg._id)),
      );

      await Promise.all(
        verificationResults.map(async (verification, index) => {
          if (!verification.integrity) {
            await this.handleTamperedContract(packagesToVerify[index]);
          }
        }),
      );
    }

    return {
      data: packages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPackagesByEmployee(
    employeeId: string,
    clinicName?: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const [packages, total] =
      await this.contractPackageRepository.findPackagesByEmployeeWithFilters(
        employeeId,
        clinicName,
        page,
        limit,
      );

    const packagesToVerify = packages.filter(
      (pkg) =>
        [
          ContractStatus.PENDING_SIGNATURE,
          ContractStatus.PENDING_MANAGER_SIGNATURE,
          ContractStatus.CURRENT,
        ].includes(pkg.clinicContractInformation?.contractStatus) &&
        !!(pkg.managerSignature || pkg.employeeSignature),
    );

    if (packagesToVerify.length > 0) {
      const verificationResults = await Promise.all(
        packagesToVerify.map((pkg) => this.verifyContract(pkg._id)),
      );

      await Promise.all(
        verificationResults.map(async (verification, index) => {
          if (!verification.integrity) {
            await this.handleTamperedContract(packagesToVerify[index]);
          }
        }),
      );
    }

    return {
      data: packages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getMyContract(
    employeeId: string,
    packageId: string,
  ): Promise<ContractPackage> {
    const contractPackage =
      await this.contractPackageRepository.findById(packageId);

    if (!contractPackage) {
      throw new NotFoundException('Contract package not found');
    }

    if (contractPackage.employeeId !== employeeId) {
      throw new UnauthorizedException(
        'You do not have access to this contract',
      );
    }

    if (
      contractPackage.clinicContractInformation?.contractStatus ===
      ContractStatus.DRAFT
    ) {
      throw new UnauthorizedException(
        'You do not have access to this contract yet',
      );
    }

    // Verification check
    if (
      [
        ContractStatus.PENDING_SIGNATURE,
        ContractStatus.PENDING_MANAGER_SIGNATURE,
        ContractStatus.CURRENT,
      ].includes(contractPackage.clinicContractInformation?.contractStatus)
    ) {
      const hasSignature = !!(
        contractPackage.managerSignature || contractPackage.employeeSignature
      );
      if (hasSignature) {
        const verification = await this.verifyContract(packageId);
        if (!verification.integrity) {
          await this.handleTamperedContract(contractPackage);
        }
      }
    }

    return contractPackage;
  }

  /**
   * Automatic Cron Job method to mark expired contracts as OLD
   * Uses Asia/Ho_Chi_Minh timezone
   */
  async updateExpiredContractsToOld(): Promise<number> {
    const today = getStartOfDay();
    const expiredContracts =
      await this.clinicContractInfoRepository.findExpiredCurrentContracts(
        today,
      );

    if (expiredContracts.length === 0) {
      return 0;
    }

    const ids = expiredContracts.map((info) => info._id);
    return await this.clinicContractInfoRepository.updateStatusBulk(
      ids,
      ContractStatus.OLD,
    );
  }

  /**
   * Reject Contract
   *
   * Allows a party (Employee or Manager) to reject the contract with a reason.
   *
   * @param contractId - UUID of contract
   * @param userId - UUID of person rejecting
   * @param reason - Rejection reason
   */
  async rejectContract(
    contractId: string,
    userId: string,
    reason: string,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const [contractPackage, contractInfo] = await Promise.all([
        this.contractPackageRepository.findById(contractId),
        this.clinicContractInfoRepository.findByContractId(contractId),
      ]);

      if (!contractPackage)
        throw new NotFoundException('Contract package not found');
      if (!contractInfo)
        throw new NotFoundException('Contract information not found');

      if (
        contractPackage.clinicManagerId !== userId &&
        contractPackage.employeeId !== userId
      ) {
        throw new UnauthorizedException('User is not a party in this contract');
      }

      if (contractPackage.employeeId === userId) {
        if (contractInfo.contractStatus !== ContractStatus.PENDING_SIGNATURE) {
          throw new BadRequestException('Cannot reject at this stage');
        }
      } else if (contractPackage.clinicManagerId === userId) {
        if (
          contractInfo.contractStatus !==
          ContractStatus.PENDING_MANAGER_SIGNATURE
        ) {
          throw new BadRequestException('Cannot reject at this stage');
        }
      }

      contractInfo.contractStatus = ContractStatus.REJECTED;
      contractInfo.rejectionReason = reason;
      await queryRunner.manager.save(contractInfo);

      const otherUserId =
        contractPackage.employeeId === userId
          ? contractPackage.clinicManagerId
          : contractPackage.employeeId;
      const [otherUser, currentUser] = await Promise.all([
        this.accountsService.findAccountEntityById(otherUserId),
        this.accountsService.findAccountEntityById(userId),
      ]);

      if (otherUser && otherUser.email) {
        await this.mailerService.sendContractRejectNotification(
          otherUser.email,
          currentUser.username || 'User',
          contractId,
          reason,
        );
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Cancel Contract Package
   *
   * Marks the contract as CANCELLED and locks the employee if the contract was ACTIVE.
   *
   * @param id - UUID of contract package
   * @param requester - Object containing _id and role of the requester
   */
  async deletePackage(
    contractId: string,
    clinicManagerId: string,
  ): Promise<void> {
    const contractPackage =
      await this.contractPackageRepository.findById(contractId);
    if (!contractPackage) {
      throw new NotFoundException('Contract package not found');
    }

    if (contractPackage.clinicManagerId !== clinicManagerId) {
      throw new UnauthorizedException(
        'You are not allowed to delete this contract package',
      );
    }

    const contractInfo =
      await this.clinicContractInfoRepository.findByContractId(contractId);
    if (contractInfo?.contractStatus === ContractStatus.CURRENT) {
      throw new BadRequestException(
        'Cannot delete a contract package that is already CURRENT',
      );
    }

    if (contractInfo?._id) {
      await this.clinicContractInfoRepository.softDelete(contractInfo._id);
    }

    await this.contractPackageRepository.softDelete(contractId);
  }

  async cancelContractPackage(
    id: string,
    requester: { _id: string; role: string },
  ): Promise<void> {
    const contractPackage = await this.contractPackageRepository.findById(id);
    if (!contractPackage)
      throw new NotFoundException('Contract package not found');

    // Authorization: Admin or the Owner (Clinic Manager)
    if (
      requester.role !== AccountRole.ADMIN &&
      contractPackage.clinicManagerId !== requester._id
    ) {
      throw new ForbiddenException(
        'You do not have permission to cancel this contract',
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const contractInfo =
        await this.clinicContractInfoRepository.findByContractId(id);

      // Logic: Only block employee if the contract was ACTIVE (CURRENT)
      if (
        contractInfo &&
        contractInfo.contractStatus === ContractStatus.CURRENT
      ) {
        // Lock account
        await this.accountsService.updateStatus(
          contractPackage.employeeId,
          AccountStatus.PENDING_APPROVAL,
        );

        // Send Notification Email (English)
        const employee = await this.accountsService.findOne(
          contractPackage.employeeId,
        );
        if (employee && employee.email) {
          await this.mailerService.sendContractCancelledNotification(
            employee.email,
            id,
            'Your contract has been cancelled. Your account status has been set to Pending Approval.',
          );
        }
      }

      // Update Status to CANCELLED
      if (contractInfo) {
        contractInfo.contractStatus = ContractStatus.CANCELLED;
        await queryRunner.manager.save(ClinicContractInformation, contractInfo);
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
