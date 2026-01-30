import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { AdminRegistrationRepository } from './repositories/admin-registration.repository';
import { ClinicsLegalDocumentsRepository } from '../accounts/repositories/clinics-legal-documents.repository';
import { ClinicSubscriptionRepository } from '../subscriptions/repositories/clinic-subscription.repository';
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
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Get pending approvals with pagination
   *
   * Returns paginated list of clinic registrations awaiting approval
   */
  async getPendingApprovals(
    page: number = 1,
    limit: number = 10,
  ): Promise<RegistrationListResponseDto> {
    const [registrations, total] =
      await this.adminRegistrationRepository.findPendingApprovals(page, limit);

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
      await this.adminRegistrationRepository.findRegistrationById(clinicAdminId);

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
        await this.adminRegistrationRepository.findClinicAdminById(clinicAdminId);

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
      if (legalDocs.verificationStatus !== LegalDocumentVerificationStatus.PENDING_REVIEW) {
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
      if (subscription.subscriptionStatus !== RegistrationStatus.PENDING_APPROVAL) {
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
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Find the clinic admin account
      const clinicAdmin =
        await this.adminRegistrationRepository.findClinicAdminById(clinicAdminId);

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
      if (legalDocs.verificationStatus !== LegalDocumentVerificationStatus.PENDING_REVIEW) {
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
      if (subscription.subscriptionStatus !== RegistrationStatus.PENDING_APPROVAL) {
        throw new BadRequestException(
          'Subscription is not in PENDING_APPROVAL status',
        );
      }

      // Update legal documents status to REJECTED
      legalDocs.verificationStatus = LegalDocumentVerificationStatus.REJECTED;
      await queryRunner.manager.save(ClinicsLegalDocuments, legalDocs);

      // Update subscription status to REJECTED
      subscription.subscriptionStatus = RegistrationStatus.REJECTED;
      await queryRunner.manager.save(ClinicSubscription, subscription);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
