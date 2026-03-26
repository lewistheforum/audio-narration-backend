import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ClinicsLegalDocuments } from '../accounts/entities/clinics_legal_documents.entity';
import { Account } from '../accounts/entities/accounts.entity';
import { CreateClinicLegalDocumentDto } from './dto/create-clinic-legal-document.dto';
import { LegalDocumentVerificationStatus } from '../accounts/enums/legal-document-verification-status.enum';
import { AccountRole } from '../accounts/enums/account-role.enum';
import { AccountStatus } from '../accounts/enums/account-status.enum';

@Injectable()
export class ClinicLegalDocumentsService {
  constructor(
    @InjectRepository(ClinicsLegalDocuments)
    private readonly clinicRepo: Repository<ClinicsLegalDocuments>,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    dto: CreateClinicLegalDocumentDto,
  ): Promise<ClinicsLegalDocuments> {
    const doc = this.clinicRepo.create(dto);
    return this.clinicRepo.save(doc);
  }

  async findDocumentByAccountId(accountId: string): Promise<ClinicsLegalDocuments> {
    const doc = await this.clinicRepo.findOne({ where: { accountId } });
    if (!doc) {
      throw new NotFoundException('Clinic legal document not found');
    }
    return doc;
  }

  async findOne(_id: string): Promise<ClinicsLegalDocuments> {
    const doc = await this.clinicRepo.findOne({ where: { _id } });
    if (!doc) {
      throw new NotFoundException('Clinic legal document not found');
    }
    return doc;
  }

  // ============================================
  // Pending Legal Documents
  // ============================================

