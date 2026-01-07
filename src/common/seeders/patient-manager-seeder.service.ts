import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Account } from '../../modules/accounts/entities/accounts.entity';
import { GeneralAccount } from '../../modules/accounts/entities/general_accounts.entity';
import { ClinicInformation } from '../../modules/accounts/entities/clinic_information.entity';
import { ClinicsLegalDocuments } from '../../modules/accounts/entities/clinics_legal_documents.entity';
import { AccountRole, AccountStatus } from '../../modules/accounts/enums';
import { BankName } from '../../modules/accounts/enums/bank-name.enum';
import { LegalDocumentVerificationStatus } from '../../modules/accounts/enums/legal-document-verification-status.enum';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { GeneralAccountRepository } from '../../modules/accounts/repositories/general-account.repository';
import { ClinicInformationRepository } from '../../modules/accounts/repositories/clinic-information.repository';
import { ClinicsLegalDocumentsRepository } from '../../modules/accounts/repositories/clinics-legal-documents.repository';

/**
 * Patient and Manager Seeder Service
 * - Runs on application startup
 * - Seeds 3 PATIENT accounts with GeneralAccount records
 * - Seeds 3 MANAGER accounts with ClinicInformation and ClinicsLegalDocuments records
 * - All accounts are immediately ACTIVE with verified email
 */
@Injectable()
export class PatientManagerSeederService {
  private readonly logger = new Logger(PatientManagerSeederService.name);
  private readonly BCRYPT_SALT_ROUNDS = 10;

  // Default password for all seeded accounts
  private readonly DEFAULT_PASSWORD = 'User@123456';

  // Patient data with Vietnamese names and phone numbers
  private readonly PATIENTS = [
    {
      username: 'patient1',
      email: 'nguyen.van.an@medicare.com',
      fullName: 'Nguyễn Văn An',
      phone: '0912345678',
    },
    {
      username: 'patient2',
      email: 'tran.thi.bich@medicare.com',
      fullName: 'Trần Thị Bích',
      phone: '0923456789',
    },
    {
      username: 'patient3',
      email: 'le.hoang.cuong@medicare.com',
      fullName: 'Lê Hoàng Cường',
      phone: '0934567890',
    },
  ];

