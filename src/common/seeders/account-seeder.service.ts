import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { generateRSAKeyPair } from '../utils/util';
import { Account } from '../../modules/accounts/entities/accounts.entity';
import {
  AccountRole,
  AccountStatus,
  Gender,
} from '../../modules/accounts/enums';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { AddressRepository } from '../../modules/accounts/repositories/address.repository';
import { GoogleIframeRepository } from '../../modules/accounts/repositories/google-iframe.repository';
import { ENGLISH_NAMES } from '../constants/names';
import {
  PROVINCES,
  WARDS_D1_HCMC,
  STREET_NAMES,
  BUILDING_TYPES,
} from '../constants/locations';

/**
 * Account Seeder Service
 *
 * Seeds accounts for all roles with proper parent-child relationships:
 * - CLINIC_ADMIN: 5 accounts (no parent)
 * - CLINIC_MANAGER: 1-3 per CLINIC_ADMIN (parent_id = CLINIC_ADMIN)
 * - CLINIC_STAFF: 5-10 per CLINIC_MANAGER (parent_id = CLINIC_MANAGER)
 * - DOCTOR: 5-10 per CLINIC_MANAGER (parent_id = CLINIC_MANAGER)
 * - PATIENT: 10 accounts (no parent)
 *
 * Seeding Order:
 * 1. CLINIC_ADMIN accounts
 * 2. CLINIC_MANAGER accounts (with parentId = CLINIC_ADMIN)
 * 3. CLINIC_STAFF accounts (with parentId = CLINIC_MANAGER)
 * 4. DOCTOR accounts (with parentId = CLINIC_MANAGER)
 * 5. PATIENT accounts
 *
 * Idempotent: Uses check-then-insert pattern by email
 */
@Injectable()
export class AccountSeederService {
  private readonly logger = new Logger(AccountSeederService.name);
  private readonly BCRYPT_SALT_ROUNDS = 10;
  private readonly DEFAULT_PASSWORD = 'Test@123456';

  // English names for realistic data
  private readonly NAMES = ENGLISH_NAMES;

  // Vietnamese location constants for address generation
  private readonly PROVINCES = PROVINCES;
  private readonly WARDS = WARDS_D1_HCMC;
  private readonly STREET_NAMES = STREET_NAMES;
  private readonly BUILDING_TYPES = BUILDING_TYPES;

