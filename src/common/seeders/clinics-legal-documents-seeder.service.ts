import { Injectable, Logger } from '@nestjs/common';
import { Account } from '../../modules/accounts/entities/accounts.entity';
import { AccountRole } from '../../modules/accounts/enums/account-role.enum';
import { LegalDocumentVerificationStatus } from '../../modules/accounts/enums/legal-document-verification-status.enum';
import { ClinicsLegalDocuments } from '../../modules/accounts/entities/clinics_legal_documents.entity';
import { ClinicsLegalDocumentsRepository } from '../../modules/accounts/repositories/clinics-legal-documents.repository';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import {
  OPERATING_LICENSES,
  BUSINESS_LICENSES,
  COMPLIANCE_DOCS,
} from '../constants/medical-terms';

/**
 * ClinicsLegalDocuments Seeder Service
 *
 * Seeds legal documents for CLINIC_MANAGER accounts ONLY.
 * Clinic Admins do NOT have legal document records.
 *
 * Seeding Rules (10 Admin Matrix):
 * - Group A (Admins 1-4): Fully registered, ACTIVE subscription -> All managers APPROVED
 * - Group B (Admins 5-6): EXPIRED subscription -> Manager APPROVED
 * - Group C (Admins 7-8): ACTIVE subscription, 2 managers -> Manager 1 APPROVED, Manager 2 PENDING
 * - Group D (Admins 9-10): Registration flow -> Manager PENDING
 *
 * Must be idempotent (re-run safe).
 *
 * Idempotent: Uses check-then-insert pattern by accountId
 */
@Injectable()
export class ClinicsLegalDocumentsSeederService {
  private readonly logger = new Logger(ClinicsLegalDocumentsSeederService.name);

  // Orthopedics clinic-specific license placeholders
  private readonly OPERATING_LICENSES_TEMPLATES = OPERATING_LICENSES;
  private readonly BUSINESS_LICENSES_TEMPLATES = BUSINESS_LICENSES;
  private readonly COMPLIANCE_DOCS_TEMPLATES = COMPLIANCE_DOCS;

  constructor(
    private readonly clinicsLegalDocumentsRepository: ClinicsLegalDocumentsRepository,
    private readonly accountRepository: AccountRepository,
  ) {}

  /**
   * Seed legal documents for all CLINIC_MANAGER accounts
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
   */
  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed clinics legal documents...');

      // Get all CLINIC_ADMIN accounts to map managers to their parent admin
      const allAccounts = await this.accountRepository.findAllAccounts();
      const clinicAdmins = allAccounts.filter(
        (acc) => acc.role === AccountRole.CLINIC_ADMIN,
      );

      // Get all CLINIC_MANAGER accounts
      const clinicManagers = allAccounts.filter(
        (acc) => acc.role === AccountRole.CLINIC_MANAGER,
      );

      if (clinicManagers.length === 0) {
        this.logger.warn('No CLINIC_MANAGER accounts found. Skipping seeding.');
        return;
      }

      this.logger.log(`Found ${clinicManagers.length} CLINIC_MANAGER accounts`);

      let createdCount = 0;
      let skippedCount = 0;

      for (const manager of clinicManagers) {
        const existing =
          await this.clinicsLegalDocumentsRepository.existsByAccountId(
            manager._id,
          );

        if (existing) {
          skippedCount++;
          continue;
        }

        // Find the parent admin of this manager
        const parentAdmin = clinicAdmins.find(
          (admin) => admin._id === manager.parentId,
        );

        // Determine verification status based on admin group
        let verificationStatus: LegalDocumentVerificationStatus;

        if (parentAdmin) {
          // Find admin index (1-based)
          const adminIndex =
            clinicAdmins.indexOf(parentAdmin) + 1; // 1-10

          // Get manager index within this admin's managers
          const adminManagers = clinicManagers.filter(
            (m) => m.parentId === parentAdmin._id,
          );
          const managerIndex = adminManagers.indexOf(manager) + 1; // 1, 2, 3...

          verificationStatus = this.getVerificationStatusByGroup(
            adminIndex,
            managerIndex,
          );
        } else {
          // Default for managers without parent
          verificationStatus = LegalDocumentVerificationStatus.PENDING_REVIEW;
        }

        // Create legal documents with realistic orthopedics clinic data
        const legalDocs = this.clinicsLegalDocumentsRepository.create({
          accountId: manager._id,
          operatingLicense: this.getRandomOperatingLicense(),
          businessLicense: this.getRandomBusinessLicense(),
          verificationStatus,
        });

        await this.clinicsLegalDocumentsRepository.save(legalDocs);
        createdCount++;

        this.logger.log(
          `Created legal doc for manager (parent admin: ${parentAdmin ? clinicAdmins.indexOf(parentAdmin) + 1 : 'N/A'}) with status ${verificationStatus}`,
        );
      }

      this.logger.log(
        `✅ ClinicsLegalDocuments seeding completed: ${createdCount} created, ${skippedCount} skipped`,
      );
    } catch (error) {
      this.logger.error('Failed to seed clinics legal documents', error.stack);
      throw error;
    }
  }

  /**
   * Get verification status based on admin group and manager index
   *
   * Group A (Admins 1-4): All managers APPROVED
   * Group B (Admins 5-6): Manager APPROVED
   * Group C (Admins 7-8): Manager 1 APPROVED, Manager 2+ PENDING
   * Group D (Admins 9-10): Manager PENDING
   */
  private getVerificationStatusByGroup(
    adminIndex: number,
    managerIndex: number,
  ): LegalDocumentVerificationStatus {
    // Group A (Admins 1-4): All managers APPROVED
    if (adminIndex <= 4) {
      return LegalDocumentVerificationStatus.APPROVED;
    }

    // Group B (Admins 5-6): Manager APPROVED
    if (adminIndex <= 6) {
      return LegalDocumentVerificationStatus.APPROVED;
    }

    // Group C (Admins 7-8): Manager 1 APPROVED, Manager 2+ PENDING
    if (adminIndex <= 8) {
      if (managerIndex === 1) {
        return LegalDocumentVerificationStatus.APPROVED;
      } else {
        return LegalDocumentVerificationStatus.PENDING_REVIEW;
      }
    }

    // Group D (Admins 9-10): Manager PENDING
    return LegalDocumentVerificationStatus.PENDING_REVIEW;
  }

  /**
   * Get random operating license placeholder
   */
  private getRandomOperatingLicense(): string {
    const template =
      this.OPERATING_LICENSES_TEMPLATES[
        Math.floor(Math.random() * this.OPERATING_LICENSES_TEMPLATES.length)
      ];
    const licenseNumber = this.generateLicenseNumber();
    return template.replace('{number}', licenseNumber);
  }

  /**
   * Get random business license
   */
  private getRandomBusinessLicense(): string {
    return this.BUSINESS_LICENSES_TEMPLATES[
      Math.floor(Math.random() * this.BUSINESS_LICENSES_TEMPLATES.length)
    ];
  }

  /**
   * Generate random license number (e.g., 12345/GP-BYT)
   */
  private generateLicenseNumber(): string {
    const digits = Math.floor(Math.random() * 90000) + 10000;
    const suffixes = ['GP-BYT', 'GP-BV', 'GP-HN', 'GP-TPHCM', 'GP-DN'];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    return `${digits}/${suffix}`;
  }
}
