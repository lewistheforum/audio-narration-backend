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
 * Patient, Manager, Doctor, and Staff Seeder Service
 * - Runs on application startup
 * - Seeds 3 PATIENT accounts with GeneralAccount records
 * - Seeds 3 MANAGER accounts with ClinicInformation and ClinicsLegalDocuments records
 * - Seeds 3 DOCTOR accounts and 3 STAFF accounts for each manager (9 doctors, 9 staff total)
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
      description:
        'Phòng khám đa khoa với đội ngũ bác sĩ giàu kinh nghiệm, chuyên điều trị các bệnh lý nội khoa và ngoại khoa.',
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
      description:
        'Chuyên khoa răng hàm mặt và thẩm mỹ nha khoa với công nghệ tiên tiến nhất.',
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
      description:
        'Phòng khám chuyên khoa sản phụ khoa và chăm sóc sức khỏe mẹ bé toàn diện.',
      specializedIn: ['Sản phụ khoa', 'Sơ sinh', 'Tiêm chủng'],
      pros: [
        'Đội ngũ chuyên môn cao',
        'Cơ sở vật chất tốt',
        'Chi phí minh bạch',
      ],
      operatingLicense: 'GP-34567-HCM',
      businessLicense: 'MB-3456789012',
      bankName: BankName.BIDV,
      sepayVa: '003456789012',
    },
  ];

  // Doctor data - 3 doctors for each manager
  private readonly DOCTORS = [
    // Doctors for manager1 (Phòng Khám Bác Sĩ Anh)
    {
      username: 'doctor1_m1',
      email: 'bs.nguyen.van.khanh@medicare.com',
      fullName: 'BS. Nguyễn Văn Khánh',
      phone: '0978901234',
      managerUsername: 'manager1',
      specialization: 'Nội khoa',
    },
    {
      username: 'doctor2_m1',
      email: 'bs.tran.thi.lan@medicare.com',
      fullName: 'BS. Trần Thị Lan',
      phone: '0989012345',
      managerUsername: 'manager1',
      specialization: 'Ngoại khoa',
    },
    {
      username: 'doctor3_m1',
      email: 'bs.le.minh.tuan@medicare.com',
      fullName: 'BS. Lê Minh Tuấn',
      phone: '0990123456',
      managerUsername: 'manager1',
      specialization: 'Tai mũi họng',
    },
    // Doctors for manager2 (Phòng Khám Hồng Phúc)
    {
      username: 'doctor1_m2',
      email: 'bs.pham.hoang.nam@medicare.com',
      fullName: 'BS. Phạm Hoàng Nam',
      phone: '0901234567',
      managerUsername: 'manager2',
      specialization: 'Răng hàm mặt',
    },
    {
      username: 'doctor2_m2',
      email: 'bs.vo.thi.mai@medicare.com',
      fullName: 'BS. Võ Thị Mai',
      phone: '0912345670',
      managerUsername: 'manager2',
      specialization: 'Thẩm mỹ nha khoa',
    },
    {
      username: 'doctor3_m2',
      email: 'bs.hoang.van.phuc@medicare.com',
      fullName: 'BS. Hoàng Văn Phúc',
      phone: '0923456701',
      managerUsername: 'manager2',
      specialization: 'Niềng răng',
    },
    // Doctors for manager3 (Phòng Khám Long Châu)
    {
      username: 'doctor1_m3',
      email: 'bs.dang.thi.hoa@medicare.com',
      fullName: 'BS. Đặng Thị Hoa',
      phone: '0934567012',
      managerUsername: 'manager3',
      specialization: 'Sản phụ khoa',
    },
    {
      username: 'doctor2_m3',
      email: 'bs.bui.van.son@medicare.com',
      fullName: 'BS. Bùi Văn Sơn',
      phone: '0945670123',
      managerUsername: 'manager3',
      specialization: 'Sơ sinh',
    },
    {
      username: 'doctor3_m3',
      email: 'bs.nguyen.thi.thao@medicare.com',
      fullName: 'BS. Nguyễn Thị Thảo',
      phone: '0956701234',
      managerUsername: 'manager3',
      specialization: 'Tiêm chủng',
    },
  ];

  // Staff data - 3 staff members for each manager
  private readonly STAFF = [
    // Staff for manager1 (Phòng Khám Bác Sĩ Anh)
    {
      username: 'staff1_m1',
      email: 'nv.tran.van.binh@medicare.com',
      fullName: 'Trần Văn Bình',
      phone: '0967012345',
      managerUsername: 'manager1',
      position: 'Lễ tân',
    },
    {
      username: 'staff2_m1',
      email: 'nv.le.thi.cam@medicare.com',
      fullName: 'Lê Thị Cẩm',
      phone: '0970123456',
      managerUsername: 'manager1',
      position: 'Y tá',
    },
    {
      username: 'staff3_m1',
      email: 'nv.pham.van.dat@medicare.com',
      fullName: 'Phạm Văn Đạt',
      phone: '0981234567',
      managerUsername: 'manager1',
      position: 'Kế toán',
    },
    // Staff for manager2 (Phòng Khám Hồng Phúc)
    {
      username: 'staff1_m2',
      email: 'nv.nguyen.thi.em@medicare.com',
      fullName: 'Nguyễn Thị Em',
      phone: '0992345678',
      managerUsername: 'manager2',
      position: 'Lễ tân',
    },
    {
      username: 'staff2_m2',
      email: 'nv.vo.van.phong@medicare.com',
      fullName: 'Võ Văn Phong',
      phone: '0903456789',
      managerUsername: 'manager2',
      position: 'Kỹ thuật viên',
    },
    {
      username: 'staff3_m2',
      email: 'nv.hoang.thi.giang@medicare.com',
      fullName: 'Hoàng Thị Giang',
      phone: '0914567890',
      managerUsername: 'manager2',
      position: 'Y tá',
    },
    // Staff for manager3 (Phòng Khám Long Châu)
    {
      username: 'staff1_m3',
      email: 'nv.dang.van.hai@medicare.com',
      fullName: 'Đặng Văn Hải',
      phone: '0925678901',
      managerUsername: 'manager3',
      position: 'Lễ tân',
    },
    {
      username: 'staff2_m3',
      email: 'nv.bui.thi.yen@medicare.com',
      fullName: 'Bùi Thị Yến',
      phone: '0936789012',
      managerUsername: 'manager3',
      position: 'Y tá',
    },
    {
      username: 'staff3_m3',
      email: 'nv.tran.van.kien@medicare.com',
      fullName: 'Trần Văn Kiên',
      phone: '0947890123',
      managerUsername: 'manager3',
      position: 'Dược sĩ',
    },
  ];

  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly generalAccountRepository: GeneralAccountRepository,
    private readonly clinicInformationRepository: ClinicInformationRepository,
    private readonly clinicsLegalDocumentsRepository: ClinicsLegalDocumentsRepository,
  ) {}

  /**
   * Seed patient, manager, doctor, and staff accounts
   *
   * Creates both Account and GeneralAccount/ClinicInformation/ClinicsLegalDocuments entities
   * All accounts are immediately ACTIVE with verified email
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
   */
  async seed(): Promise<void> {
    await this.seedPatients();
    await this.seedManagers();
    await this.seedDoctors();
    await this.seedStaff();
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
        const generalAccount =
          this.generalAccountRepository.createGeneralAccount({
            generalAccId: savedPatient._id,
            fullName: patientData.fullName,
          });

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
        const clinicInformation = this.clinicInformationRepository.create({
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

  /**
   * Seed 9 DOCTOR accounts (3 for each manager) with GeneralAccount records
   */
  private async seedDoctors(): Promise<void> {
    try {
      this.logger.log('Starting to seed doctor accounts...');

      const hashedPassword = await bcrypt.hash(
        this.DEFAULT_PASSWORD,
        this.BCRYPT_SALT_ROUNDS,
      );

      for (const doctorData of this.DOCTORS) {
        // Check if doctor already exists by email
        const existingDoctor = await this.accountRepository.findAccountByEmail(
          doctorData.email,
        );

        if (existingDoctor) {
          this.logger.log(`Doctor account already exists: ${doctorData.email}`);
          continue;
        }

        // Find the manager account by username
        const managerData = this.MANAGERS.find(
          (m) => m.username === doctorData.managerUsername,
        );

        if (!managerData) {
          this.logger.warn(
            `Manager data not found for doctor ${doctorData.email}: ${doctorData.managerUsername}`,
          );
          continue;
        }

        const manager = await this.accountRepository.findAccountByEmail(
          managerData.email,
        );

        if (!manager) {
          this.logger.warn(
            `Manager account not found for doctor ${doctorData.email}: ${managerData.email}`,
          );
          continue;
        }

        // Create Account entity
        const doctor = this.accountRepository.createAccount({
          username: doctorData.username,
          email: doctorData.email,
          phone: doctorData.phone,
          password: hashedPassword,
          role: AccountRole.DOCTOR,
          status: AccountStatus.ACTIVE,
          isEmailVerified: true,
          isOAuthUser: false,
          parentId: manager._id, // Link to manager's clinic
        });

        const savedDoctor = await this.accountRepository.saveAccount(doctor);

        // Create GeneralAccount entity
        const generalAccount =
          this.generalAccountRepository.createGeneralAccount({
            generalAccId: savedDoctor._id,
            fullName: doctorData.fullName,
          });

        await this.generalAccountRepository.saveGeneralAccount(generalAccount);

        this.logger.log(
          `✅ Doctor account created: ${doctorData.email} (${doctorData.fullName}) - ${doctorData.specialization} - Clinic: ${doctorData.managerUsername}`,
        );
      }

      this.logger.log('Doctor accounts seeding completed');
    } catch (error) {
      this.logger.error('Failed to seed doctor accounts', error.stack);
    }
  }

  /**
   * Seed 9 STAFF accounts (3 for each manager) with GeneralAccount records
   */
  private async seedStaff(): Promise<void> {
    try {
      this.logger.log('Starting to seed staff accounts...');

      const hashedPassword = await bcrypt.hash(
        this.DEFAULT_PASSWORD,
        this.BCRYPT_SALT_ROUNDS,
      );

      for (const staffData of this.STAFF) {
        // Check if staff already exists by email
        const existingStaff = await this.accountRepository.findAccountByEmail(
          staffData.email,
        );

        if (existingStaff) {
          this.logger.log(`Staff account already exists: ${staffData.email}`);
          continue;
        }

        // Find the manager account by username
        const managerData = this.MANAGERS.find(
          (m) => m.username === staffData.managerUsername,
        );

        if (!managerData) {
          this.logger.warn(
            `Manager data not found for staff ${staffData.email}: ${staffData.managerUsername}`,
          );
          continue;
        }

        const manager = await this.accountRepository.findAccountByEmail(
          managerData.email,
        );

        if (!manager) {
          this.logger.warn(
            `Manager account not found for staff ${staffData.email}: ${managerData.email}`,
          );
          continue;
        }

        // Create Account entity
        const staff = this.accountRepository.createAccount({
          username: staffData.username,
          email: staffData.email,
          phone: staffData.phone,
          password: hashedPassword,
          role: AccountRole.CLINIC_STAFF,
          status: AccountStatus.ACTIVE,
          isEmailVerified: true,
          isOAuthUser: false,
          parentId: manager._id, // Link to manager's clinic
        });

        const savedStaff = await this.accountRepository.saveAccount(staff);

        // Create GeneralAccount entity
        const generalAccount =
          this.generalAccountRepository.createGeneralAccount({
            generalAccId: savedStaff._id,
            fullName: staffData.fullName,
          });

        await this.generalAccountRepository.saveGeneralAccount(generalAccount);

        this.logger.log(
          `✅ Staff account created: ${staffData.email} (${staffData.fullName}) - ${staffData.position} - Clinic: ${staffData.managerUsername}`,
        );
      }

      this.logger.log('Staff accounts seeding completed');
    } catch (error) {
      this.logger.error('Failed to seed staff accounts', error.stack);
    }
  }
}