  // 7 real addresses for Google Maps compatibility (English format)
  private readonly REAL_ADDRESSES = [
    {
      address: '135 Nam Ky Khoi Nghia, Ben Thanh Ward, District 1, Ho Chi Minh City',
      ward: 'Ben Thanh Ward',
      district: 'District 1',
      province: 'Ho Chi Minh City',
      wardCode: '27104',
      districtCode: '760',
      provinceCode: '79',
      googleIframe:
        '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3723.867128869523!2d106.692877!3d10.790093!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31752f3a5a5d5a5d%3A0x0!2s135%20Nam%20Ky%20Khoi%20Nghia!5e0!3m2!1sen!2s!4v1609459200000" width="600" height="400" style="border:0;" allowfullscreen="" loading="lazy"></iframe>',
      clinicName: 'Bonix Ho Chi Minh - D1',
    },
    {
      address: '534 Vinh Khanh, Ward 8, District 4, Ho Chi Minh City',
      ward: 'Ward 8',
      district: 'District 4',
      province: 'Ho Chi Minh City',
      wardCode: '27121',
      districtCode: '764',
      provinceCode: '79',
      googleIframe:
        '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3724.567823456789!2d106.707678!3d10.781234!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31752f4c4c4c4c4c%3A0x0!2s534%20Vinh%20Khanh!5e0!3m2!1sen!2s!4v1609459200000" width="600" height="400" style="border:0;" allowfullscreen="" loading="lazy"></iframe>',
      clinicName: 'Bonix Ho Chi Minh - D4',
    },
    {
      address: '58 Quoc Tu Giam, Dong Da District, Hanoi',
      ward: 'Quoc Tu Giam',
      district: 'Dong Da District',
      province: 'Hanoi',
      wardCode: '00056',
      districtCode: '105',
      provinceCode: '01',
      googleIframe:
        '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3724.123456789012!2d105.845678!3d21.028512!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3135a5e5e5e5e5e5%3A0x0!2s58%20Quoc%20Tu%20Giam!5e0!3m2!1sen!2s!4v1609459200000" width="600" height="400" style="border:0;" allowfullscreen="" loading="lazy"></iframe>',
      clinicName: 'Bonix Hanoi - Dong Da',
    },
    {
      address: '10 Ly Quoc Su, Hoan Kiem District, Hanoi',
      ward: 'Ly Quoc Su',
      district: 'Hoan Kiem District',
      province: 'Hanoi',
      wardCode: '00045',
      districtCode: '104',
      provinceCode: '01',
      googleIframe:
        '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3724.234567890123!2d105.856789!3d21.028123!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3135a5d5d5d5d5d5%3A0x0!2s10%20Ly%20Quoc%20Su!5e0!3m2!1sen!2s!4v1609459200000" width="600" height="400" style="border:0;" allowfullscreen="" loading="lazy"></iframe>',
      clinicName: 'Bonix Hanoi - Hoan Kiem',
    },
    {
      address: '61 Hai Thang Tu, Vinh Phuoc Ward, Nha Trang',
      ward: 'Vinh Phuoc Ward',
      district: 'Nha Trang',
      province: 'Khanh Hoa',
      wardCode: '93158',
      districtCode: '931',
      provinceCode: '56',
      googleIframe:
        '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3725.345678901234!2d109.196789!3d12.245678!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31706e6e6e6e6e6e6%3A0x0!2s61%20Hai%20Thang%20Tu!5e0!3m2!1sen!2s!4v1609459200000" width="600" height="400" style="border:0;" allowfullscreen="" loading="lazy"></iframe>',
      clinicName: 'Bonix Nha Trang',
    },
    {
      address: '81 Huyen Tran Cong Chua, Ngu Hanh Son District, Da Nang',
      ward: 'Ngu Hanh Son District',
      district: 'Da Nang',
      province: 'Da Nang',
      wardCode: '48201',
      districtCode: '488',
      provinceCode: '48',
      googleIframe:
        '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3726.456789012345!2d108.245678!3d16.054123!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31420e7e7e7e7e7e7%3A0x0!2s81%20Huyen%20Tran%20Cong%20Chua!5e0!3m2!1en!2s!4v1609459200000" width="600" height="400" style="border:0;" allowfullscreen="" loading="lazy"></iframe>',
      clinicName: 'Bonix Da Nang',
    },
    {
      address: '46 Hai Ba Trung Street, Ninh Kieu District, Can Tho',
      ward: 'Ninh Kieu District',
      district: 'Can Tho',
      province: 'Can Tho',
      wardCode: '95018',
      districtCode: '956',
      provinceCode: '92',
      googleIframe:
        '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3727.567890123456!2d105.756789!3d10.045678!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x319e8f8f8f8f8f8f8%3A0x0!2s46%20Hai%20Ba%20Trung!5e0!3m2!1sen!2s!4v1609459200000" width="600" height="400" style="border:0;" allowfullscreen="" loading="lazy"></iframe>',
      clinicName: 'Bonix Can Tho',
    },
  ];

