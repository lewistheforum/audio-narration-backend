import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../../accounts/entities/accounts.entity';
import { ClinicAdminInformation } from '../../accounts/entities/clinic-admin-information.entity';
import { ClinicManagerInformation } from '../../accounts/entities/clinic_manager_information.entity';
import { ClinicsLegalDocuments } from '../../accounts/entities/clinics_legal_documents.entity';
import { ClinicSubscription } from '../../subscriptions/entities/clinic-subscription.entity';
import { AccountRole } from '../../accounts/enums/account-role.enum';
import { RegistrationStatus } from '../../subscriptions/enums/subscription-status.enum';
import {
  RegistrationDetailResponseDto,
  ClinicAdminInfoDto,
  ClinicManagerInfoDto,
  LegalDocumentsInfoDto,
  SubscriptionInfoDto,
} from '../dto';
import { LegalDocumentVerificationStatus } from 'src/modules/accounts/enums';
import { getVietnamTimestamp } from '../../../common/utils/date.util';

/**
 * Admin Registration Repository
 *
 * Handles data access for admin approval operations
 */
@Injectable()
export class AdminRegistrationRepository {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(ClinicAdminInformation)
    private readonly clinicAdminInfoRepository: Repository<ClinicAdminInformation>,
    @InjectRepository(ClinicManagerInformation)
    private readonly clinicManagerInfoRepository: Repository<ClinicManagerInformation>,
    @InjectRepository(ClinicsLegalDocuments)
    private readonly legalDocumentsRepository: Repository<ClinicsLegalDocuments>,
    @InjectRepository(ClinicSubscription)
    private readonly clinicSubscriptionRepository: Repository<ClinicSubscription>,
  ) {}

  /**
   * Find registration details by clinic admin ID
   *
   * Returns full registration details including clinic admin, manager, legal docs, and subscription
   */
  async findRegistrationById(
    clinicAdminId: string,
  ): Promise<RegistrationDetailResponseDto | null> {
    // Find clinic admin account with all related data
    const account = await this.accountRepository
      .createQueryBuilder('account')
      .leftJoinAndSelect('account.clinicAdminInformation', 'clinicAdminInfo')
      .leftJoinAndSelect('account.children', 'childAccounts')
      .leftJoinAndSelect('account.addresses', 'adminAddresses')
      .leftJoinAndSelect(
        'childAccounts.clinicManagerInformation',
        'clinicManagerInfo',
      )
      .leftJoinAndSelect('childAccounts.addresses', 'managerAddresses')
      .leftJoinAndSelect(
        'clinic_subcriptions',
        'subscription',
        'subscription.clinic_id = account._id',
      )
      .leftJoinAndSelect(
        'clinics_legal_documents',
        'legalDocs',
        'legalDocs.account_id = childAccounts._id',
      )
      .where('account._id = :id', { id: clinicAdminId })
      .andWhere('account.role = :role', { role: AccountRole.CLINIC_ADMIN })
      .getOne();

    if (!account) {
      return null;
    }

    // Find the clinic manager (child account)
    const clinicManagerAccount = account.children?.find(
      (child) => child.role === AccountRole.CLINIC_MANAGER,
    );

    if (!clinicManagerAccount) {
      return null;
    }

    // Find legal documents for the clinic manager
    const legalDocs = await this.legalDocumentsRepository.findOne({
      where: { accountId: clinicManagerAccount._id },
    });

    if (!legalDocs) {
      return null;
    }

    // Find subscription
    const subscription = await this.clinicSubscriptionRepository.findOne({
      where: { clinicId: account._id },
    });

    if (!subscription) {
      return null;
    }

    // Map to DTOs
    const clinicAdmin: ClinicAdminInfoDto = {
      accountId: account._id,
      username: account.username,
      email: account.email,
      phone: account.phone || '',
      clinicName: account.clinicAdminInformation?.clinicName || '',
      description: account.clinicAdminInformation?.description,
      specializedIn: account.clinicAdminInformation?.specializedIn,
      dob: account.clinicAdminInformation?.dob,
      profilePicture: account.clinicAdminInformation?.profilePicture,
      bankName: account.clinicAdminInformation?.bankName,
      bankNumber: account.clinicAdminInformation?.bankNumber,
      bankBranch: account.clinicAdminInformation?.bankBranch,
      sepayVa: account.clinicAdminInformation?.sepayVa,
      isVerify: account.clinicAdminInformation?.isVerify,
      pros: account.clinicAdminInformation?.pros,
      paraclinical: account.clinicAdminInformation?.paraclinical,
      address:
        account.addresses && account.addresses.length > 0
          ? {
              address: account.addresses[0].address,
              ward: account.addresses[0].ward,
              wardName: account.addresses[0].wardName,
              district: account.addresses[0].district,
              districtName: account.addresses[0].districtName,
              province: account.addresses[0].province,
              provinceName: account.addresses[0].provinceName,
            }
          : undefined,
    };

    const clinicManager: ClinicManagerInfoDto = {
      accountId: clinicManagerAccount._id,
      fullName: clinicManagerAccount.clinicManagerInformation?.fullName || '',
      email: clinicManagerAccount.email,
      phone: clinicManagerAccount.phone || '',
      clinicBranchName:
        clinicManagerAccount.clinicManagerInformation?.clinicBranchName || '',
      address:
        clinicManagerAccount.addresses &&
        clinicManagerAccount.addresses.length > 0
          ? {
              address: clinicManagerAccount.addresses[0].address,
              ward: clinicManagerAccount.addresses[0].ward,
              wardName: clinicManagerAccount.addresses[0].wardName,
              district: clinicManagerAccount.addresses[0].district,
              districtName: clinicManagerAccount.addresses[0].districtName,
              province: clinicManagerAccount.addresses[0].province,
              provinceName: clinicManagerAccount.addresses[0].provinceName,
            }
          : undefined,
    };

    const legalDocuments: LegalDocumentsInfoDto = {
      managerAccountId: legalDocs.accountId,
      operatingLicense: legalDocs.operatingLicense || '',
      businessLicense: legalDocs.businessLicense || '',
      taxIdUrl: legalDocs.taxIdUrl,
      otherDocs: legalDocs.otherDocs,
      rejectionReason: legalDocs.rejectionReason,
      verificationStatus: legalDocs.verificationStatus,
    };

    const subscriptionInfo: SubscriptionInfoDto = {
      id: subscription._id,
      serviceId: subscription.serviceId,
      subscriptionStatus: subscription.subscriptionStatus,
      subscriptionDate: subscription.subscriptionDate,
      expirationDate: subscription.expirationDate,
    };

    return {
      clinicAdmin,
      clinicManager,
      legalDocuments,
      subscription: subscriptionInfo,
    };
  }

  /**
   * Find clinic admin account by ID
   */
  async findClinicAdminById(clinicAdminId: string): Promise<Account | null> {
    return this.accountRepository.findOne({
      where: { _id: clinicAdminId },
    });
  }

  /**
   * Find clinic subscription by clinic ID
   */
  async findSubscriptionByClinicId(
    clinicId: string,
  ): Promise<ClinicSubscription | null> {
    return this.clinicSubscriptionRepository.findOne({
      where: { clinicId },
    });
  }

  /**
   * Find legal documents by manager account ID
   */
  async findLegalDocumentsByManagerId(
    managerAccountId: string,
  ): Promise<ClinicsLegalDocuments | null> {
    return this.legalDocumentsRepository.findOne({
      where: { accountId: managerAccountId },
    });
  }

  /**
   * Find pending legal documents with pagination
   *
   * Returns legal documents with status PENDING_REVIEW
   */
  async findPendingLegalDocuments(
    page: number,
    limit: number,
    sortBy: string = 'createdAt',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
  ): Promise<[any[], number]> {
    const skip = (page - 1) * limit;

    const queryBuilder = this.legalDocumentsRepository
      .createQueryBuilder('legalDocs')
      .leftJoinAndSelect('legalDocs.account', 'managerAccount')
      .leftJoin(
        'accounts',
        'adminAccount',
        'adminAccount._id = managerAccount.parent_id',
      )
      .leftJoinAndSelect('adminAccount.clinicAdminInformation', 'clinicInfo')
      .leftJoin(
        'clinic_subcriptions',
        'subscription',
        'subscription.clinic_id = adminAccount._id',
      )
      .where('legalDocs.verification_status = :status', {
        status: 'PENDING_REVIEW',
      })
      .select([
        'adminAccount._id as "id"',
        'legalDocs._id as "legalDocumentId"',
        'subscription._id as "subscriptionId"',
        'clinicInfo.clinic_name as "clinicName"',
        'managerAccount.email as "managerEmail"',
        'adminAccount.email as "adminEmail"',
        'legalDocs.operating_license as "operatingLicense"',
        'legalDocs.business_license as "businessLicense"',
        'legalDocs.created_at as "submittedAt"',
      ])
      .orderBy(
        `legalDocs.${sortBy === 'clinicName' ? 'created_at' : sortBy}`,
        sortOrder,
      )
      .offset(skip)
      .limit(limit);

    const [data, total] = await Promise.all([
      queryBuilder.getRawMany(),
      this.legalDocumentsRepository.count({
        where: {
          verificationStatus: LegalDocumentVerificationStatus.PENDING_REVIEW,
        },
      }),
    ]);

    return [data, total];
  }

  /**
   * Find approved legal documents with pagination
   */
  async findApprovedLegalDocuments(
    page: number,
    limit: number,
    sortBy: string = 'createdAt',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
  ): Promise<[any[], number]> {
    const skip = (page - 1) * limit;

    const queryBuilder = this.legalDocumentsRepository
      .createQueryBuilder('legalDocs')
      .leftJoinAndSelect('legalDocs.account', 'managerAccount')
      .leftJoin(
        'accounts',
        'adminAccount',
        'adminAccount._id = managerAccount.parent_id',
      )
      .leftJoinAndSelect('adminAccount.clinicAdminInformation', 'clinicInfo')
      .leftJoin(
        'clinic_subcriptions',
        'subscription',
        'subscription.clinic_id = adminAccount._id',
      )
      .where('legalDocs.verification_status = :status', { status: 'APPROVED' })
      .select([
        'adminAccount._id as "id"',
        'legalDocs._id as "legalDocumentId"',
        'subscription._id as "subscriptionId"',
        'clinicInfo.clinic_name as "clinicName"',
        'managerAccount.email as "managerEmail"',
        'adminAccount.email as "adminEmail"',
        'legalDocs.updated_at as "approvedAt"',
      ])
      .orderBy(
        `legalDocs.${sortBy === 'clinicName' ? 'updated_at' : sortBy}`,
        sortOrder,
      )
      .offset(skip)
      .limit(limit);

    const [data, total] = await Promise.all([
      queryBuilder.getRawMany(),
      this.legalDocumentsRepository.count({
        where: { verificationStatus: LegalDocumentVerificationStatus.APPROVED },
      }),
    ]);

    return [data, total];
  }

  /**
   * Find rejected legal documents with pagination
   */
  async findRejectedLegalDocuments(
    page: number,
    limit: number,
    sortBy: string = 'createdAt',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
  ): Promise<[any[], number]> {
    const skip = (page - 1) * limit;

    const queryBuilder = this.legalDocumentsRepository
      .createQueryBuilder('legalDocs')
      .leftJoinAndSelect('legalDocs.account', 'managerAccount')
      .leftJoin(
        'accounts',
        'adminAccount',
        'adminAccount._id = managerAccount.parent_id',
      )
      .leftJoinAndSelect('adminAccount.clinicAdminInformation', 'clinicInfo')
      .leftJoin(
        'clinic_subcriptions',
        'subscription',
        'subscription.clinic_id = adminAccount._id',
      )
      .where('legalDocs.verification_status = :status', { status: 'REJECTED' })
      .select([
        'adminAccount._id as "id"',
        'legalDocs._id as "legalDocumentId"',
        'subscription._id as "subscriptionId"',
        'clinicInfo.clinic_name as "clinicName"',
        'managerAccount.email as "managerEmail"',
        'adminAccount.email as "adminEmail"',
        'legalDocs.rejection_reason as "rejectionReason"',
        'legalDocs.updated_at as "rejectedAt"',
      ])
      .orderBy(
        `legalDocs.${sortBy === 'clinicName' ? 'updated_at' : sortBy}`,
        sortOrder,
      )
      .offset(skip)
      .limit(limit);

    const [data, total] = await Promise.all([
      queryBuilder.getRawMany(),
      this.legalDocumentsRepository.count({
        where: { verificationStatus: LegalDocumentVerificationStatus.REJECTED },
      }),
    ]);

    return [data, total];
  }

  /**
   * Find not submitted registrations with pagination
   */
  async findNotSubmittedRegistrations(
    page: number,
    limit: number,
    sortBy: string = 'createdAt',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
  ): Promise<[any[], number]> {
    const skip = (page - 1) * limit;

    // Find accounts with legal docs status NOT_SUBMITTED or no legal docs at all
    const queryBuilder = this.accountRepository
      .createQueryBuilder('adminAccount')
      .leftJoinAndSelect('adminAccount.clinicAdminInformation', 'clinicInfo')
      .leftJoin('adminAccount.children', 'managerAccount')
      .leftJoin(
        'clinics_legal_documents',
        'legalDocs',
        'legalDocs.account_id = managerAccount._id',
      )
      .leftJoin(
        'clinic_subcriptions',
        'subscription',
        'subscription.clinic_id = adminAccount._id',
      )
      .where('adminAccount.role = :role', { role: AccountRole.CLINIC_ADMIN })
      .andWhere(
        '(legalDocs.verification_status = :status OR legalDocs._id IS NULL)',
        {
          status: 'NOT_SUBMITTED',
        },
      )
      .select([
        'adminAccount._id as "id"',
        'clinicInfo.clinic_name as "clinicName"',
        'adminAccount.email as "adminEmail"',
        'managerAccount.email as "managerEmail"',
        'adminAccount.created_at as "registrationDate"',
        'subscription.subscription_status as "currentStatus"',
      ])
      .orderBy(
        `adminAccount.${sortBy === 'clinicName' ? 'created_at' : sortBy}`,
        sortOrder,
      )
      .offset(skip)
      .limit(limit);

    const data = await queryBuilder.getRawMany();

    // Calculate days since registration
    const enrichedData = data.map((item) => ({
      ...item,
      daysSinceRegistration: Math.floor(
        (getVietnamTimestamp() - new Date(item.registrationDate).getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    }));

    // Count total
    const countQuery = this.accountRepository
      .createQueryBuilder('adminAccount')
      .leftJoin('adminAccount.children', 'managerAccount')
      .leftJoin(
        'clinics_legal_documents',
        'legalDocs',
        'legalDocs.account_id = managerAccount._id',
      )
      .where('adminAccount.role = :role', { role: AccountRole.CLINIC_ADMIN })
      .andWhere(
        '(legalDocs.verification_status = :status OR legalDocs._id IS NULL)',
        {
          status: 'NOT_SUBMITTED',
        },
      );

    const total = await countQuery.getCount();

    return [enrichedData, total];
  }
}
