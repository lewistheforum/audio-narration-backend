import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Account } from '../../modules/accounts/entities/accounts.entity';
import { GeneralAccount } from '../../modules/accounts/entities/general_accounts.entity';

import { DoctorInformation } from '../../modules/accounts/entities/doctor_information.entity';
import { ClinicStaffInformation } from '../../modules/accounts/entities/clinic_staff_information.entity';
import {
  AccountRole,
  AccountStatus,
  Gender,
} from '../../modules/accounts/enums';

import { ClinicRole } from '../../modules/accounts/enums/clinic-role.enum';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { GeneralAccountRepository } from '../../modules/accounts/repositories/general-account.repository';

import { DoctorInformationRepository } from '../../modules/accounts/repositories/doctor-information.repository';
import { ClinicStaffInformationRepository } from '../../modules/accounts/repositories/clinic-staff-information.repository';
import { ClinicManagerInformationRepository } from '../../modules/accounts/repositories/clinic-manager-information.repository';
import { AddressRepository } from '../../modules/accounts/repositories/address.repository';
import { AddressDataService } from './address-data.service';

/**
 * Accounts Seeder Service
 * - Runs on application startup
 * - Seeds 3 PATIENT accounts with GeneralAccount records
 * - Seeds 3 CLINIC_MANAGER accounts (branch managers) with ClinicManagerInformation
 * - Seeds 6 DOCTOR accounts (2 per branch) with DoctorInformation
 * - Seeds 6 CLINIC_STAFF accounts (2 per branch) with ClinicStaffInformation
 * - All managers have parentId pointing to CLINIC_ADMIN
 * - All doctors and staff have parentId pointing to their CLINIC_MANAGER
 * - All accounts are immediately ACTIVE with verified email
 */
@Injectable()
export class AccountsSeederService {
  private readonly logger = new Logger(AccountsSeederService.name);
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

  // Manager data - branch managers (each manages one clinic branch)
  private readonly MANAGERS = [
    {
      username: 'manager1',
      email: 'manager.anh@medicare.com',
      fullName: 'Nguyễn Văn Anh',
      phone: '0945678901',
      gender: Gender.MALE,
      clinicBranchName: 'Chi nhánh Quận 1',
    },
    {
      username: 'manager2',
      email: 'manager.hong@medicare.com',
      fullName: 'Trần Thị Hồng',
      phone: '0956789012',
      gender: Gender.FEMALE,
      clinicBranchName: 'Chi nhánh Quận 7',
    },
    {
      username: 'manager3',
      email: 'manager.long@medicare.com',
      fullName: 'Lê Văn Long',
      phone: '0967890123',
      gender: Gender.MALE,
      clinicBranchName: 'Chi nhánh Thủ Đức',
    },
  ];

  // Doctor data - 2 doctors for each manager (6 total)
  private readonly DOCTORS = [
    // Doctors for manager1 (Chi nhánh Quận 1)
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
    // Doctors for manager2 (Chi nhánh Quận 7)
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
    // Doctors for manager3 (Chi nhánh Thủ Đức)
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
  ];

