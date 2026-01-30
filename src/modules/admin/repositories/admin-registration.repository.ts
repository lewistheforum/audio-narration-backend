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
  RegistrationListItemDto,
  RegistrationDetailResponseDto,
  ClinicAdminInfoDto,
  ClinicManagerInfoDto,
  LegalDocumentsInfoDto,
  SubscriptionInfoDto,
} from '../dto';

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
   * Find pending approvals with pagination
   *
   * Returns clinic admin accounts with PENDING_APPROVAL status
   */
  async findPendingApprovals(
    page: number,
    limit: number,
  ): Promise<[RegistrationListItemDto[], number]> {
    const skip = (page - 1) * limit;

    // Query to find clinic admin accounts with pending approval status
    const queryBuilder = this.accountRepository
      .createQueryBuilder('account')
      .leftJoinAndSelect('account.clinicAdminInformation', 'clinicAdminInfo')
      .leftJoinAndSelect('account.children', 'childAccounts')
      .leftJoinAndSelect('childAccounts.clinicManagerInformation', 'clinicManagerInfo')
      .leftJoinAndSelect('childAccounts.clinicManagerInformation', 'managerInfo')
      .leftJoin(
        'clinic_subcriptions',
        'subscription',
        'subscription.clinic_id = account._id',
      )
      .where('account.role = :role', { role: AccountRole.CLINIC_ADMIN })
      .andWhere('subscription.subscription_status = :status', {
        status: RegistrationStatus.PENDING_APPROVAL,
      })
      .leftJoin(
        'clinics_legal_documents',
        'legalDocs',
        'legalDocs.account_id = childAccounts._id',
      )
      .addSelect([
        'account._id',
        'account.email',
        'account.phone',
        'account.createdAt',
        'clinicAdminInfo.clinicName',
        'legalDocs.verificationStatus',
        'subscription.subscriptionStatus',
      ])
      .orderBy('account.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [accounts, total] = await queryBuilder.getManyAndCount();

    // Map to DTOs
    const items: RegistrationListItemDto[] = accounts.map((account) => {
      const subscription = account.children?.find(
        (child) =>
          child.clinicManagerInformation &&
          child.clinicManagerInformation.accountId === child._id,
      );

      const legalDocs = subscription?.clinicManagerInformation
        ? null
        : null;

      return {
        clinicAdminId: account._id,
        clinicName: account.clinicAdminInformation?.clinicName || '',
        email: account.email,
        phone: account.phone || '',
        legalDocsStatus: legalDocs?.verificationStatus || 'NOT_SUBMITTED',
        status: RegistrationStatus.PENDING_APPROVAL,
        submittedAt: account.createdAt,
      };
    });

    return [items, total];
  }

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
      .leftJoinAndSelect(
        'childAccounts.clinicManagerInformation',
        'clinicManagerInfo',
      )
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
    };

    const clinicManager: ClinicManagerInfoDto = {
      accountId: clinicManagerAccount._id,
      fullName: clinicManagerAccount.clinicManagerInformation?.fullName || '',
      email: clinicManagerAccount.email,
      phone: clinicManagerAccount.phone || '',
      clinicBranchName:
        clinicManagerAccount.clinicManagerInformation?.clinicBranchName || '',
    };

    const legalDocuments: LegalDocumentsInfoDto = {
      managerAccountId: legalDocs.accountId,
      operatingLicense: legalDocs.operatingLicense || '',
      businessLicense: legalDocs.businessLicense || '',
      taxIdUrl: legalDocs.taxIdUrl,
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
}
