import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
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

  // Google Maps iframe templates for Vietnamese cities
  private readonly MAP_IFRAME_TEMPLATES = [
    {
      city: 'Ha Noi',
      center: '21.0285,105.8542',
      placeholder:
        '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d105.8542!2d21.0285!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2sHa+Noi!5e0!3m2!1svi!2svi!4s2023-01-01" width="600" height="400" style="border:0;" allowfullscreen="" loading="lazy"></iframe>',
    },
    {
      city: 'Ho Chi Minh',
      center: '10.8231,106.6297',
      placeholder:
        '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d106.6297!2d10.8231!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1svi!2svi!4s2023-01-01" width="600" height="400" style="border:0;" allowfullscreen="" loading="lazy"></iframe>',
    },
    {
      city: 'Da Nang',
      center: '16.0544,108.2022',
      placeholder:
        '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d108.2022!2d16.0544!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1svi!2svi!4s2023-01-01" width="600" height="400" style="border:0;" allowfullscreen="" loading="lazy"></iframe>',
    },
    {
      city: 'Can Tho',
      center: '10.0452,105.7469',
      placeholder:
        '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d105.7469!2d10.0452!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1svi!2svi!4s2023-01-01" width="600" height="400" style="border:0;" allowfullscreen="" loading="lazy"></iframe>',
    },
  ];

  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly addressRepository: AddressRepository,
    private readonly googleIframeRepository: GoogleIframeRepository,
  ) { }

  private generateKeyPair(): {
    publicKey: string;
    encryptedPrivateKey: string;
  } {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    return { publicKey, encryptedPrivateKey: privateKey };
  }

  async seedBaseAccounts(): Promise<void> {
    try {
      this.logger.log(
        'Starting to seed base accounts (Admins, Managers, Patients)...',
      );

      // Step 1: Seed CLINIC_ADMIN accounts
      const clinicAdmins = await this.seedClinicAdmins();

      // Step 2: Seed CLINIC_MANAGER accounts
      await this.seedClinicManagers(clinicAdmins);

      // Step 5: Seed PATIENT accounts
      await this.seedPatients();

      // Step 6: Ensure all accounts have addresses and google iframes
      await this.ensureAddressesAndGoogleIframes();

      this.logger.log('✅ Base Account seeding completed successfully');
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

      // Only get clinic managers belonging to ACTIVE clinics
      // For simplicity, since the first 5 are active, we just get their managers.
      // But we can also be explicit: only the first 5 clinic admins
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

      // Filter managers whose parentId is in the first 5 clinic admins (which are ACTIVE)
      const activeClinicAdminIds = clinicAdmins.slice(0, 5).map((a) => a._id);
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
   * Creates exactly 5 CLINIC_ADMIN accounts
   */
  private async seedClinicAdmins(): Promise<Account[]> {
    const CLINIC_ADMIN_COUNT = 8; // 5 Active, 3 Pending
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
        phone: `0${this.randomPhoneDigits()}`,
        role: AccountRole.CLINIC_ADMIN,
        status: AccountStatus.ACTIVE,
        isEmailVerified: true,
        isOAuthUser: false,
      });

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
        const email = `clinic_manager_${clinicAdmins.indexOf(clinicAdmin) + 1
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
          username: `clinic_manager_${clinicAdmins.indexOf(clinicAdmin) + 1
            }_${i}`,
          email,
          password: hashedPassword,
          phone: `0${this.randomPhoneDigits()}`,
          parentId: clinicAdmin._id,
          role: AccountRole.CLINIC_MANAGER,
          status: AccountStatus.ACTIVE,
          isEmailVerified: true,
          isOAuthUser: false,
        });

        const keyPair = this.generateKeyPair();
        account.publicKey = keyPair.publicKey;
        account.encryptedPrivateKey = keyPair.encryptedPrivateKey;

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
        const email = `clinic_staff_${clinicManagers.indexOf(clinicManager) + 1
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
          username: `clinic_staff_${clinicManagers.indexOf(clinicManager) + 1
            }_${i}`,
          email,
          password: hashedPassword,
          phone: `0${this.randomPhoneDigits()}`,
          parentId: clinicManager._id,
          role: AccountRole.CLINIC_STAFF,
          status: AccountStatus.ACTIVE,
          isEmailVerified: true,
          isOAuthUser: false,
        });

        const keyPair = this.generateKeyPair();
        account.publicKey = keyPair.publicKey;
        account.encryptedPrivateKey = keyPair.encryptedPrivateKey;

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
        const email = `doctor_${clinicManagers.indexOf(clinicManager) + 1
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
          phone: `0${this.randomPhoneDigits()}`,
          parentId: clinicManager._id,
          role: AccountRole.DOCTOR,
          status: AccountStatus.ACTIVE,
          isEmailVerified: true,
          isOAuthUser: false,
        });

        const keyPair = this.generateKeyPair();
        account.publicKey = keyPair.publicKey;
        account.encryptedPrivateKey = keyPair.encryptedPrivateKey;

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
        phone: `0${this.randomPhoneDigits()}`,
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
        // Generate Vietnamese-style address
        const location = this.getRandomLocation();
        const streetAddress = this.generateStreetAddress();

        address = this.addressRepository.create({
          accountId: account._id,
          address: streetAddress,
          ward: location.wardCode,
          district: location.districtCode,
          province: location.provinceCode,
          provinceName: location.provinceName,
          districtName: location.districtName,
          wardName: location.wardName,
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
        // Generate Google Maps iframe
        const mapTemplate = this.getMapTemplateForProvince(
          address.provinceName,
        );
        const fullAddress = `${address.address}, ${address.wardName}, ${address.districtName}, ${address.provinceName}`;

        const googleIframe = this.googleIframeRepository.create({
          addressId: address._id,
          location: fullAddress,
          zoomLevel: 14,
          responsive: true,
          googleMapIframe: mapTemplate.placeholder,
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
      return this.MAP_IFRAME_TEMPLATES[0];
    }
    if (lowerProvinceName.includes('ho chi minh')) {
      return this.MAP_IFRAME_TEMPLATES[1];
    }
    if (lowerProvinceName.includes('da nang')) {
      return this.MAP_IFRAME_TEMPLATES[2];
    }
    if (lowerProvinceName.includes('can tho')) {
      return this.MAP_IFRAME_TEMPLATES[3];
    }

    // Default to Ho Chi Minh City template
    return this.MAP_IFRAME_TEMPLATES[1];
  }

  /**
   * Generate random 9-digit phone number
   */
  private randomPhoneDigits(): string {
    let digits = '';
    for (let i = 0; i < 9; i++) {
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
