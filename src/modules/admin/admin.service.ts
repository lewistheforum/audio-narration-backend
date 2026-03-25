import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { subtractFromVietnamTime } from 'src/common/utils/date.util';
import { AdminRegistrationRepository } from './repositories/admin-registration.repository';
import { ClinicsLegalDocumentsRepository } from '../accounts/repositories/clinics-legal-documents.repository';
import { ClinicSubscriptionRepository } from '../subscriptions/repositories/clinic-subscription.repository';
import { ClinicAdminInformationRepository } from '../accounts/repositories';
import { MailerService } from '../mailer/mailer.service';
import { Account } from '../accounts/entities/accounts.entity';
import { AccountRole } from '../accounts/enums/account-role.enum';
import { AccountStatus } from '../accounts/enums/account-status.enum';
import { RegistrationDetailResponseDto } from './dto';
import { LegalDocumentVerificationStatus } from '../accounts/enums/legal-document-verification-status.enum';
import { RegistrationStatus } from '../subscriptions/enums/subscription-status.enum';
import { ClinicsLegalDocuments } from '../accounts/entities/clinics_legal_documents.entity';
import { ClinicSubscription } from '../subscriptions/entities/clinic-subscription.entity';
import {
  Address,
  ClinicAdminInformation,
  ClinicManagerInformation,
  CodeVerification,
  GoogleIframe,
} from '../accounts/entities';
import { API } from 'src/common/utils/ai-api';

