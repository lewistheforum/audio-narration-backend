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
 * Seeds legal documents for CLINIC_MANAGER accounts.
 *
 * Seeding Rules:
 * - For each CLINIC_MANAGER account, create exactly 1 clinic_legal_documents record.
 * - Must be idempotent (re-run safe).
 * - Content must match orthopedics clinic context (license placeholders, compliance docs, etc.).
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

      // Get all CLINIC_MANAGER accounts
      const clinicManagers = await this.accountRepository
        .findAllAccounts()
        .then((accounts) =>
          accounts.filter((acc) => acc.role === AccountRole.CLINIC_MANAGER),
        );

      if (clinicManagers.length === 0) {
        this.logger.warn('No CLINIC_MANAGER accounts found. Skipping seeding.');
        return;
      }

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

        // Create legal documents with realistic orthopedics clinic data
        // Use random verification status for testing different registration states
        const legalDocs = this.clinicsLegalDocumentsRepository.create({
          accountId: manager._id,
          operatingLicense: this.getRandomOperatingLicense(),
          businessLicense: this.getRandomBusinessLicense(),
          verificationStatus: this.getRandomVerificationStatus(),
        });

        await this.clinicsLegalDocumentsRepository.save(legalDocs);
        createdCount++;
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
   * Get random verification status
   * Distribute across all enum values for testing different registration states
   */
  private getRandomVerificationStatus(): LegalDocumentVerificationStatus {
    const statuses = [
      LegalDocumentVerificationStatus.NOT_SUBMITTED,
      LegalDocumentVerificationStatus.PENDING_REVIEW,
      LegalDocumentVerificationStatus.REJECTED,
    ];
    return statuses[Math.floor(Math.random() * statuses.length)];
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
