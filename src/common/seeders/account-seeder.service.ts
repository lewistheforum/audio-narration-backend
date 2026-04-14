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
import { CLINIC_LOCATIONS } from '../constants/locations';

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

  private readonly CLINIC_LOCATIONS = CLINIC_LOCATIONS;

  private readonly MANAGER_ADDRESS_MAPPING: Record<number, number> = {
    0: 0,
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 0,
    8: 1,
    9: 2,
  };

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
      const email = `clinic_admin_${i}@medicare.test`;
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
        }_${i}@medicare.test`;
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
        }_${i}@medicare.test`;
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
        }_${i}@medicare.test`;
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
      const email = `patient_${i}@medicare.test`;
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
      'Ensuring CLINIC_MANAGER accounts have addresses and Google iframes...',
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

    // Process only CLINIC_MANAGER accounts for address assignment
    const clinicManagers = allAccounts.filter(
      (account) => account.role === AccountRole.CLINIC_MANAGER,
    );

    this.logger.log(`Found ${clinicManagers.length} CLINIC_MANAGER accounts`);

    for (const manager of clinicManagers) {
      // Step 1: Check and create address if needed
      let address = await this.addressRepository.findByAccountId(manager._id);

      if (!address) {
        // Use predefined addresses for clinic managers
        const managerIndex = clinicManagers.indexOf(manager);
        const locationIndex = this.MANAGER_ADDRESS_MAPPING[managerIndex] ?? managerIndex % 7;
        const location = this.CLINIC_LOCATIONS[locationIndex];

        address = this.addressRepository.create({
          accountId: manager._id,
          address: location.address,
          ward: location.wardCode,
          district: location.districtCode,
          province: location.provinceCode,
          provinceName: location.province,
          districtName: location.district,
          wardName: location.ward,
        });

        address = await this.addressRepository.save(address);
        addressesCreated++;
        this.logger.debug(
          `Created address for manager ${manager.email}`,
        );
      } else {
        addressesSkipped++;
      }

      // Step 2: Check and create Google iframe if needed
      const iframeExists = await this.googleIframeRepository.existsByAddressId(
        address._id,
      );

      if (!iframeExists) {
        // Use predefined iframe for clinic managers
        const managerIndex = clinicManagers.indexOf(manager);
        const locationIndex = this.MANAGER_ADDRESS_MAPPING[managerIndex] ?? managerIndex % 7;
        const location = this.CLINIC_LOCATIONS[locationIndex];

        const googleIframe = this.googleIframeRepository.create({
          addressId: address._id,
          location: location.address,
          zoomLevel: 14,
          responsive: true,
          googleMapIframe: location.googleIframe,
        });

        await this.googleIframeRepository.save(googleIframe);
        iframesCreated++;
        this.logger.debug(`Created Google iframe for manager ${manager.email}`);
      } else {
        iframesSkipped++;
      }
    }

    // For CLINIC_ADMIN accounts, ensure addresses and iframes are NULL
    const clinicAdmins = allAccounts.filter(
      (account) => account.role === AccountRole.CLINIC_ADMIN,
    );

    for (const admin of clinicAdmins) {
      const existingAddress = await this.addressRepository.findByAccountId(admin._id);
      if (existingAddress) {
        await this.addressRepository.deleteByAccountId(admin._id);
        this.logger.debug(`Removed address for admin ${admin.email}`);
      }

      const existingIframe = await this.googleIframeRepository.existsByAddressId(existingAddress?._id);
      if (existingIframe) {
        // This would be handled by cascade removal from address
      }
    }

    this.logger.log(
      `✅ Address and Google iframe seeding completed: ` +
        `Managers: ${addressesCreated} created, ${addressesSkipped} skipped | ` +
        `Iframes: ${iframesCreated} created, ${iframesSkipped} skipped`,
    );
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