  // Manager data with clinic information
  private readonly MANAGERS = [
    {
      username: 'manager1',
      email: 'phong.kham.anh@medicare.com',
      fullName: 'Phòng Khám Bác Sĩ Anh',
      phone: '0945678901',
      clinicName: 'Phòng Khám Bác Sĩ Anh',
      description: 'Phòng khám đa khoa với đội ngũ bác sĩ giàu kinh nghiệm, chuyên điều trị các bệnh lý nội khoa và ngoại khoa.',
      specializedIn: ['Nội khoa', 'Ngoại khoa', 'Tai mũi họng'],
      pros: ['Bác sĩ giỏi', 'Thiết bị hiện đại', 'Dịch vụ tận tâm'],
      operatingLicense: 'GP-12345-HCM',
      businessLicense: 'MB-1234567890',
      bankName: BankName.VPBANK,
      sepayVa: '001234567890',
    },
    {
      username: 'manager2',
      email: 'phong.kham.hong@medicare.com',
      fullName: 'Phòng Khám Hồng Phúc',
      phone: '0956789012',
      clinicName: 'Phòng Khám Hồng Phúc',
      description: 'Chuyên khoa răng hàm mặt và thẩm mỹ nha khoa với công nghệ tiên tiến nhất.',
      specializedIn: ['Răng hàm mặt', 'Thẩm mỹ nha khoa', 'Niềng răng'],
      pros: ['Công nghệ cao', 'Chi phí hợp lý', 'Không gian hiện đại'],
      operatingLicense: 'GP-23456-HCM',
      businessLicense: 'MB-2345678901',
      bankName: BankName.TPBANK,
      sepayVa: '002345678901',
    },
    {
      username: 'manager3',
      email: 'phong.kham.long@medicare.com',
      fullName: 'Phòng Khám Long Châu',
      phone: '0967890123',
      clinicName: 'Phòng Khám Long Châu',
      description: 'Phòng khám chuyên khoa sản phụ khoa và chăm sóc sức khỏe mẹ bé toàn diện.',
      specializedIn: ['Sản phụ khoa', 'Sơ sinh', 'Tiêm chủng'],
      pros: ['Đội ngũ chuyên môn cao', 'Cơ sở vật chất tốt', 'Chi phí minh bạch'],
      operatingLicense: 'GP-34567-HCM',
      businessLicense: 'MB-3456789012',
      bankName: BankName.BIDV,
      sepayVa: '003456789012',
    },
  ];

  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly generalAccountRepository: GeneralAccountRepository,
    private readonly clinicInformationRepository: ClinicInformationRepository,
    private readonly clinicsLegalDocumentsRepository: ClinicsLegalDocumentsRepository,
  ) {}

  /**
   * Seed patient and manager accounts
   *
   * Creates both Account and GeneralAccount/ClinicInformation/ClinicsLegalDocuments entities
   * All accounts are immediately ACTIVE with verified email
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
   */
  async seed(): Promise<void> {
    await this.seedPatients();
    await this.seedManagers();
  }

  /**
   * Seed 3 PATIENT accounts with GeneralAccount records
   */
  private async seedPatients(): Promise<void> {
    try {
      this.logger.log('Starting to seed patient accounts...');

      const hashedPassword = await bcrypt.hash(
        this.DEFAULT_PASSWORD,
        this.BCRYPT_SALT_ROUNDS,
      );

      for (const patientData of this.PATIENTS) {
        // Check if patient already exists by email
        const existingPatient = await this.accountRepository.findAccountByEmail(
          patientData.email,
        );

        if (existingPatient) {
          this.logger.log(
            `Patient account already exists: ${patientData.email}`,
          );
          continue;
        }

        // Create Account entity
        const patient = this.accountRepository.createAccount({
          username: patientData.username,
          email: patientData.email,
          phone: patientData.phone,
          password: hashedPassword,
          role: AccountRole.PATIENT,
          status: AccountStatus.ACTIVE,
          isEmailVerified: true,
          isOAuthUser: false,
        });

        const savedPatient = await this.accountRepository.saveAccount(patient);

        // Create GeneralAccount entity
        const generalAccount = this.generalAccountRepository.createGeneralAccount(
          {
            generalAccId: savedPatient._id,
            fullName: patientData.fullName,
          },
        );

        await this.generalAccountRepository.saveGeneralAccount(generalAccount);

        this.logger.log(
          `✅ Patient account created: ${patientData.email} (${patientData.fullName})`,
        );
      }

      this.logger.log('Patient accounts seeding completed');
    } catch (error) {
      this.logger.error('Failed to seed patient accounts', error.stack);
    }
  }

  /**
   * Seed 3 MANAGER accounts with ClinicInformation and ClinicsLegalDocuments records
   */
  private async seedManagers(): Promise<void> {
    try {
      this.logger.log('Starting to seed manager accounts...');

      const hashedPassword = await bcrypt.hash(
        this.DEFAULT_PASSWORD,
        this.BCRYPT_SALT_ROUNDS,
      );

      for (const managerData of this.MANAGERS) {
        // Check if manager already exists by email
        const existingManager = await this.accountRepository.findAccountByEmail(
          managerData.email,
        );

        if (existingManager) {
          this.logger.log(
            `Manager account already exists: ${managerData.email}`,
          );
          continue;
        }

        // Create Account entity
        const manager = this.accountRepository.createAccount({
          username: managerData.username,
          email: managerData.email,
          phone: managerData.phone,
          password: hashedPassword,
          role: AccountRole.CLINIC_MANAGER,
          status: AccountStatus.ACTIVE,
          isEmailVerified: true,
          isOAuthUser: false,
        });

        const savedManager = await this.accountRepository.saveAccount(manager);

        // Create ClinicInformation entity
        const clinicInformation =
          this.clinicInformationRepository.create({
            clinicId: savedManager._id,
            clinicName: managerData.clinicName,
            description: managerData.description,
            specializedIn: managerData.specializedIn,
            pros: managerData.pros,
          });

        await this.clinicInformationRepository.save(clinicInformation);

        // Create ClinicsLegalDocuments entity
        const clinicsLegalDocuments =
          this.clinicsLegalDocumentsRepository.create({
            accountId: savedManager._id,
            operatingLicense: managerData.operatingLicense,
            businessLicense: managerData.businessLicense,
            bankName: managerData.bankName,
            sepayVa: managerData.sepayVa,
            isSepayVerify: false,
            verificationStatus: LegalDocumentVerificationStatus.NOT_SUBMITTED,
          });

        await this.clinicsLegalDocumentsRepository.save(clinicsLegalDocuments);

        this.logger.log(
          `✅ Manager account created: ${managerData.email} (${managerData.clinicName})`,
        );
      }

      this.logger.log('Manager accounts seeding completed');
    } catch (error) {
      this.logger.error('Failed to seed manager accounts', error.stack);
    }
  }
}