  /**
   * Get pending clinic manager legal documents
   * Only returns docs whose parent clinic admin account is ACTIVE
   */
  async getPendingDocuments(
    page: number = 1,
    limit: number = 10,
  ): Promise<any> {
    const skip = (page - 1) * limit;

    const queryBuilder = this.clinicRepo
      .createQueryBuilder('legalDocs')
      .leftJoin('legalDocs.account', 'managerAccount')
      .leftJoin(
        'accounts',
        'adminAccount',
        'adminAccount._id = managerAccount.parent_id',
      )
      .leftJoin(
        'clinic_admin_information',
        'clinicInfo',
        'clinicInfo.account_id = adminAccount._id',
      )
      .leftJoin(
        'clinic_manager_information',
        'managerInfo',
        'managerInfo.account_id = managerAccount._id',
      )
      .where('legalDocs.verification_status = :status', {
        status: LegalDocumentVerificationStatus.PENDING_REVIEW,
      })
      .andWhere('adminAccount.status = :adminStatus', {
        adminStatus: AccountStatus.ACTIVE,
      })
      .andWhere('managerAccount.role = :role', {
        role: AccountRole.CLINIC_MANAGER,
      })
      .andWhere(
        `(SELECT COUNT(*) FROM accounts m WHERE m.parent_id = adminAccount._id AND m.role = '${AccountRole.CLINIC_MANAGER}') > 1`,
      )
      .select([
        'legalDocs._id as "id"',
        'clinicInfo.clinic_name as "clinicName"',
        'managerInfo.clinic_branch_name as "clinicBranchName"',
        'managerInfo.full_name as "managerName"',
        'managerAccount.email as "managerEmail"',
        'adminAccount.email as "adminEmail"',
        'legalDocs.operating_license as "operatingLicense"',
        'legalDocs.business_license as "businessLicense"',
        'legalDocs.created_at as "submittedAt"',
      ])
      .orderBy('legalDocs.created_at', 'DESC')
      .offset(skip)
      .limit(limit);

    const data = await queryBuilder.getRawMany();

    // Count total pending docs with active admin
    const totalItems = await this.clinicRepo
      .createQueryBuilder('legalDocs')
      .leftJoin('legalDocs.account', 'managerAccount')
      .leftJoin(
        'accounts',
        'adminAccount',
        'adminAccount._id = managerAccount.parent_id',
      )
      .where('legalDocs.verification_status = :status', {
        status: LegalDocumentVerificationStatus.PENDING_REVIEW,
      })
      .andWhere('adminAccount.status = :adminStatus', {
        adminStatus: AccountStatus.ACTIVE,
      })
      .andWhere('managerAccount.role = :role', {
        role: AccountRole.CLINIC_MANAGER,
      })
      .andWhere(
        `(SELECT COUNT(*) FROM accounts m WHERE m.parent_id = adminAccount._id AND m.role = '${AccountRole.CLINIC_MANAGER}') > 1`,
      )
      .getCount();

    return {
      data,
      meta: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  // ============================================
  // Document Detail
  // ============================================

  /**
   * Get full detail of a legal document by its ID
   */
  async getDocumentDetail(legalDocId: string): Promise<any> {
    const result = await this.clinicRepo
      .createQueryBuilder('legalDocs')
      .leftJoin('legalDocs.account', 'managerAccount')
      .leftJoin(
        'clinic_manager_information',
        'managerInfo',
        'managerInfo.account_id = managerAccount._id',
      )
      .leftJoin(
        'accounts',
        'adminAccount',
        'adminAccount._id = managerAccount.parent_id',
      )
      .leftJoin(
        'clinic_admin_information',
        'clinicInfo',
        'clinicInfo.account_id = adminAccount._id',
      )
      .leftJoin(
        'addresses',
        'managerAddress',
        'managerAddress.account_id = managerAccount._id',
      )
      .where('legalDocs._id = :id', { id: legalDocId })
      .select([
        // Legal docs
        'legalDocs._id as "id"',
        'legalDocs.operating_license as "operatingLicense"',
        'legalDocs.business_license as "businessLicense"',
        'legalDocs.tax_id_url as "taxIdUrl"',
        'legalDocs.other_docs as "otherDocs"',
        'legalDocs.verification_status as "verificationStatus"',
        'legalDocs.rejection_reason as "rejectionReason"',
        'legalDocs.created_at as "submittedAt"',
        'legalDocs.updated_at as "updatedAt"',
        // Manager account
        'managerAccount._id as "managerAccountId"',
        'managerAccount.email as "managerEmail"',
        'managerAccount.phone as "managerPhone"',
        'managerAccount.status as "managerAccountStatus"',
        // Manager info
        'managerInfo.full_name as "managerName"',
        'managerInfo.clinic_branch_name as "clinicBranchName"',
        'managerInfo.gender as "managerGender"',
        'managerInfo.profile_picture as "managerProfilePicture"',
        // Manager address
        'managerAddress.address as "managerAddress"',
        'managerAddress.ward as "managerWard"',
        'managerAddress.ward_name as "managerWardName"',
        'managerAddress.district as "managerDistrict"',
        'managerAddress.district_name as "managerDistrictName"',
        'managerAddress.province as "managerProvince"',
        'managerAddress.province_name as "managerProvinceName"',
        // Admin account
        'adminAccount._id as "adminAccountId"',
        'adminAccount.email as "adminEmail"',
        'adminAccount.phone as "adminPhone"',
        // Clinic admin info
        'clinicInfo.clinic_name as "clinicName"',
        'clinicInfo.clinic_phone as "clinicPhone"',
        'clinicInfo.description as "clinicDescription"',
      ])
      .getRawOne();

    if (!result) {
      throw new NotFoundException('Legal document not found');
    }

    // Structure the response
    return {
      legalDocument: {
        id: result.id,
        operatingLicense: result.operatingLicense,
        businessLicense: result.businessLicense,
        taxIdUrl: result.taxIdUrl,
        otherDocs: result.otherDocs,
        verificationStatus: result.verificationStatus,
        rejectionReason: result.rejectionReason,
        submittedAt: result.submittedAt,
        updatedAt: result.updatedAt,
      },
      clinicManager: {
        accountId: result.managerAccountId,
        fullName: result.managerName,
        email: result.managerEmail,
        phone: result.managerPhone,
        clinicBranchName: result.clinicBranchName,
        gender: result.managerGender,
        profilePicture: result.managerProfilePicture,
        accountStatus: result.managerAccountStatus,
        address: result.managerAddress
          ? {
              address: result.managerAddress,
              ward: result.managerWard,
              wardName: result.managerWardName,
              district: result.managerDistrict,
              districtName: result.managerDistrictName,
              province: result.managerProvince,
              provinceName: result.managerProvinceName,
            }
          : null,
      },
      clinicAdmin: {
        accountId: result.adminAccountId,
        email: result.adminEmail,
        phone: result.adminPhone,
        clinicName: result.clinicName,
        clinicPhone: result.clinicPhone,
        description: result.clinicDescription,
      },
    };
  }

  // ============================================
  // Clinic Admins with Managers
  // ============================================

  /**
   * Get list of ACTIVE clinic admins with their clinic managers and legal doc statuses
   * OPTIMIZED: Uses single LEFT JOIN query instead of N+1 Promise.all
   */
  async getClinicAdminsWithManagers(
    page: number = 1,
    limit: number = 10,
  ): Promise<any> {
    const skip = (page - 1) * limit;

    // Count total admins first (without managers subquery for pagination)
    const totalResult = await this.accountRepository
      .createQueryBuilder('admin')
      .where('admin.role = :role', { role: AccountRole.CLINIC_ADMIN })
      .andWhere('admin.status = :status', { status: AccountStatus.ACTIVE })
      .getCount();

    // Fetch admins with their managers in a single LEFT JOIN query
    const rawData = await this.accountRepository
      .createQueryBuilder('admin')
      .leftJoin(
        'clinic_admin_information',
        'clinicAdminInfo',
        'clinicAdminInfo.account_id = admin._id',
      )
      .leftJoin(
        'accounts',
        'manager',
        'manager.parent_id = admin._id AND manager.role = :managerRole AND manager.deleted_at IS NULL',
        { managerRole: AccountRole.CLINIC_MANAGER },
      )
      .leftJoin(
        'clinic_manager_information',
        'managerInfo',
        'managerInfo.account_id = manager._id',
      )
      .leftJoin(
        'clinics_legal_documents',
        'legalDocs',
        'legalDocs.account_id = manager._id AND legalDocs.verification_status = :docStatus',
        { docStatus: LegalDocumentVerificationStatus.APPROVED },
      )
      .where('admin.role = :role', { role: AccountRole.CLINIC_ADMIN })
      .andWhere('admin.status = :status', { status: AccountStatus.ACTIVE })
      .andWhere('admin.deleted_at IS NULL')
      .select([
        'admin._id as "adminAccountId"',
        'admin.email as "adminEmail"',
        'clinicAdminInfo.clinic_name as "clinicName"',
        'manager._id as "managerAccountId"',
        'manager.email as "managerEmail"',
        'manager.status as "managerAccountStatus"',
        'managerInfo.full_name as "managerFullName"',
        'managerInfo.clinic_branch_name as "clinicBranchName"',
        'legalDocs._id as "legalDocumentId"',
        'legalDocs.verification_status as "verificationStatus"',
        'legalDocs.rejection_reason as "rejectionReason"',
        'legalDocs.created_at as "submittedAt"',
      ])
      .orderBy('admin.created_at', 'DESC')
      .offset(skip)
      .limit(limit)
      .getRawMany();

    // Group managers by admin in memory
    const adminMap = new Map<string, {
      adminAccountId: string;
      adminEmail: string | null;
      clinicName: string;
      managers: Array<{
        accountId: string;
        email: string | null;
        accountStatus: string;
        fullName: string;
        clinicBranchName: string;
        legalDocumentId: string | null;
        verificationStatus: string | null;
        rejectionReason: string | null;
        submittedAt: Date | null;
      }>;
    }>();

    for (const row of rawData) {
      if (!adminMap.has(row.adminAccountId)) {
        adminMap.set(row.adminAccountId, {
          adminAccountId: row.adminAccountId,
          adminEmail: row.adminEmail,
          clinicName: row.clinicName || '',
          managers: [],
        });
      }

      // Only add manager if exists (LEFT JOIN can return NULL)
      if (row.managerAccountId) {
        adminMap.get(row.adminAccountId)!.managers.push({
          accountId: row.managerAccountId,
          email: row.managerEmail,
          accountStatus: row.managerAccountStatus,
          fullName: row.managerFullName || row.managerEmail || 'Unknown',
          clinicBranchName: row.clinicBranchName || '',
          legalDocumentId: row.legalDocumentId,
          verificationStatus: row.verificationStatus,
          rejectionReason: row.rejectionReason,
          submittedAt: row.submittedAt,
        });
      }
    }

    const totalItems = totalResult;
    return {
      data: Array.from(adminMap.values()),
      meta: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  // ============================================
  // Approve Legal Document
  // ============================================

  /**
   * Approve a clinic manager legal document
   * Sets doc status → APPROVED, manager account status → ACTIVE
   */
  async approveDocument(legalDocId: string): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const legalDoc = await this.clinicRepo.findOne({
        where: { _id: legalDocId },
        relations: ['account'],
      });

      if (!legalDoc) {
        throw new NotFoundException('Legal document not found');
      }

      if (
        legalDoc.verificationStatus !==
        LegalDocumentVerificationStatus.PENDING_REVIEW
      ) {
        throw new BadRequestException(
          'Legal document is not in PENDING_REVIEW status',
        );
      }

      // Update legal doc status
      legalDoc.verificationStatus = LegalDocumentVerificationStatus.APPROVED;
      legalDoc.rejectionReason = null;
      await queryRunner.manager.save(ClinicsLegalDocuments, legalDoc);

      // Activate the clinic manager account
      if (legalDoc.account) {
        legalDoc.account.status = AccountStatus.ACTIVE;
        await queryRunner.manager.save(Account, legalDoc.account);
      }

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Legal document approved and clinic manager account activated',
        data: {
          legalDocumentId: legalDoc._id,
          managerAccountId: legalDoc.accountId,
          newDocStatus: LegalDocumentVerificationStatus.APPROVED,
          newAccountStatus: AccountStatus.ACTIVE,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ============================================
  // Reject Legal Document
  // ============================================

  /**
   * Reject a clinic manager legal document
   * Sets doc status → REJECTED with reason
   */
  async rejectDocument(legalDocId: string, reason: string): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const legalDoc = await this.clinicRepo.findOne({
        where: { _id: legalDocId },
      });

      if (!legalDoc) {
        throw new NotFoundException('Legal document not found');
      }

      if (
        legalDoc.verificationStatus !==
        LegalDocumentVerificationStatus.PENDING_REVIEW
      ) {
        throw new BadRequestException(
          'Legal document is not in PENDING_REVIEW status',
        );
      }

      // Update legal doc status
      legalDoc.verificationStatus = LegalDocumentVerificationStatus.REJECTED;
      legalDoc.rejectionReason = reason;
      await queryRunner.manager.save(ClinicsLegalDocuments, legalDoc);

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Legal document rejected',
        data: {
          legalDocumentId: legalDoc._id,
          managerAccountId: legalDoc.accountId,
          newDocStatus: LegalDocumentVerificationStatus.REJECTED,
          rejectionReason: reason,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ============================================
  // Rejected Legal Documents
  // ============================================

  /**
   * Get rejected clinic manager legal documents
   */
  async getRejectedDocuments(
    page: number = 1,
    limit: number = 10,
  ): Promise<any> {
    const skip = (page - 1) * limit;

    const queryBuilder = this.clinicRepo
      .createQueryBuilder('legalDocs')
      .leftJoin('legalDocs.account', 'managerAccount')
      .leftJoin(
        'accounts',
        'adminAccount',
        'adminAccount._id = managerAccount.parent_id',
      )
      .leftJoin(
        'clinic_admin_information',
        'clinicInfo',
        'clinicInfo.account_id = adminAccount._id',
      )
      .leftJoin(
        'clinic_manager_information',
        'managerInfo',
        'managerInfo.account_id = managerAccount._id',
      )
      .where('legalDocs.verification_status = :status', {
        status: LegalDocumentVerificationStatus.REJECTED,
      })
      .andWhere('adminAccount.status = :adminStatus', {
        adminStatus: AccountStatus.ACTIVE,
      })
      .andWhere('managerAccount.role = :role', {
        role: AccountRole.CLINIC_MANAGER,
      })
      .andWhere(
        `(SELECT COUNT(*) FROM accounts m WHERE m.parent_id = adminAccount._id AND m.role = '${AccountRole.CLINIC_MANAGER}') > 1`,
      )
      .select([
        'legalDocs._id as "id"',
        'clinicInfo.clinic_name as "clinicName"',
        'managerInfo.clinic_branch_name as "clinicBranchName"',
        'managerInfo.full_name as "managerName"',
        'managerAccount.email as "managerEmail"',
        'adminAccount.email as "adminEmail"',
        'legalDocs.rejection_reason as "rejectionReason"',
        'legalDocs.updated_at as "rejectedAt"',
      ])
      .orderBy('legalDocs.updated_at', 'DESC')
      .offset(skip)
      .limit(limit);

    const data = await queryBuilder.getRawMany();

    const totalItems = await this.clinicRepo
      .createQueryBuilder('legalDocs')
      .leftJoin('legalDocs.account', 'managerAccount')
      .leftJoin(
        'accounts',
        'adminAccount',
        'adminAccount._id = managerAccount.parent_id',
      )
      .where('legalDocs.verification_status = :status', {
        status: LegalDocumentVerificationStatus.REJECTED,
      })
      .andWhere('adminAccount.status = :adminStatus', {
        adminStatus: AccountStatus.ACTIVE,
      })
      .andWhere('managerAccount.role = :role', {
        role: AccountRole.CLINIC_MANAGER,
      })
      .andWhere(
        `(SELECT COUNT(*) FROM accounts m WHERE m.parent_id = adminAccount._id AND m.role = '${AccountRole.CLINIC_MANAGER}') > 1`,
      )
      .getCount();

    return {
      data,
      meta: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }
}