  // Staff data - 2 staff members for each manager (6 total)
  private readonly STAFF = [
    // Staff for manager1 (Chi nhánh Quận 1)
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
    // Staff for manager2 (Chi nhánh Quận 7)
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
    // Staff for manager3 (Chi nhánh Thủ Đức)
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
  ];

  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly generalAccountRepository: GeneralAccountRepository,
    private readonly doctorInformationRepository: DoctorInformationRepository,
    private readonly clinicStaffInformationRepository: ClinicStaffInformationRepository,
    private readonly clinicManagerInformationRepository: ClinicManagerInformationRepository,
    private readonly addressRepository: AddressRepository,
    private readonly addressDataService: AddressDataService,
  ) {}

  /**
   * Seed patient, manager, doctor, and staff accounts
   *
   * Creates both Account and GeneralAccount/ClinicManagerInformation/ClinicsLegalDocuments entities
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
            accountId: savedPatient._id,
            fullName: patientData.fullName,
          });

        await this.generalAccountRepository.saveGeneralAccount(generalAccount);

        // Create address for patient (random location)
        await this.createAddress(savedPatient._id);

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
   * Seed 3 CLINIC_MANAGER accounts with ClinicManagerInformation
   * All managers will have parentId pointing to the CLINIC_ADMIN
   */
  private async seedManagers(): Promise<void> {
    try {
      this.logger.log('Starting to seed manager accounts...');

      // Find the clinic admin account first
      const allAccounts = await this.accountRepository.findAllAccounts();
      const clinicAdminAccount = allAccounts.filter(
        (acc) => acc.role === AccountRole.CLINIC_ADMIN,
      );

      if (!clinicAdminAccount || clinicAdminAccount.length === 0) {
        this.logger.warn(
          'Clinic admin account not found. Skipping manager seeding.',
        );
        return;
      }

      const clinicAdmin = clinicAdminAccount[0];

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

        // Create Account entity with parentId pointing to clinic admin
        const manager = this.accountRepository.createAccount({
          username: managerData.username,
          email: managerData.email,
          phone: managerData.phone,
          password: hashedPassword,
          role: AccountRole.CLINIC_MANAGER,
          status: AccountStatus.ACTIVE,
          isEmailVerified: true,
          isOAuthUser: false,
          parentId: clinicAdmin._id, // Link to clinic admin
        });

        const savedManager = await this.accountRepository.saveAccount(manager);

        // Create ClinicManagerInformation entity
        const clinicManagerInformation =
          this.clinicManagerInformationRepository.create({
            accountId: savedManager._id,
            clinicBranchName: managerData.clinicBranchName,
            fullName: managerData.fullName,
            gender: managerData.gender,
          });

        await this.clinicManagerInformationRepository.save(
          clinicManagerInformation,
        );

        // Create address for manager (specific district based on branch)
        // Manager 1 (Quận 1): District 1 (code 769), Manager 2 (Quận 7): District 7 (code 775)
        // Manager 3 (Thủ Đức): Thu Duc City (code 769)
        const districtCode =
          managerData.username === 'manager1'
            ? 769 // District 1
            : managerData.username === 'manager2'
            ? 775 // District 7
            : 769; // Thu Duc (using District 1 as fallback)
        await this.createAddress(savedManager._id, 79, districtCode);

        this.logger.log(
          `✅ Manager account created: ${managerData.email} (${managerData.clinicBranchName}) - Parent: ${clinicAdmin.email}`,
        );
      }

      this.logger.log('Manager accounts seeding completed');
    } catch (error) {
      this.logger.error('Failed to seed manager accounts', error.stack);
    }
  }

  /**
   * Seed 6 DOCTOR accounts (2 for each manager) with DoctorInformation
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

        // Create DoctorInformation entity
        const doctorInformation = this.doctorInformationRepository.create({
          accountId: savedDoctor._id,
          fullName: doctorData.fullName,
        });

        await this.doctorInformationRepository.save(doctorInformation);

        // Create address for doctor (same district as their manager)
        const districtCode =
          doctorData.managerUsername === 'manager1'
            ? 769 // District 1
            : doctorData.managerUsername === 'manager2'
            ? 775 // District 7
            : 769; // Thu Duc
        await this.createAddress(savedDoctor._id, 79, districtCode);

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

        // Create ClinicStaffInformation entity
        const clinicStaffInformation =
          this.clinicStaffInformationRepository.create({
            accountId: savedStaff._id,
            fullName: staffData.fullName,
            clinicRole: ClinicRole.STAFF,
          });

        await this.clinicStaffInformationRepository.save(
          clinicStaffInformation,
        );

        // Create address for staff (same district as their manager)
        const districtCode =
          staffData.managerUsername === 'manager1'
            ? 769 // District 1
            : staffData.managerUsername === 'manager2'
            ? 775 // District 7
            : 769; // Thu Duc
        await this.createAddress(savedStaff._id, 79, districtCode);

        this.logger.log(
          `✅ Staff account created: ${staffData.email} (${staffData.fullName}) - ${staffData.position} - Clinic: ${staffData.managerUsername}`,
        );
      }

      this.logger.log('Staff accounts seeding completed');
    } catch (error) {
      this.logger.error('Failed to seed staff accounts', error.stack);
    }
  }

  /**
   * Create address for an account
   */
  private async createAddress(
    accountId: string,
    provinceCode?: number,
    districtCode?: number,
  ): Promise<void> {
    try {
      // Check if address already exists
      const existing = await this.addressRepository.findByAccountId(accountId);
      // if (existing.length > 0) {
      //   return;
      // }

      // Get address data
      let addressData;
      if (provinceCode && districtCode) {
        addressData = await this.addressDataService.getAddressByDistrict(
          provinceCode,
          districtCode,
        );
      } else if (provinceCode) {
        addressData = await this.addressDataService.getAddressByProvince(
          provinceCode,
        );
      } else {
        addressData = await this.addressDataService.getRandomAddress();
      }

      if (!addressData) {
        this.logger.warn(`Failed to get address data for account ${accountId}`);
        return;
      }

      // Create address entity
      const address = this.addressRepository.create({
        accountId,
        address: `${Math.floor(Math.random() * 999) + 1} ${
          addressData.wardName
        }`,
        ward: addressData.wardCode.toString(),
        district: addressData.districtCode.toString(),
        province: addressData.provinceCode.toString(),
        provinceName: addressData.provinceName,
        districtName: addressData.districtName,
        wardName: addressData.wardName,
      });

      await this.addressRepository.save(address);
    } catch (error) {
      this.logger.warn(
        `Failed to create address for account ${accountId}`,
        error.message,
      );
    }
  }
}