/**
 * Admin Service
 *
 * Business logic for admin approval operations
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly adminRegistrationRepository: AdminRegistrationRepository,
    private readonly legalDocumentsRepository: ClinicsLegalDocumentsRepository,
    private readonly clinicSubscriptionRepository: ClinicSubscriptionRepository,
    private readonly clinicAdminInfoRepository: ClinicAdminInformationRepository,
    private readonly mailerService: MailerService,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Get registration details by clinic admin ID
   *
   * Returns full registration details for a specific clinic
   */
  async getRegistrationById(
    clinicAdminId: string,
  ): Promise<RegistrationDetailResponseDto> {
    const registration =
      await this.adminRegistrationRepository.findRegistrationById(
        clinicAdminId,
      );

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    return registration;
  }

  /**
   * Get pending legal documents (status: PENDING_REVIEW)
   */
  async getPendingLegalDocuments(
    page: number = 1,
    limit: number = 10,
    sortBy: string = 'createdAt',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
  ): Promise<any> {
    const [data, totalItems] =
      await this.adminRegistrationRepository.findPendingLegalDocuments(
        page,
        limit,
        sortBy,
        sortOrder,
      );

    const totalPages = Math.ceil(totalItems / limit);

    return {
      data,
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
      },
    };
  }

  /**
   * Get approved legal documents (status: APPROVED)
   */
  async getApprovedLegalDocuments(
    page: number = 1,
    limit: number = 10,
    sortBy: string = 'createdAt',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
  ): Promise<any> {
    const [data, totalItems] =
      await this.adminRegistrationRepository.findApprovedLegalDocuments(
        page,
        limit,
        sortBy,
        sortOrder,
      );

    const totalPages = Math.ceil(totalItems / limit);

    return {
      data,
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
      },
    };
  }

  /**
   * Get rejected legal documents (status: REJECTED)
   */
  async getRejectedLegalDocuments(
    page: number = 1,
    limit: number = 10,
    sortBy: string = 'createdAt',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
  ): Promise<any> {
    const [data, totalItems] =
      await this.adminRegistrationRepository.findRejectedLegalDocuments(
        page,
        limit,
        sortBy,
        sortOrder,
      );

    const totalPages = Math.ceil(totalItems / limit);

    return {
      data,
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
      },
    };
  }

  /**
   * Get not submitted registrations (status: NOT_SUBMITTED or no legal docs)
   */
  async getNotSubmittedRegistrations(
    page: number = 1,
    limit: number = 10,
    sortBy: string = 'createdAt',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
  ): Promise<any> {
    const [data, totalItems] =
      await this.adminRegistrationRepository.findNotSubmittedRegistrations(
        page,
        limit,
        sortBy,
        sortOrder,
      );

    const totalPages = Math.ceil(totalItems / limit);

    return {
      data,
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
      },
    };
  }

  /**
   * Approve registration by subscription ID
   */
  async approveRegistrationBySubscriptionId(
    subscriptionId: string,
  ): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Find subscription
      const subscription =
        await this.clinicSubscriptionRepository.findById(subscriptionId);

      if (!subscription) {
        throw new NotFoundException('Subscription not found');
      }

      // Validate status
      if (
        subscription.subscriptionStatus !== RegistrationStatus.PENDING_APPROVAL
      ) {
        throw new BadRequestException(
          'Subscription is not in PENDING_APPROVAL status',
        );
      }

      // Find clinic admin
      const clinicAdmin = await this.accountRepository.findOne({
        where: { _id: subscription.clinicId },
        relations: ['children', 'clinicAdminInformation'],
      });

      if (!clinicAdmin) {
        throw new NotFoundException('Clinic admin not found');
      }

      // Find manager
      const clinicManager = clinicAdmin.children?.find(
        (child) => child.role === AccountRole.CLINIC_MANAGER,
      );

      if (!clinicManager) {
        throw new NotFoundException('Clinic manager not found');
      }

      // Find legal docs
      const legalDocs = await this.legalDocumentsRepository.findByAccountId(
        clinicManager._id,
      );

      if (!legalDocs) {
        throw new NotFoundException('Legal documents not found');
      }

      if (
        legalDocs.verificationStatus !==
        LegalDocumentVerificationStatus.PENDING_REVIEW
      ) {
        throw new BadRequestException(
          'Legal documents are not in PENDING_REVIEW status',
        );
      }

      // Update legal docs
      legalDocs.verificationStatus = LegalDocumentVerificationStatus.APPROVED;
      legalDocs.rejectionReason = null;
      await queryRunner.manager.save(ClinicsLegalDocuments, legalDocs);

      // Update Manager Account status to ACTIVE
      clinicManager.status = AccountStatus.ACTIVE;
      await queryRunner.manager.save(Account, clinicManager);

      // Update subscription
      subscription.subscriptionStatus = RegistrationStatus.PENDING_PAYMENT;
      await queryRunner.manager.save(ClinicSubscription, subscription);

      await queryRunner.commitTransaction();

      // Send email
      const clinicName = clinicAdmin.clinicAdminInformation?.clinicName || '';
      let emailSent = true;

      try {
        await this.mailerService.sendRegistrationApprovedEmail(
          clinicAdmin.email,
          clinicName,
        );
      } catch (error) {
        console.error('Failed to send approval email:', error);
        emailSent = false;
      }

      return {
        success: true,
        message: 'Registration approved successfully',
        data: {
          subscriptionId: subscription._id,
          clinicName,
          newStatus: 'PENDING_PAYMENT',
          emailSent,
          nextStep: 'PAYMENT',
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Reject registration by subscription ID
   */
  async rejectRegistrationBySubscriptionId(
    subscriptionId: string,
    reason: string,
  ): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Find subscription
      const subscription =
        await this.clinicSubscriptionRepository.findById(subscriptionId);

      if (!subscription) {
        throw new NotFoundException('Subscription not found');
      }

      // Validate status
      if (
        subscription.subscriptionStatus !== RegistrationStatus.PENDING_APPROVAL
      ) {
        throw new BadRequestException(
          'Subscription is not in PENDING_APPROVAL status',
        );
      }

      // Find clinic admin
      const clinicAdmin = await this.accountRepository.findOne({
        where: { _id: subscription.clinicId },
        relations: ['children', 'clinicAdminInformation'],
      });

      if (!clinicAdmin) {
        throw new NotFoundException('Clinic admin not found');
      }

      // Find manager
      const clinicManager = clinicAdmin.children?.find(
        (child) => child.role === AccountRole.CLINIC_MANAGER,
      );

      if (!clinicManager) {
        throw new NotFoundException('Clinic manager not found');
      }

      // Find legal docs
      const legalDocs = await this.legalDocumentsRepository.findByAccountId(
        clinicManager._id,
      );

      if (!legalDocs) {
        throw new NotFoundException('Legal documents not found');
      }

      if (
        legalDocs.verificationStatus !==
        LegalDocumentVerificationStatus.PENDING_REVIEW
      ) {
        throw new BadRequestException(
          'Legal documents are not in PENDING_REVIEW status',
        );
      }

      // Update legal docs
      legalDocs.verificationStatus = LegalDocumentVerificationStatus.REJECTED;
      legalDocs.rejectionReason = reason;
      await queryRunner.manager.save(ClinicsLegalDocuments, legalDocs);

      // Ensure Manager Account remains in PENDING_APPROVAL state
      clinicManager.status = AccountStatus.PENDING_APPROVAL;
      await queryRunner.manager.save(Account, clinicManager);

      // IMPORTANT: Revert to PENDING_LEGAL_SETUP to allow resubmission
      subscription.subscriptionStatus = RegistrationStatus.PENDING_LEGAL_SETUP;
      await queryRunner.manager.save(ClinicSubscription, subscription);

      await queryRunner.commitTransaction();

      // Send email
      const clinicName = clinicAdmin.clinicAdminInformation?.clinicName || '';
      let emailSent = true;

      try {
        await this.mailerService.sendRegistrationRejectedEmail(
          clinicAdmin.email,
          reason,
          clinicName,
        );
      } catch (error) {
        console.error('Failed to send rejection email:', error);
        emailSent = false;
      }

      return {
        success: true,
        message: 'Registration rejected',
        data: {
          subscriptionId: subscription._id,
          clinicName,
          newStatus: 'PENDING_LEGAL_SETUP',
          rejectionReason: reason,
          emailSent,
          nextStep: 'RESUBMIT_DOCUMENTS',
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Sync Knowledge Base
   *
   * 1. Delete all records from knowledge_base
   * 2. Trigger sync on AI backend
   */
  async syncKnowledgeBase(): Promise<any> {
    // Step 1: Delete all current records in table knowledge base
    await this.dataSource.query('DELETE FROM knowledge_base');

    // Step 2: call api localhost:8080/api/v1/rag/knowledge-base/sync
    try {
      const response = await fetch(API.AI.SYNC_DATA, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clear_existing: false, // Already deleted above
          sync_clinic_services: true,
          sync_doctor_profiles: true,
          sync_clinic_info: true,
          sync_staff_info: true,
          sync_blogs: true,
          sync_feedbacks: true,
          sync_user_info: true,
          sync_doctor_schedules: true,
          sync_clinic_working_hours: true,
        }),
      });

      if (!response.ok) {
        throw new BadRequestException(
          `Failed to sync knowledge base: ${response.statusText}`,
        );
      }

      const responseData = (await response.json()) as any;
      const syncData = responseData.data;

      // Check if everything is 0
      if (
        syncData.clinic_services_synced === 0 &&
        syncData.doctor_profiles_synced === 0 &&
        syncData.clinic_info_synced === 0 &&
        syncData.staff_info_synced === 0 &&
        syncData.blogs_synced === 0 &&
        syncData.feedbacks_synced === 0 &&
        syncData.user_info_synced === 0 &&
        syncData.doctor_schedules_synced === 0 &&
        syncData.clinic_working_hours_synced === 0 &&
        syncData.total_synced === 0
      ) {
        return {
          statusCode: 1, // Warning indicator
          message:
            'Warning: Knowledge base sync failed or no data to sync (all counts are 0)',
          data: syncData,
        };
      }

      return {
        statusCode: 0,
        message: 'Knowledge base synced successfully',
        data: syncData,
      };
    } catch (error) {
      throw new BadRequestException(
        'Error calling AI sync API: ' + error.message,
      );
    }
  }

  async syncKnowledgeBaseMedicine(): Promise<any> {
    // Step 1: Delete all current records in table knowledge base
    await this.dataSource.query('DELETE FROM knowledge_base_medicines');

    // Step 2: call api localhost:8080/api/v1/rag/knowledge-base/sync-medicines
    try {
      const response = await fetch(API.AI.SYNC_DATA_MEDICINE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clear_existing: false, // Already deleted above
        }),
      });

      if (!response.ok) {
        throw new BadRequestException(
          `Failed to sync knowledge base: ${response.statusText}`,
        );
      }

      const responseData = (await response.json()) as any;
      const syncData = responseData.data;

      return {
        statusCode: 0,
        message: 'Knowledge base synced successfully',
        data: syncData,
      };
    } catch (error) {
      throw new BadRequestException(
        'Error calling AI sync API: ' + error.message,
      );
    }
  }

  /**
   * Cleanup stale pending registrations
   *
   * Finds clinic_subscriptions in pending statuses (PENDING_SEPAY_SETUP,
   * PENDING_MANAGER_SETUP, PENDING_LEGAL_SETUP, PENDING_APPROVAL, PENDING_PAYMENT)
   * where createdAt is more than 6 months ago.
   *
   * For each stale record:
   * 1. Send notification email to the clinic admin
   * 2. Delete all related records in a transaction
   *
   * Returns statistics about the cleanup operation.
   */
  async cleanupStaleRegistrations(): Promise<{
    totalStaleFound: number;
    emailsSentSuccessfully: number;
    emailsFailed: number;
    deletedSuccessfully: number;
    deletionsFailed: number;
    details: Array<{
      clinicAdminId: string;
      email: string;
      status: string;
      emailSent: boolean;
      deleted: boolean;
      error?: string;
    }>;
  }> {
    // Calculate the date 6 months ago
    const sixMonthsAgo = subtractFromVietnamTime(6, 'month');

    const pendingStatuses = [
      RegistrationStatus.PENDING_SEPAY_SETUP,
      RegistrationStatus.PENDING_MANAGER_SETUP,
      RegistrationStatus.PENDING_LEGAL_SETUP,
      RegistrationStatus.PENDING_APPROVAL,
      RegistrationStatus.PENDING_PAYMENT,
    ];

    // Step 1: Find all clinic subscriptions with pending statuses
    const staleSubscriptions = await this.dataSource
      .getRepository(ClinicSubscription)
      .find({
        where: pendingStatuses.map((status) => ({
          subscriptionStatus: status,
        })),
      });

    // Step 2: Filter to only those created more than 6 months ago
    const staleOldSubscriptions = staleSubscriptions.filter(
      (sub) => sub.createdAt < sixMonthsAgo,
    );

    const stats = {
      totalStaleFound: staleOldSubscriptions.length,
      emailsSentSuccessfully: 0,
      emailsFailed: 0,
      deletedSuccessfully: 0,
      deletionsFailed: 0,
      details: [] as Array<{
        clinicAdminId: string;
        email: string;
        status: string;
        emailSent: boolean;
        deleted: boolean;
        error?: string;
      }>,
    };

    // Step 3: For each stale subscription, use clinicId to find account and delete
    for (const subscription of staleOldSubscriptions) {
      const clinicId = subscription.clinicId;

      // Load account separately by clinicId
      const clinicAdmin = await this.accountRepository.findOne({
        where: { _id: clinicId },
        relations: ['clinicAdminInformation'],
      });

      if (!clinicAdmin) {
        stats.details.push({
          clinicAdminId: clinicId,
          email: 'unknown',
          status: subscription.subscriptionStatus,
          emailSent: false,
          deleted: false,
          error: 'Clinic admin account not found',
        });
        stats.deletionsFailed++;
        stats.emailsFailed++;
        continue;
      }

      const clinicName =
        clinicAdmin.clinicAdminInformation?.clinicName || clinicAdmin.username;
      const detail: (typeof stats.details)[0] = {
        clinicAdminId: clinicAdmin._id,
        email: clinicAdmin.email,
        status: subscription.subscriptionStatus,
        emailSent: false,
        deleted: false,
      };

      // Step 1: Send notification email BEFORE deletion
      try {
        await this.mailerService.sendStaleRegistrationDeletedEmail(
          clinicAdmin.email,
          clinicName,
          subscription.subscriptionStatus,
        );
        detail.emailSent = true;
        stats.emailsSentSuccessfully++;
      } catch (error) {
        detail.emailSent = false;
        stats.emailsFailed++;
        console.error(`Failed to send email to ${clinicAdmin.email}:`, error);
      }

      // Step 2: Delete all related records in a transaction
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Get all child accounts (clinic managers) under this clinic admin
        const childAccounts = await queryRunner.manager.find(Account, {
          where: { parentId: clinicId },
          select: ['_id'],
        });
        const childIds = childAccounts.map((c) => c._id);
        const allAccountIds = [clinicId, ...childIds];

        // 1. Delete google_iframes (via addresses)
        const addresses = await queryRunner.manager.find(Address, {
          where: { accountId: In(allAccountIds) },
          select: ['_id'],
        });
        if (addresses.length > 0) {
          const addressIds = addresses.map((a) => a._id);
          await queryRunner.manager.delete(GoogleIframe, {
            addressId: In(addressIds),
          });
        }

        // 2. Delete addresses
        await queryRunner.manager.delete(Address, {
          accountId: In(allAccountIds),
        });

        // 3. Delete clinic_admin_information
        await queryRunner.manager.delete(ClinicAdminInformation, {
          accountId: clinicId,
        });

        // 4. Delete clinics_legal_documents (for all accounts)
        await queryRunner.manager.delete(ClinicsLegalDocuments, {
          accountId: In(allAccountIds),
        });

        // 5. Delete clinic_manager_information (for child accounts)
        if (childIds.length > 0) {
          await queryRunner.manager.delete(ClinicManagerInformation, {
            accountId: In(childIds),
          });
        }

        // 6. Delete code_verification
        await queryRunner.manager.delete(CodeVerification, {
          accountId: In(allAccountIds),
        });

        // 7. Delete clinic_subscription
        await queryRunner.manager.delete(ClinicSubscription, {
          clinicId: clinicId,
        });

        // 8. Delete child accounts (managers)
        if (childIds.length > 0) {
          await queryRunner.manager.delete(Account, {
            _id: In(childIds),
          });
        }

        // 9. Delete the clinic admin account
        await queryRunner.manager.delete(Account, {
          _id: clinicId,
        });

        await queryRunner.commitTransaction();
        detail.deleted = true;
        stats.deletedSuccessfully++;
      } catch (error) {
        await queryRunner.rollbackTransaction();
        detail.deleted = false;
        detail.error = error.message || 'Unknown deletion error';
        stats.deletionsFailed++;
        console.error(
          `Failed to delete stale registration for ${clinicAdmin.email}:`,
          error,
        );
      } finally {
        await queryRunner.release();
      }

      stats.details.push(detail);
    }

    return stats;
  }

  /**
   * Get all active clinic admins
   */
  async getActiveClinicAdmins(): Promise<any[]> {
    const activeAdmins = await this.accountRepository.find({
      where: {
        role: AccountRole.CLINIC_ADMIN,
        subscription: {
          subscriptionStatus: RegistrationStatus.ACTIVE,
        },
      },
      relations: ['clinicAdminInformation', 'subscription'],
      select: {
        _id: true,
        email: true,
        username: true,
        phone: true,
        status: true,
        createdAt: true,
        clinicAdminInformation: {
          _id: true,
          clinicName: true,
          clinicPhone: true,
          description: true,
          specializedIn: true,
          pros: true,
          paraclinical: true,
          dob: true,
          profilePicture: true,
          bankName: true,
          bankNumber: true,
          bankBranch: true,
          sepayVa: true,
          isVerify: true,
        },
        subscription: {
          _id: true,
          subscriptionStatus: true,
          serviceId: true,
          expirationDate: true,
        },
      },
    });

    return activeAdmins.map((admin) => {
      const { _id, clinicAdminInformation, subscription, ...rest } = admin;
      return {
        id: _id,
        ...rest,
        clinicAdminInformation: clinicAdminInformation
          ? {
              id: clinicAdminInformation._id,
              clinicName: clinicAdminInformation.clinicName,
              clinicPhone: clinicAdminInformation.clinicPhone,
              description: clinicAdminInformation.description,
              specializedIn: clinicAdminInformation.specializedIn,
              pros: clinicAdminInformation.pros,
              paraclinical: clinicAdminInformation.paraclinical,
              dob: clinicAdminInformation.dob,
              profilePicture: clinicAdminInformation.profilePicture,
              bankName: clinicAdminInformation.bankName,
              bankNumber: clinicAdminInformation.bankNumber,
              bankBranch: clinicAdminInformation.bankBranch,
              sepayVa: clinicAdminInformation.sepayVa,
              isVerify: clinicAdminInformation.isVerify,
            }
          : null,
        subscription: subscription
          ? {
              id: subscription._id,
              subscriptionStatus: subscription.subscriptionStatus,
              serviceId: subscription.serviceId,
              expirationDate: subscription.expirationDate,
            }
          : null,
      };
    });
  }

  async getAdminAccounts(): Promise<any[]> {
    const admins = await this.accountRepository.find({
      where: {
        role: AccountRole.ADMIN,
      },
      relations: ['generalAccount'],
      select: {
        _id: true,
        email: true,
        username: true,
        phone: true,
        role: true,
        status: true,
        isEmailVerified: true,
        isOAuthUser: true,
        createdAt: true,
        updatedAt: true,
        generalAccount: {
          _id: true,
          fullName: true,
          gender: true,
          dob: true,
          profilePicture: true,
        },
      },
    });

    return admins.map((admin) => {
      const { _id, generalAccount, ...rest } = admin;
      return {
        id: _id,
        ...rest,
        generalAccount: generalAccount
          ? {
              id: generalAccount._id,
              fullName: generalAccount.fullName,
              gender: generalAccount.gender,
              dob: generalAccount.dob,
              profilePicture: generalAccount.profilePicture,
            }
          : null,
      };
    });
  }
}
