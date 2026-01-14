import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Account } from '../../modules/accounts/entities/accounts.entity';
import { ClinicAdminInformation } from '../../modules/accounts/entities/clinic-admin-information.entity';
import { AccountRole, AccountStatus } from '../../modules/accounts/enums';
import { BankName } from '../../modules/accounts/enums/bank-name.enum';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { ClinicAdminInformationRepository } from '../../modules/accounts/repositories/clinic-admin-information.repository';
import { AddressRepository } from '../../modules/accounts/repositories/address.repository';
import { AddressDataService } from './address-data.service';

/**
 * Clinic Admin Seeder Service
 * - Runs on application startup
 * - Seeds 1 CLINIC_ADMIN account with full clinic organization information
 * - Clinic Admin owns the entire clinic network and manages multiple branch managers
 * - Account is immediately ACTIVE with verified email
 */
@Injectable()
export class ClinicAdminSeederService {
  private readonly logger = new Logger(ClinicAdminSeederService.name);
  private readonly BCRYPT_SALT_ROUNDS = 10;

  // Default password for seeded accounts
  private readonly DEFAULT_PASSWORD = 'User@123456';

  // Clinic Admin data - represents the owner of the entire clinic organization
  private readonly CLINIC_ADMIN = {
    username: 'clinicadmin',
    email: 'admin@medicare-clinic.com',
    phone: '0901234567',
    clinicName: 'Medicare Clinic Network',
    description:
      'Hệ thống phòng khám đa khoa Medicare với mạng lưới chi nhánh rộng khắp, cung cấp dịch vụ y tế chất lượng cao với đội ngũ bác sĩ giàu kinh nghiệm và trang thiết bị hiện đại.',
    specializedIn: [
      'Nội khoa',
      'Ngoại khoa',
      'Sản phụ khoa',
      'Nhi khoa',
      'Tai mũi họng',
      'Răng hàm mặt',
      'Da liễu',
      'Tim mạch',
    ],
    pros: [
      'Đội ngũ bác sĩ chuyên môn cao',
      'Trang thiết bị y tế hiện đại',
      'Dịch vụ chăm sóc tận tâm',
      'Mạng lưới chi nhánh rộng khắp',
      'Giá cả hợp lý, minh bạch',
    ],
    paraclinical: [
      'X-quang',
      'Siêu âm',
      'Xét nghiệm máu',
      'Điện tim',
      'Nội soi',
      'CT Scanner',
      'MRI',
    ],
    bankName: BankName.VIETINBANK,
    bankNumber: 1234567890,
    bankBranch: 'Chi nhánh Thành phố Hồ Chí Minh',
    sepayVa: '000123456789',
  };

  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly clinicAdminInformationRepository: ClinicAdminInformationRepository,
    private readonly addressRepository: AddressRepository,
    private readonly addressDataService: AddressDataService,
  ) {}

  /**
   * Seed clinic admin account if it doesn't exist
   *
   * Creates both Account and ClinicAdminInformation entities
   * Clinic Admin account is immediately ACTIVE with verified email
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
   */
  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed clinic admin account...');

      // Check if clinic admin already exists by email
      const existingClinicAdmin =
        await this.accountRepository.findAccountByEmail(
          this.CLINIC_ADMIN.email,
        );

      if (existingClinicAdmin) {
        this.logger.log('Clinic admin account already exists');
        return;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(
        this.DEFAULT_PASSWORD,
        this.BCRYPT_SALT_ROUNDS,
      );

      // Create Account entity
      const clinicAdmin = this.accountRepository.createAccount({
        username: this.CLINIC_ADMIN.username,
        email: this.CLINIC_ADMIN.email,
        phone: this.CLINIC_ADMIN.phone,
        password: hashedPassword,
        role: AccountRole.CLINIC_ADMIN,
        status: AccountStatus.ACTIVE,
        isEmailVerified: true,
        isOAuthUser: false,
      });

      const savedClinicAdmin = await this.accountRepository.saveAccount(
        clinicAdmin,
      );

      // Create ClinicAdminInformation entity
      const clinicAdminInfo = this.clinicAdminInformationRepository.create({
        accountId: savedClinicAdmin._id,
        clinicName: this.CLINIC_ADMIN.clinicName,
        description: this.CLINIC_ADMIN.description,
        specializedIn: this.CLINIC_ADMIN.specializedIn,
        pros: this.CLINIC_ADMIN.pros,
        paraclinical: this.CLINIC_ADMIN.paraclinical,
        bankName: this.CLINIC_ADMIN.bankName,
        bankNumber: this.CLINIC_ADMIN.bankNumber,
        bankBranch: this.CLINIC_ADMIN.bankBranch,
        sepayVa: this.CLINIC_ADMIN.sepayVa,
        isVerify: false,
      });

      await this.clinicAdminInformationRepository.save(clinicAdminInfo);

      // Create address for clinic admin (Ho Chi Minh City)
      await this.createAddress(savedClinicAdmin._id, 79);

      this.logger.log(
        `✅ Clinic admin account created: ${this.CLINIC_ADMIN.email} (${this.CLINIC_ADMIN.clinicName})`,
      );
      this.logger.warn(
        `⚠️  Default password: ${this.DEFAULT_PASSWORD} - CHANGE IMMEDIATELY!`,
      );
    } catch (error) {
      this.logger.error('Failed to seed clinic admin account', error.stack);
    }
  }

  /**
   * Create address for an account
   */
  private async createAddress(
    accountId: string,
    provinceCode?: number,
  ): Promise<void> {
    try {
      // Check if address already exists
      const existing = await this.addressRepository.findByAccountId(accountId);
      // if (existing.length > 0) {
      //   return;
      // }

      // Get address data
      const addressData = provinceCode
        ? await this.addressDataService.getAddressByProvince(provinceCode)
        : await this.addressDataService.getRandomAddress();

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
