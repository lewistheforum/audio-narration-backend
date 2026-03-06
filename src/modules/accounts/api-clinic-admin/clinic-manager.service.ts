import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AccountRepository } from '../repositories/account.repository';
import { ClinicManagerInformationRepository } from '../repositories/clinic-manager-information.repository';
import { AddressRepository } from '../repositories/address.repository';
import { GoogleIframeRepository } from '../repositories/google-iframe.repository';
import { ClinicsLegalDocumentsRepository } from '../repositories/clinics-legal-documents.repository';
import {
  CreateClinicManagerDto,
  UpdateManagerProfileDto,
  UpdateManagerLocationDto,
  UpdateManagerLegalDocumentsDto,
  ManagerListResponseDto,
  ManagerDetailResponseDto,
} from '../dto';
import { AccountStatus } from '../enums/account-status.enum';
import { AccountRole } from '../enums/account-role.enum';
import { LegalDocumentVerificationStatus } from '../enums/legal-document-verification-status.enum';
import { MESSAGES } from 'src/common/message';

/**
 * Clinic Manager Service
 * 
 * Handles all CLINIC_ADMIN operations related to managing CLINIC_MANAGER accounts.
 * Implements business rules for legal document workflow and status cascading.
 */
@Injectable()
export class ClinicManagerService {
  private readonly BCRYPT_SALT_ROUNDS = 10;

  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly managerInfoRepository: ClinicManagerInformationRepository,
    private readonly addressRepository: AddressRepository,
    private readonly googleIframeRepository: GoogleIframeRepository,
    private readonly legalDocsRepository: ClinicsLegalDocumentsRepository,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * FLOW 1: Get Manager List
   * GET /api/clinic-managers
   * 
   * Returns paginated list of all managers under the authenticated CLINIC_ADMIN.
   * Shows managers in all statuses (ACTIVE, PENDING_APPROVAL, MANAGER_DISABLED, etc.)
   */
  async getManagerList(
    clinicAdminId: string,
    page: number = 1,
    limit: number = 10,
    sortBy: string = 'createdAt',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
  ): Promise<ManagerListResponseDto> {
    // Validate CLINIC_ADMIN exists
    const admin = await this.accountRepository.findAccountById(clinicAdminId);
    if (!admin || admin.role !== AccountRole.CLINIC_ADMIN) {
      throw new ForbiddenException('Only clinic admins can view manager list');
    }

    // Fetch managers with pagination
    const [managers, totalItems] = 
      await this.managerInfoRepository.findManagersByAdminWithPagination(
        clinicAdminId,
        page,
        limit,
        sortBy,
        sortOrder,
      );

    const totalPages = Math.ceil(totalItems / limit);

    // Transform to DTO
    const data = managers.map((manager) => ({
      managerId: manager.account._id,
      fullName: manager.fullName,
      clinicBranchName: manager.clinicBranchName,
      email: manager.account.email,
      status: manager.account.status,
      legalDocStatus: manager.legalDocuments?.verificationStatus || 'NOT_SUBMITTED',
      staffCount: manager.staffCount || 0,
      doctorCount: manager.doctorCount || 0,
      province: manager.address?.provinceName || 'N/A',
      createdAt: manager.createdAt,
    }));

    return {
      data,
      meta: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
        totalPages,
      },
    };
  }

  /**
   * FLOW 2: Get Manager Detail
   * GET /api/clinic-managers/:managerId
   * 
   * Returns complete information about a specific manager including:
   * - Profile information
   * - Address with Google Maps iframe
   * - Legal documents (decrypted)
   * - Personnel list (Staff/Doctor)
   * 
   * BR: If manager status is PENDING_APPROVAL, personnel array is empty [].
   * BR: If manager status is MANAGER_DISABLED, still show full personnel list.
   */
  async getManagerDetail(
    clinicAdminId: string,
    managerId: string,
  ): Promise<ManagerDetailResponseDto> {
    // Validate ownership
    const manager = await this.managerInfoRepository.findManagerDetailById(managerId);
    
    if (!manager) {
      throw new NotFoundException('Manager not found');
    }

    if (manager.account.parentId !== clinicAdminId) {
      throw new ForbiddenException('You do not have access to this manager');
    }

    // Fetch address and iframe
    const address = await this.addressRepository.findByAccountId(manager.account._id);
    const iframe = address 
      ? await this.googleIframeRepository.findByAddressId(address._id)
      : null;

    // Fetch legal documents (decrypted automatically by transformer)
    const legalDocs = await this.legalDocsRepository.findByAccountId(manager.account._id);

    // Build personnel list (empty if PENDING_APPROVAL)
    let personnel = [];
    if (manager.account.status !== AccountStatus.PENDING_APPROVAL) {
      personnel = manager.account.children
        .filter((child) => !child.deletedAt)
        .map((child) => ({
          accountId: child._id,
          fullName: child.role === AccountRole.DOCTOR 
            ? child.doctorInformation?.fullName 
            : child.clinicStaffInformation?.fullName,
          role: child.role,
          email: child.email,
          status: child.status,
          clinicRole: child.role === AccountRole.CLINIC_STAFF 
            ? child.clinicStaffInformation?.clinicRole 
            : undefined,
          specialization: child.role === AccountRole.DOCTOR 
            ? child.doctorInformation?.specialization 
            : undefined,
        }));
    }

    return {
      managerId: manager._id,
      clinicAdminId: manager.account.parentId,
      fullName: manager.fullName,
      clinicBranchName: manager.clinicBranchName,
      email: manager.account.email,
      status: manager.account.status,
      gender: manager.gender,
      dob: manager.dob,
      profilePicture: manager.profilePicture,
      address: {
        address: address?.address || '',
        wardName: address?.wardName || '',
        districtName: address?.districtName || '',
        provinceName: address?.provinceName || '',
        googleMapIframe: iframe?.googleMapIframe || null,
      },
      legalDocuments: {
        operatingLicense: legalDocs?.operatingLicense,
        businessLicense: legalDocs?.businessLicense,
        taxIdUrl: legalDocs?.taxIdUrl,
        verificationStatus: legalDocs?.verificationStatus || 'NOT_SUBMITTED',
        rejectionReason: legalDocs?.rejectionReason,
        updatedAt: legalDocs?.updatedAt,
      },
      personnel,
      createdAt: manager.account.createdAt,
      updatedAt: manager.account.updatedAt,
    };
  }

  /**
   * FLOW 3: Create Manager
   * POST /api/clinic-managers
   * 
   * Creates new CLINIC_MANAGER account with PENDING_APPROVAL status.
   * Uses transaction to ensure atomic creation of:
   * 1. Account entity (status = PENDING_APPROVAL)
   * 2. ClinicManagerInformation
   * 3. Address
   * 4. GoogleIframe (if provided)
   * 
   * DOES NOT create legal documents yet (separate endpoint in Flow 4).
   */
  async createManager(
    clinicAdminId: string,
    dto: CreateClinicManagerDto,
  ): Promise<{ managerId: string; message: string }> {
    // Validate CLINIC_ADMIN
    const admin = await this.accountRepository.findAccountById(clinicAdminId);
    if (!admin || admin.role !== AccountRole.CLINIC_ADMIN) {
      throw new ForbiddenException('Only clinic admins can create managers');
    }

    // Check email uniqueness
    const existingAccount = await this.accountRepository.findAccountByEmail(dto.email);
    if (existingAccount) {
      throw new ConflictException(MESSAGES.failMessage.userEmailAlreadyExists);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Hash password & generate RSA keys
      const hashedPassword = await bcrypt.hash(dto.password, this.BCRYPT_SALT_ROUNDS);
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      // Create Account with PENDING_APPROVAL status
      const account = this.accountRepository.createAccount({
        username: dto.email.split('@')[0],
        email: dto.email,
        password: hashedPassword,
        parentId: clinicAdminId,
        role: AccountRole.CLINIC_MANAGER,
        status: AccountStatus.PENDING_APPROVAL, // KEY: Starts in pending state
        isEmailVerified: false,
        publicKey,
        encryptedPrivateKey: privateKey,
      });

      const savedAccount = await queryRunner.manager.save(account);

      // Create ClinicManagerInformation
      const managerInfo = this.managerInfoRepository.create({
        accountId: savedAccount._id,
        fullName: dto.fullName,
        clinicBranchName: dto.clinicBranchName,
        gender: dto.gender,
        dob: dto.dob ? new Date(dto.dob) : undefined,
      });

      await queryRunner.manager.save(managerInfo);

      // Create Address
      const address = this.addressRepository.create({
        accountId: savedAccount._id,
        address: dto.address,
        ward: dto.ward,
        district: dto.district,
        province: dto.province,
        provinceName: dto.provinceName,
        districtName: dto.districtName,
        wardName: dto.wardName,
      });

      const savedAddress = await queryRunner.manager.save(address);

      // Create GoogleIframe (if provided)
      if (dto.googleMapIframe) {
        const iframe = this.googleIframeRepository.create({
          addressId: savedAddress._id,
          googleMapIframe: dto.googleMapIframe,
          responsive: true,
        });

        await queryRunner.manager.save(iframe);
      }

      await queryRunner.commitTransaction();

      return {
        managerId: savedAccount._id,
        message: 'Manager account created successfully. Please upload legal documents to proceed.',
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * FLOW 4: Upload Legal Documents (Initial or Update)
   * PUT /api/clinic-managers/:managerId/legal-documents
   * 
   * CRITICAL BUSINESS RULES:
   * - ONLY CLINIC_ADMIN can call this endpoint (enforced by Guard)
   * - CLINIC_MANAGER is explicitly blocked by RBAC (403 Forbidden)
   * - Any update triggers re-approval workflow:
   *   1. Legal doc verificationStatus -> PENDING_REVIEW
   *   2. Manager account status -> PENDING_APPROVAL
   *   3. Branch operations frozen until admin approval
   * 
   * @param managerId - Manager account ID
   * @param dto - Legal document URLs/file paths
   */
  async updateLegalDocuments(
    clinicAdminId: string,
    managerId: string,
    dto: UpdateManagerLegalDocumentsDto,
  ): Promise<{ message: string }> {
    // Validate ownership
    const manager = await this.accountRepository.findAccountById(managerId);
    
    if (!manager) {
      throw new NotFoundException('Manager not found');
    }

    if (manager.parentId !== clinicAdminId) {
      throw new ForbiddenException('You do not have access to this manager');
    }

    if (manager.role !== AccountRole.CLINIC_MANAGER) {
      throw new BadRequestException('Account is not a clinic manager');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Find or create legal documents record
      let legalDocs = await this.legalDocsRepository.findByAccountId(managerId);

      if (legalDocs) {
        // Update existing record
        legalDocs.operatingLicense = dto.operatingLicense || legalDocs.operatingLicense;
        legalDocs.businessLicense = dto.businessLicense || legalDocs.businessLicense;
        legalDocs.taxIdUrl = dto.taxIdUrl || legalDocs.taxIdUrl;
        legalDocs.otherDocs = dto.otherDocs || legalDocs.otherDocs;
        
        // CRITICAL: Reset verification status to trigger re-approval
        legalDocs.verificationStatus = LegalDocumentVerificationStatus.PENDING_REVIEW;
        legalDocs.rejectionReason = null; // Clear previous rejection reason

        await queryRunner.manager.save(legalDocs);
      } else {
        // Create new record (first-time upload)
        legalDocs = this.legalDocsRepository.create({
          accountId: managerId,
          operatingLicense: dto.operatingLicense,
          businessLicense: dto.businessLicense,
          taxIdUrl: dto.taxIdUrl,
          otherDocs: dto.otherDocs,
          verificationStatus: LegalDocumentVerificationStatus.PENDING_REVIEW,
        });

        await queryRunner.manager.save(legalDocs);
      }

      // CRITICAL: Force manager status back to PENDING_APPROVAL
      // This blocks all branch operations until admin approves
      if (manager.status !== AccountStatus.PENDING_APPROVAL) {
        manager.status = AccountStatus.PENDING_APPROVAL;
        await queryRunner.manager.save(manager);
      }

      await queryRunner.commitTransaction();

      return {
        message: 'Legal documents updated. Manager account set to PENDING_APPROVAL. ' +
                 'Branch operations are frozen until admin approval.',
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * FLOW 6.1: Update Manager Profile
   * PATCH /api/clinic-managers/:managerId/profile
   * 
   * Updates basic profile information (name, gender, DOB, picture).
   * Does NOT affect account status or legal documents.
   * Can be called by CLINIC_ADMIN or the Manager themselves.
   */
  async updateManagerProfile(
    requesterId: string,
    requesterRole: AccountRole,
    managerId: string,
    dto: UpdateManagerProfileDto,
  ): Promise<{ message: string }> {
    const manager = await this.accountRepository.findAccountById(managerId);
    
    if (!manager) {
      throw new NotFoundException('Manager not found');
    }

    // Permission check: Admin owns manager OR manager updating themselves
    const isOwner = manager.parentId === requesterId && requesterRole === AccountRole.CLINIC_ADMIN;
    const isSelf = manager._id === requesterId && requesterRole === AccountRole.CLINIC_MANAGER;

    if (!isOwner && !isSelf) {
      throw new ForbiddenException('You do not have permission to update this profile');
    }

    // Block updates if account is DELETED or BAN
    if (manager.status === AccountStatus.BAN || manager.status === AccountStatus.DELETED) {
      throw new ForbiddenException('Cannot update profile. Account is banned or deleted.');
    }

    // Update ClinicManagerInformation
    const managerInfo = await this.managerInfoRepository.findByAccountId(managerId);
    
    if (!managerInfo) {
      throw new NotFoundException('Manager information not found');
    }

    if (dto.fullName) managerInfo.fullName = dto.fullName;
    if (dto.clinicBranchName) managerInfo.clinicBranchName = dto.clinicBranchName;
    if (dto.gender) managerInfo.gender = dto.gender;
    if (dto.dob) managerInfo.dob = new Date(dto.dob);
    if (dto.profilePicture) managerInfo.profilePicture = dto.profilePicture;

    await this.managerInfoRepository.save(managerInfo);

    return { message: 'Manager profile updated successfully' };
  }

  /**
   * FLOW 6.2: Update Manager Location
   * PATCH /api/clinic-managers/:managerId/location
   * 
   * Updates address and Google Maps iframe.
   * Uses transaction to ensure atomic update of Address and GoogleIframe.
   * Can be called by CLINIC_ADMIN or the Manager themselves.
   */
  async updateManagerLocation(
    requesterId: string,
    requesterRole: AccountRole,
    managerId: string,
    dto: UpdateManagerLocationDto,
  ): Promise<{ message: string }> {
    const manager = await this.accountRepository.findAccountById(managerId);
    
    if (!manager) {
      throw new NotFoundException('Manager not found');
    }

    // Permission check
    const isOwner = manager.parentId === requesterId && requesterRole === AccountRole.CLINIC_ADMIN;
    const isSelf = manager._id === requesterId && requesterRole === AccountRole.CLINIC_MANAGER;

    if (!isOwner && !isSelf) {
      throw new ForbiddenException('You do not have permission to update this location');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update Address
      const address = await this.addressRepository.findByAccountId(managerId);
      
      if (!address) {
        throw new NotFoundException('Address not found for this manager');
      }

      address.address = dto.address;
      address.ward = dto.ward;
      address.district = dto.district;
      address.province = dto.province;
      address.provinceName = dto.provinceName;
      address.districtName = dto.districtName;
      address.wardName = dto.wardName;

      await queryRunner.manager.save(address);

      // Update or Create GoogleIframe
      if (dto.googleMapIframe) {
        let iframe = await this.googleIframeRepository.findByAddressId(address._id);

        if (iframe) {
          iframe.googleMapIframe = dto.googleMapIframe;
          await queryRunner.manager.save(iframe);
        } else {
          const newIframe = this.googleIframeRepository.create({
            addressId: address._id,
            googleMapIframe: dto.googleMapIframe,
            responsive: true,
          });
          await queryRunner.manager.save(newIframe);
        }
      }

      await queryRunner.commitTransaction();

      return { message: 'Manager location updated successfully' };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * FLOW 7: Disable Manager
   * PUT /api/clinic-managers/:managerId/disable
   * 
   * Temporarily disables a manager account.
   * - Changes status to MANAGER_DISABLED
   * - Triggers cascading login block for all Staff/Doctor
   * - Does NOT soft delete (deleted_at remains NULL)
   * - Only allowed if manager is currently ACTIVE
   */
  async disableManager(
    clinicAdminId: string,
    managerId: string,
  ): Promise<{ message: string }> {
    // Validate ownership
    const manager = await this.accountRepository.findAccountById(managerId);
    
    if (!manager) {
      throw new NotFoundException('Manager not found');
    }

    if (manager.parentId !== clinicAdminId) {
      throw new ForbiddenException('You do not have access to this manager');
    }

    if (manager.role !== AccountRole.CLINIC_MANAGER) {
      throw new BadRequestException('Account is not a clinic manager');
    }

    // Only allow disabling ACTIVE managers
    if (manager.status !== AccountStatus.ACTIVE) {
      throw new BadRequestException(
        'Can only disable managers with ACTIVE status. ' +
        `Current status: ${manager.status}`
      );
    }

    // Update status
    manager.status = AccountStatus.MANAGER_DISABLED;
    await this.accountRepository.saveAccount(manager);

    // Count affected personnel
    const { staffCount, doctorCount } = 
      await this.accountRepository.countPersonnelByManager(managerId);

    return {
      message: `Manager disabled successfully. ${staffCount} staff and ${doctorCount} doctors ` +
               'will be unable to login until manager is re-enabled.',
    };
  }

  /**
   * FLOW 8: Enable Manager
   * PUT /api/clinic-managers/:managerId/enable
   * 
   * Re-enables a disabled manager account.
   * - Changes status from MANAGER_DISABLED to ACTIVE
   * - Restores login access for all Staff/Doctor
   * - Only allowed if manager is currently MANAGER_DISABLED
   */
  async enableManager(
    clinicAdminId: string,
    managerId: string,
  ): Promise<{ message: string }> {
    // Validate ownership
    const manager = await this.accountRepository.findAccountById(managerId);
    
    if (!manager) {
      throw new NotFoundException('Manager not found');
    }

    if (manager.parentId !== clinicAdminId) {
      throw new ForbiddenException('You do not have access to this manager');
    }

    if (manager.role !== AccountRole.CLINIC_MANAGER) {
      throw new BadRequestException('Account is not a clinic manager');
    }

    // Only allow enabling MANAGER_DISABLED managers
    if (manager.status !== AccountStatus.MANAGER_DISABLED) {
      throw new BadRequestException(
        'Can only enable managers with MANAGER_DISABLED status. ' +
        `Current status: ${manager.status}`
      );
    }

    // Update status
    manager.status = AccountStatus.ACTIVE;
    await this.accountRepository.saveAccount(manager);

    // Count affected personnel
    const { staffCount, doctorCount } = 
      await this.accountRepository.countPersonnelByManager(managerId);

    return {
      message: `Manager enabled successfully. ${staffCount} staff and ${doctorCount} doctors ` +
               'can now login to the system.',
    };
  }

  /**
   * FLOW 5: Soft Delete Manager
   * DELETE /api/clinic-managers/:managerId
   * 
   * Soft deletes a manager account (sets deleted_at timestamp).
   * 
   * EDGE CASE RULES:
   * - Allow deletion if status is PENDING_APPROVAL or MANAGER_DISABLED
   * - Block deletion if status is ACTIVE (must disable first)
   * - Block deletion if legal documents are PENDING_REVIEW
   */
  async softDeleteManager(
    clinicAdminId: string,
    managerId: string,
  ): Promise<{ message: string }> {
    // Validate ownership
    const manager = await this.accountRepository.findAccountById(managerId);
    
    if (!manager) {
      throw new NotFoundException('Manager not found');
    }

    if (manager.parentId !== clinicAdminId) {
      throw new ForbiddenException('You do not have access to this manager');
    }

    // Check legal documents status
    const legalDocs = await this.legalDocsRepository.findByAccountId(managerId);
    if (legalDocs?.verificationStatus === LegalDocumentVerificationStatus.PENDING_REVIEW) {
      throw new BadRequestException(
        'Cannot delete manager with legal documents pending review. ' +
        'Please approve or reject the documents first.'
      );
    }

    // Block deletion of ACTIVE managers
    if (manager.status === AccountStatus.ACTIVE) {
      throw new BadRequestException(
        'Cannot delete an ACTIVE manager. Please disable the manager first.'
      );
    }

    // Allow deletion for PENDING_APPROVAL, MANAGER_DISABLED, BAN
    manager.deletedAt = new Date();
    await this.accountRepository.saveAccount(manager);

    return { message: 'Manager account deleted successfully' };
  }
}
