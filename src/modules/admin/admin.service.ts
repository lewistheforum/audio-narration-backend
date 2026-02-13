import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { AdminRegistrationRepository } from './repositories/admin-registration.repository';
import { ClinicsLegalDocumentsRepository } from '../accounts/repositories/clinics-legal-documents.repository';
import { ClinicSubscriptionRepository } from '../subscriptions/repositories/clinic-subscription.repository';
import { ClinicAdminInformationRepository } from '../accounts/repositories';
import { MailerService } from '../mailer/mailer.service';
import { Account } from '../accounts/entities/accounts.entity';
import { AccountRole } from '../accounts/enums/account-role.enum';
import {
  RegistrationListResponseDto,
  RegistrationDetailResponseDto,
  PaginationDto,
} from './dto';
import { LegalDocumentVerificationStatus } from '../accounts/enums/legal-document-verification-status.enum';
import { RegistrationStatus } from '../subscriptions/enums/subscription-status.enum';
import { ClinicsLegalDocuments } from '../accounts/entities/clinics_legal_documents.entity';
import { ClinicSubscription } from '../subscriptions/entities/clinic-subscription.entity';

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
   * Get all registrations with pagination
   *
   * Returns paginated list of clinic registrations
   */
  async getAllRegistrations(
    page: number = 1,
    limit: number = 10,
  ): Promise<RegistrationListResponseDto> {
    const [registrations, total] =
      await this.adminRegistrationRepository.findAllRegistrations(page, limit);

    const totalPages = Math.ceil(total / limit);

    const pagination: PaginationDto = {
      page,
      limit,
      total,
      totalPages,
    };

    return {
      registrations,
      pagination,
    };
  }

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
   * Approve a clinic registration
   *
   * Sets legal documents to APPROVED and transitions subscription to PENDING_PAYMENT
   */
  async approveRegistration(clinicAdminId: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Find the clinic admin account
      const clinicAdmin =
        await this.adminRegistrationRepository.findClinicAdminById(
          clinicAdminId,
        );

      if (!clinicAdmin) {
        throw new NotFoundException('Clinic admin account not found');
      }

      // Find the clinic manager (child account)
      const clinicManager = clinicAdmin.children?.find(
        (child) => child.role === 'CLINIC_MANAGER',
      );

      if (!clinicManager) {
        throw new NotFoundException('Clinic manager account not found');
      }

      // Find legal documents for the clinic manager
      const legalDocs =
        await this.adminRegistrationRepository.findLegalDocumentsByManagerId(
          clinicManager._id,
        );

      if (!legalDocs) {
        throw new NotFoundException('Legal documents not found');
      }

      // Validate current status is PENDING_REVIEW
      if (
        legalDocs.verificationStatus !==
        LegalDocumentVerificationStatus.PENDING_REVIEW
      ) {
        throw new BadRequestException(
          'Legal documents are not in PENDING_REVIEW status',
        );
      }

      // Find subscription
      const subscription =
        await this.adminRegistrationRepository.findSubscriptionByClinicId(
          clinicAdminId,
        );

      if (!subscription) {
        throw new NotFoundException('Subscription not found');
      }

      // Validate current subscription status is PENDING_APPROVAL
      if (
        subscription.subscriptionStatus !== RegistrationStatus.PENDING_APPROVAL
      ) {
        throw new BadRequestException(
          'Subscription is not in PENDING_APPROVAL status',
        );
      }

      // Update legal documents status to APPROVED
      legalDocs.verificationStatus = LegalDocumentVerificationStatus.APPROVED;
      await queryRunner.manager.save(ClinicsLegalDocuments, legalDocs);

      // Update subscription status to PENDING_PAYMENT
      subscription.subscriptionStatus = RegistrationStatus.PENDING_PAYMENT;
      await queryRunner.manager.save(ClinicSubscription, subscription);

      await queryRunner.commitTransaction();

      // Send approval email after successful transaction (fire-and-forget)
      // Get clinic name from the clinic admin
      const clinicAdminInfo =
        await this.clinicAdminInfoRepository.findByAccountId(clinicAdminId);
      const clinicName = clinicAdminInfo?.clinicName;

      this.mailerService
        .sendRegistrationApprovedEmail(clinicAdmin.email, clinicName)
        .catch((error) => {
          console.error('Failed to send registration approved email:', error);
        });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Reject a clinic registration
   *
   * Sets legal documents to REJECTED
   */
  async rejectRegistration(
    clinicAdminId: string,
    reason: string,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Find the clinic admin account
      const clinicAdmin =
        await this.adminRegistrationRepository.findClinicAdminById(
          clinicAdminId,
        );

      if (!clinicAdmin) {
        throw new NotFoundException('Clinic admin account not found');
      }

      // Find the clinic manager (child account)
      const clinicManager = clinicAdmin.children?.find(
        (child) => child.role === 'CLINIC_MANAGER',
      );

      if (!clinicManager) {
        throw new NotFoundException('Clinic manager account not found');
      }

      // Find legal documents for the clinic manager
      const legalDocs =
        await this.adminRegistrationRepository.findLegalDocumentsByManagerId(
          clinicManager._id,
        );

      if (!legalDocs) {
        throw new NotFoundException('Legal documents not found');
      }

      // Validate current status is PENDING_REVIEW
      if (
        legalDocs.verificationStatus !==
        LegalDocumentVerificationStatus.PENDING_REVIEW
      ) {
        throw new BadRequestException(
          'Legal documents are not in PENDING_REVIEW status',
        );
      }

      // Find subscription
      const subscription =
        await this.adminRegistrationRepository.findSubscriptionByClinicId(
          clinicAdminId,
        );

      if (!subscription) {
        throw new NotFoundException('Subscription not found');
      }

      // Validate current subscription status is PENDING_APPROVAL
      if (
        subscription.subscriptionStatus !== RegistrationStatus.PENDING_APPROVAL
      ) {
        throw new BadRequestException(
          'Subscription is not in PENDING_APPROVAL status',
        );
      }

      // Update legal documents status to REJECTED
      legalDocs.verificationStatus = LegalDocumentVerificationStatus.REJECTED;
      legalDocs.rejectionReason = reason;
      await queryRunner.manager.save(ClinicsLegalDocuments, legalDocs);

      // IMPORTANT: Revert subscription status to PENDING_LEGAL_SETUP (not REJECTED)
      // This allows the user to resubmit documents
      subscription.subscriptionStatus = RegistrationStatus.PENDING_LEGAL_SETUP;
      await queryRunner.manager.save(ClinicSubscription, subscription);

      await queryRunner.commitTransaction();

      // Send rejection email after successful transaction (fire-and-forget)
      // Get clinic name from the clinic admin
      const clinicAdminInfo =
        await this.clinicAdminInfoRepository.findByAccountId(clinicAdminId);
      const clinicName = clinicAdminInfo?.clinicName;

      this.mailerService
        .sendRegistrationRejectedEmail(clinicAdmin.email, reason, clinicName)
        .catch((error) => {
          console.error('Failed to send registration rejected email:', error);
        });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
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
    const [data, totalItems] = await this.adminRegistrationRepository.findPendingLegalDocuments(
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
    const [data, totalItems] = await this.adminRegistrationRepository.findApprovedLegalDocuments(
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
    const [data, totalItems] = await this.adminRegistrationRepository.findRejectedLegalDocuments(
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
    const [data, totalItems] = await this.adminRegistrationRepository.findNotSubmittedRegistrations(
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
  async approveRegistrationBySubscriptionId(subscriptionId: string): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Find subscription
      const subscription = await this.clinicSubscriptionRepository.findById(subscriptionId);

      if (!subscription) {
        throw new NotFoundException('Subscription not found');
      }

      // Validate status
      if (subscription.subscriptionStatus !== RegistrationStatus.PENDING_APPROVAL) {
        throw new BadRequestException('Subscription is not in PENDING_APPROVAL status');
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

      if (legalDocs.verificationStatus !== LegalDocumentVerificationStatus.PENDING_REVIEW) {
        throw new BadRequestException('Legal documents are not in PENDING_REVIEW status');
      }

      // Update legal docs
      legalDocs.verificationStatus = LegalDocumentVerificationStatus.APPROVED;
      legalDocs.rejectionReason = null;
      await queryRunner.manager.save(ClinicsLegalDocuments, legalDocs);

      // Update subscription
      subscription.subscriptionStatus = RegistrationStatus.PENDING_PAYMENT;
      await queryRunner.manager.save(ClinicSubscription, subscription);

      await queryRunner.commitTransaction();

      // Send email
      const clinicName = clinicAdmin.clinicAdminInformation?.clinicName || '';
      let emailSent = true;
      
      try {
        await this.mailerService.sendRegistrationApprovedEmail(clinicAdmin.email, clinicName);
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
  async rejectRegistrationBySubscriptionId(subscriptionId: string, reason: string): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Find subscription
      const subscription = await this.clinicSubscriptionRepository.findById(subscriptionId);

      if (!subscription) {
        throw new NotFoundException('Subscription not found');
      }

      // Validate status
      if (subscription.subscriptionStatus !== RegistrationStatus.PENDING_APPROVAL) {
        throw new BadRequestException('Subscription is not in PENDING_APPROVAL status');
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

      if (legalDocs.verificationStatus !== LegalDocumentVerificationStatus.PENDING_REVIEW) {
        throw new BadRequestException('Legal documents are not in PENDING_REVIEW status');
      }

      // Update legal docs
      legalDocs.verificationStatus = LegalDocumentVerificationStatus.REJECTED;
      legalDocs.rejectionReason = reason;
      await queryRunner.manager.save(ClinicsLegalDocuments, legalDocs);

      // IMPORTANT: Revert to PENDING_LEGAL_SETUP to allow resubmission
      subscription.subscriptionStatus = RegistrationStatus.PENDING_LEGAL_SETUP;
      await queryRunner.manager.save(ClinicSubscription, subscription);

      await queryRunner.commitTransaction();

      // Send email
      const clinicName = clinicAdmin.clinicAdminInformation?.clinicName || '';
      let emailSent = true;
      
      try {
        await this.mailerService.sendRegistrationRejectedEmail(clinicAdmin.email, reason, clinicName);
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
}