  // Map admin index to address index (repeats for admins 8, 9, 10)
  private readonly ADMIN_ADDRESS_MAPPING = [0, 1, 2, 3, 4, 5, 6, 0, 1, 2];

  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly addressRepository: AddressRepository,
    private readonly googleIframeRepository: GoogleIframeRepository,
  ) {}

  async seedBaseAccounts(): Promise<void> {
    try {
      this.logger.log(
        'Starting to seed base accounts (Admins, Managers, Patients)...',
      );

      const clinicAdmins = await this.seedClinicAdmins();
      await this.seedClinicManagers(clinicAdmins);
      await this.seedPatients();
      await this.ensureAddressesAndGoogleIframes();

      this.logger.log('Base Account seeding completed successfully');
    } catch (error) {
      this.logger.error('Failed to seed base accounts', error.stack);
      throw error;
    }
  }

  /**
   * Seed employee accounts (Staff, Doctors) AFTER subscriptions are set up
   */
  async seedEmployeeAccounts(): Promise<void> {
    try {
      this.logger.log('Starting to seed employee accounts (Staff, Doctors)...');

      const clinicAdmins = await this.accountRepository
        .findAllAccounts()
        .then((accounts) =>
          accounts.filter((acc) => acc.role === AccountRole.CLINIC_ADMIN),
        );

      // Get all managers
      const allManagers = await this.accountRepository
        .findAllAccounts()
        .then((accounts) =>
          accounts.filter((acc) => acc.role === AccountRole.CLINIC_MANAGER),
        );

      // Filter managers whose parentId is in the first 10 clinic admins (which are ACTIVE)
      const activeClinicAdminIds = clinicAdmins.slice(0, 10).map((a) => a._id);
      const activeManagers = allManagers.filter((m) =>
        activeClinicAdminIds.includes(m.parentId),
      );

      if (activeManagers.length === 0) {
        this.logger.warn(
          'No active managers found, skipping employee seeding.',
        );
        return;
      }

      // Step 3: Seed CLINIC_STAFF accounts
      await this.seedClinicStaff(activeManagers);

      // Step 4: Seed DOCTOR accounts
      await this.seedDoctors(activeManagers);

      // Ensure employees also get addresses
      await this.ensureAddressesAndGoogleIframes();

      this.logger.log('✅ Employee Account seeding completed successfully');
    } catch (error) {
      this.logger.error('Failed to seed employee accounts', error.stack);
      throw error;
    }
  }

  /**
   * Seed CLINIC_ADMIN accounts
   * Creates exactly 10 CLINIC_ADMIN accounts with specific locations
   */
  private async seedClinicAdmins(): Promise<Account[]> {
    const CLINIC_ADMIN_COUNT = 10; // 10 admins with distributed scenarios
    const existingCount = await this.accountRepository.countByRole(
      AccountRole.CLINIC_ADMIN,
    );

    if (existingCount >= CLINIC_ADMIN_COUNT) {
      this.logger.log(
        `CLINIC_ADMIN accounts already exist (${existingCount}). Skipping seeding.`,
      );
      return this.accountRepository
        .findAllAccounts()
        .then((accounts) =>
          accounts.filter((acc) => acc.role === AccountRole.CLINIC_ADMIN),
        );
    }

    this.logger.log(`Seeding ${CLINIC_ADMIN_COUNT} CLINIC_ADMIN accounts...`);

    const hashedPassword = await bcrypt.hash(
      this.DEFAULT_PASSWORD,
      this.BCRYPT_SALT_ROUNDS,
    );

    const clinicAdmins: Account[] = [];

    for (let i = 1; i <= CLINIC_ADMIN_COUNT; i++) {
      const email = `clinic_admin_${i}@bonix.test`;
      const existing = await this.accountRepository.findAccountByEmail(email);

      if (existing) {
        clinicAdmins.push(existing);
        continue;
      }

      const account = this.accountRepository.createAccount({
        username: `clinic_admin_${i}`,
        email,
        password: hashedPassword,
        phone: this.randomVietnamPhone(),
        role: AccountRole.CLINIC_ADMIN,
        status: AccountStatus.ACTIVE,
        isEmailVerified: true,
        isOAuthUser: false,
      });

      const keyPair = generateRSAKeyPair();
      account.publicKey = keyPair.publicKey;
      account.encryptedPrivateKey = keyPair.privateKey;

      const saved = await this.accountRepository.saveAccount(account);
      clinicAdmins.push(saved);
    }

    this.logger.log(`✅ Created ${clinicAdmins.length} CLINIC_ADMIN accounts`);
    return clinicAdmins;
  }

  /**
   * Seed CLINIC_MANAGER accounts
   * Creates 1-3 CLINIC_MANAGER accounts per CLINIC_ADMIN
   */
  private async seedClinicManagers(
    clinicAdmins: Account[],
  ): Promise<Account[]> {
    const clinicManagers: Account[] = [];

    for (let index = 0; index < clinicAdmins.length; index++) {
      const clinicAdmin = clinicAdmins[index];
      const isPending = index >= 5;

      // Pending clinics may or may not have a manager set up
      if (isPending && Math.random() < 0.3) {
        continue;
      }

      const count = isPending ? 1 : this.getRandomInt(1, 3);

      for (let i = 1; i <= count; i++) {
        const email = `clinic_manager_${
          clinicAdmins.indexOf(clinicAdmin) + 1
        }_${i}@bonix.test`;
        const existing = await this.accountRepository.findAccountByEmail(email);

        if (existing) {
          clinicManagers.push(existing);
          continue;
        }

        const hashedPassword = await bcrypt.hash(
          this.DEFAULT_PASSWORD,
          this.BCRYPT_SALT_ROUNDS,
        );

        const account = this.accountRepository.createAccount({
          username: `clinic_manager_${
            clinicAdmins.indexOf(clinicAdmin) + 1
          }_${i}`,
          email,
          password: hashedPassword,
          phone: this.randomVietnamPhone(),
          parentId: clinicAdmin._id,
          role: AccountRole.CLINIC_MANAGER,
          status: AccountStatus.ACTIVE,
          isEmailVerified: true,
          isOAuthUser: false,
        });

        const keyPair = generateRSAKeyPair();
        account.publicKey = keyPair.publicKey;
        account.encryptedPrivateKey = keyPair.privateKey;

        const saved = await this.accountRepository.saveAccount(account);
        clinicManagers.push(saved);
      }
    }

    this.logger.log(
      `✅ Created ${clinicManagers.length} CLINIC_MANAGER accounts`,
    );
    return clinicManagers;
  }

  /**
   * Seed CLINIC_STAFF accounts
   * Creates 5-10 CLINIC_STAFF accounts per CLINIC_MANAGER
   */
  private async seedClinicStaff(clinicManagers: Account[]): Promise<void> {
    let createdCount = 0;

    for (const clinicManager of clinicManagers) {
      const count = this.getRandomInt(5, 10);

      for (let i = 1; i <= count; i++) {
        const email = `clinic_staff_${
          clinicManagers.indexOf(clinicManager) + 1
        }_${i}@bonix.test`;
        const existing = await this.accountRepository.findAccountByEmail(email);

        if (existing) {
          continue;
        }

        const hashedPassword = await bcrypt.hash(
          this.DEFAULT_PASSWORD,
          this.BCRYPT_SALT_ROUNDS,
        );

        const account = this.accountRepository.createAccount({
          username: `clinic_staff_${
            clinicManagers.indexOf(clinicManager) + 1
          }_${i}`,
          email,
          password: hashedPassword,
          phone: this.randomVietnamPhone(),
          parentId: clinicManager._id,
          role: AccountRole.CLINIC_STAFF,
          status: AccountStatus.ACTIVE,
          isEmailVerified: true,
          isOAuthUser: false,
        });

        const keyPair = generateRSAKeyPair();
        account.publicKey = keyPair.publicKey;
        account.encryptedPrivateKey = keyPair.privateKey;

        await this.accountRepository.saveAccount(account);
        createdCount++;
      }
    }

    this.logger.log(`✅ Created ${createdCount} CLINIC_STAFF accounts`);
  }

  /**
   * Seed DOCTOR accounts
   * Creates 5-10 DOCTOR accounts per CLINIC_MANAGER
   */
  private async seedDoctors(clinicManagers: Account[]): Promise<void> {
    let createdCount = 0;

    for (const clinicManager of clinicManagers) {
      const count = this.getRandomInt(5, 10);

      for (let i = 1; i <= count; i++) {
        const email = `doctor_${
          clinicManagers.indexOf(clinicManager) + 1
        }_${i}@bonix.test`;
        const existing = await this.accountRepository.findAccountByEmail(email);

        if (existing) {
          continue;
        }

        const hashedPassword = await bcrypt.hash(
          this.DEFAULT_PASSWORD,
          this.BCRYPT_SALT_ROUNDS,
        );

        const account = this.accountRepository.createAccount({
          username: `doctor_${clinicManagers.indexOf(clinicManager) + 1}_${i}`,
          email,
          password: hashedPassword,
          phone: this.randomVietnamPhone(),
          parentId: clinicManager._id,
          role: AccountRole.DOCTOR,
          status: AccountStatus.ACTIVE,
          isEmailVerified: true,
          isOAuthUser: false,
        });

        const keyPair = generateRSAKeyPair();
        account.publicKey = keyPair.publicKey;
        account.encryptedPrivateKey = keyPair.privateKey;

        await this.accountRepository.saveAccount(account);
        createdCount++;
      }
    }

    this.logger.log(`✅ Created ${createdCount} DOCTOR accounts`);
  }

  /**
   * Seed PATIENT accounts
   * Creates exactly 10 PATIENT accounts
   */
  private async seedPatients(): Promise<void> {
    const PATIENT_COUNT = 10;
    const existingCount = await this.accountRepository.countByRole(
      AccountRole.PATIENT,
    );

    if (existingCount >= PATIENT_COUNT) {
      this.logger.log(
        `PATIENT accounts already exist (${existingCount}). Skipping seeding.`,
      );
      return;
    }

    this.logger.log(`Seeding ${PATIENT_COUNT} PATIENT accounts...`);

    const hashedPassword = await bcrypt.hash(
      this.DEFAULT_PASSWORD,
      this.BCRYPT_SALT_ROUNDS,
    );

    let createdCount = 0;

    for (let i = 1; i <= PATIENT_COUNT; i++) {
      const email = `patient_${i}@bonix.test`;
      const existing = await this.accountRepository.findAccountByEmail(email);

      if (existing) {
        continue;
      }

      const account = this.accountRepository.createAccount({
        username: `patient_${i}`,
        email,
        password: hashedPassword,
        phone: this.randomVietnamPhone(),
        role: AccountRole.PATIENT,
        status: AccountStatus.ACTIVE,
        isEmailVerified: true,
        isOAuthUser: false,
      });

      await this.accountRepository.saveAccount(account);
      createdCount++;
    }

    this.logger.log(`✅ Created ${createdCount} PATIENT accounts`);
  }

  /**
   * Ensure all accounts have addresses and Google iframes
   *
   * This method is idempotent and applies to ALL roles:
   * - PATIENT, ADMIN, CLINIC_ADMIN, CLINIC_MANAGER, CLINIC_STAFF, DOCTOR
   *
   * For CLINIC_ADMIN accounts, use the 7 predefined real addresses
   * For other accounts, generate random addresses
   *
   * For each account:
   * 1. Check if address exists, if not create one with Vietnamese format
   * 2. Check if google_iframe exists for that address, if not create one
   */
  private async ensureAddressesAndGoogleIframes(): Promise<void> {
    this.logger.log(
      'Ensuring all accounts have addresses and Google iframes...',
    );

    // Get all accounts from database
    const allAccounts = await this.accountRepository.findAllAccounts();

    if (allAccounts.length === 0) {
      this.logger.warn('No accounts found. Skipping address/iframe seeding.');
      return;
    }

    let addressesCreated = 0;
    let addressesSkipped = 0;
    let iframesCreated = 0;
    let iframesSkipped = 0;

    for (const account of allAccounts) {
      // Step 1: Check and create address if needed
      let address = await this.addressRepository.findByAccountId(account._id);

      if (!address) {
        let addressData;

        // Use predefined addresses for clinic admins (first 10 accounts)
        if (account.role === AccountRole.CLINIC_ADMIN) {
          const clinicAdmins = allAccounts.filter(
            (a) => a.role === AccountRole.CLINIC_ADMIN,
          );
          const adminIndex = clinicAdmins.findIndex(
            (a) => a._id === account._id,
          );
          const addressIndex =
            adminIndex >= 0 ? this.ADMIN_ADDRESS_MAPPING[adminIndex] : 0;
          const realAddress = this.REAL_ADDRESSES[addressIndex];

          addressData = {
            address: realAddress.address,
            ward: realAddress.ward,
            district: realAddress.district,
            province: realAddress.province,
            wardCode: realAddress.wardCode,
            districtCode: realAddress.districtCode,
            provinceName: realAddress.province,
          };
        } else {
          // Generate Vietnamese-style address for other roles
          const location = this.getRandomLocation();
          const streetAddress = this.generateStreetAddress();
          addressData = {
            address: streetAddress,
            ward: location.wardCode,
            district: location.districtCode,
            province: location.provinceCode,
            provinceName: location.provinceName,
            districtName: location.districtName,
            wardName: location.wardName,
          };
        }

        address = this.addressRepository.create({
          accountId: account._id,
          address: addressData.address,
          ward: addressData.ward,
          district: addressData.district,
          province: addressData.province,
          provinceName: addressData.provinceName,
          districtName: addressData.districtName || '',
          wardName: addressData.wardName || '',
        });

        address = await this.addressRepository.save(address);
        addressesCreated++;
        this.logger.debug(
          `Created address for account ${account.email} (${account.role})`,
        );
      } else {
        addressesSkipped++;
      }

      // Step 2: Check and create Google iframe if needed
      const iframeExists = await this.googleIframeRepository.existsByAddressId(
        address._id,
      );

      if (!iframeExists) {
        // Use predefined iframe for clinic admins
        let googleMapIframe: string;

        if (account.role === AccountRole.CLINIC_ADMIN) {
          const clinicAdmins = allAccounts.filter(
            (a) => a.role === AccountRole.CLINIC_ADMIN,
          );
          const adminIndex = clinicAdmins.findIndex(
            (a) => a._id === account._id,
          );
          const addressIndex =
            adminIndex >= 0 ? this.ADMIN_ADDRESS_MAPPING[adminIndex] : 0;
          googleMapIframe = this.REAL_ADDRESSES[addressIndex].googleIframe;
        } else {
          // Generate Google Maps iframe for other roles
          const mapTemplate = this.getMapTemplateForProvince(
            address.provinceName,
          );
          googleMapIframe = mapTemplate.placeholder;
        }

        const googleIframe = this.googleIframeRepository.create({
          addressId: address._id,
          location: address.address,
          zoomLevel: 14,
          responsive: true,
          googleMapIframe,
        });

        await this.googleIframeRepository.save(googleIframe);
        iframesCreated++;
        this.logger.debug(`Created Google iframe for address ${address._id}`);
      } else {
        iframesSkipped++;
      }
    }

    this.logger.log(
      `✅ Address and Google iframe seeding completed: ` +
        `Addresses: ${addressesCreated} created, ${addressesSkipped} skipped | ` +
        `Iframes: ${iframesCreated} created, ${iframesSkipped} skipped`,
    );
  }

  /**
   * Generate random street address in Vietnamese format
   */
  private generateStreetAddress(): string {
    const buildingType =
      this.BUILDING_TYPES[
        Math.floor(Math.random() * this.BUILDING_TYPES.length)
      ];
    const buildingNumber = Math.floor(Math.random() * 500) + 1;
    const streetName =
      this.STREET_NAMES[Math.floor(Math.random() * this.STREET_NAMES.length)];
    return `${buildingType} ${buildingNumber}, ${streetName}`;
  }

  /**
   * Get random cohesive location details
   */
  private getRandomLocation() {
    const province =
      this.PROVINCES[Math.floor(Math.random() * this.PROVINCES.length)];
    const district =
      province.districts[Math.floor(Math.random() * province.districts.length)];
    const ward = this.WARDS[Math.floor(Math.random() * this.WARDS.length)];

    return {
      provinceCode: String(province.code),
      provinceName: province.name,
      districtCode: String(district.code),
      districtName: district.name,
      wardCode: String(ward.code),
      wardName: ward.name,
    };
  }

  /**
   * Get map template based on province name for Vietnamese cities
   */
  private getMapTemplateForProvince(provinceName: string): {
    city: string;
    center: string;
    placeholder: string;
  } {
    const lowerProvinceName = provinceName.toLowerCase();

    // Match Vietnamese city names
    if (
      lowerProvinceName.includes('hanoi') ||
      lowerProvinceName.includes('ha noi')
    ) {
      return { city: 'Hanoi', center: '21.0285,105.8542', placeholder: this.REAL_ADDRESSES[2].googleIframe };
    }
    if (lowerProvinceName.includes('ho chi minh')) {
      return { city: 'Ho Chi Minh', center: '10.8231,106.6297', placeholder: this.REAL_ADDRESSES[0].googleIframe };
    }
    if (lowerProvinceName.includes('da nang')) {
      return { city: 'Da Nang', center: '16.0544,108.2022', placeholder: this.REAL_ADDRESSES[5].googleIframe };
    }
    if (lowerProvinceName.includes('can tho')) {
      return { city: 'Can Tho', center: '10.0452,105.7469', placeholder: this.REAL_ADDRESSES[6].googleIframe };
    }
    if (lowerProvinceName.includes('nha trang') || lowerProvinceName.includes('khanh hoa')) {
      return { city: 'Nha Trang', center: '109.196789,12.245678', placeholder: this.REAL_ADDRESSES[4].googleIframe };
    }

    // Default to Ho Chi Minh City template
    return { city: 'Ho Chi Minh', center: '10.8231,106.6297', placeholder: this.REAL_ADDRESSES[0].googleIframe };
  }

  /**
   * Generate random Vietnamese local phone number
   */
  private randomVietnamPhone(): string {
    return `0${this.randomDigits(9)}`;
  }

  /**
   * Generate random digits string
   */
  private randomDigits(length: number): string {
    let digits = '';
    for (let i = 0; i < length; i++) {
      digits += Math.floor(Math.random() * 10);
    }
    return digits;
  }

  /**
   * Get random integer between min and max (inclusive)
   */
  private getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
