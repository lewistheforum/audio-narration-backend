import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Account } from '../../modules/accounts/entities/accounts.entity';
import { AccountRole, AccountStatus, Gender } from '../../modules/accounts/enums';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { ENGLISH_NAMES } from '../constants/names';

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

  constructor(private readonly accountRepository: AccountRepository) {}

  /**
   * Seed all account types in the correct order
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
   */
  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed accounts...');

      // Step 1: Seed CLINIC_ADMIN accounts
      const clinicAdmins = await this.seedClinicAdmins();

      // Step 2: Seed CLINIC_MANAGER accounts
      const clinicManagers = await this.seedClinicManagers(clinicAdmins);

      // Step 3: Seed CLINIC_STAFF accounts
      await this.seedClinicStaff(clinicManagers);

      // Step 4: Seed DOCTOR accounts
      await this.seedDoctors(clinicManagers);

      // Step 5: Seed PATIENT accounts
      await this.seedPatients();

      this.logger.log('✅ Account seeding completed successfully');
    } catch (error) {
      this.logger.error('Failed to seed accounts', error.stack);
      throw error;
    }
  }

  /**
   * Seed CLINIC_ADMIN accounts
   * Creates exactly 5 CLINIC_ADMIN accounts
   */
  private async seedClinicAdmins(): Promise<Account[]> {
    const CLINIC_ADMIN_COUNT = 5;
    const existingCount = await this.accountRepository.countByRole(
      AccountRole.CLINIC_ADMIN,
    );

    if (existingCount >= CLINIC_ADMIN_COUNT) {
      this.logger.log(
        `CLINIC_ADMIN accounts already exist (${existingCount}). Skipping seeding.`,
      );
      return this.accountRepository.findAllAccounts().then((accounts) =>
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
        phone: `+84${this.randomPhoneDigits()}`,
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
  private async seedClinicManagers(clinicAdmins: Account[]): Promise<Account[]> {
    const clinicManagers: Account[] = [];

    for (const clinicAdmin of clinicAdmins) {
      const count = this.getRandomInt(1, 3);

      for (let i = 1; i <= count; i++) {
        const email = `clinic_manager_${clinicAdmins.indexOf(clinicAdmin) + 1}_${i}@medicare.test`;
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
          username: `clinic_manager_${clinicAdmins.indexOf(clinicAdmin) + 1}_${i}`,
          email,
          password: hashedPassword,
          phone: `+84${this.randomPhoneDigits()}`,
          parentId: clinicAdmin._id,
          role: AccountRole.CLINIC_MANAGER,
          status: AccountStatus.ACTIVE,
          isEmailVerified: true,
          isOAuthUser: false,
        });

        const saved = await this.accountRepository.saveAccount(account);
        clinicManagers.push(saved);
      }
    }

    this.logger.log(`✅ Created ${clinicManagers.length} CLINIC_MANAGER accounts`);
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
        const email = `clinic_staff_${clinicManagers.indexOf(clinicManager) + 1}_${i}@medicare.test`;
        const existing = await this.accountRepository.findAccountByEmail(email);

        if (existing) {
          continue;
        }

        const hashedPassword = await bcrypt.hash(
          this.DEFAULT_PASSWORD,
          this.BCRYPT_SALT_ROUNDS,
        );

        const account = this.accountRepository.createAccount({
          username: `clinic_staff_${clinicManagers.indexOf(clinicManager) + 1}_${i}`,
          email,
          password: hashedPassword,
          phone: `+84${this.randomPhoneDigits()}`,
          parentId: clinicManager._id,
          role: AccountRole.CLINIC_STAFF,
          status: AccountStatus.ACTIVE,
          isEmailVerified: true,
          isOAuthUser: false,
        });

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
        const email = `doctor_${clinicManagers.indexOf(clinicManager) + 1}_${i}@medicare.test`;
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
          phone: `+84${this.randomPhoneDigits()}`,
          parentId: clinicManager._id,
          role: AccountRole.DOCTOR,
          status: AccountStatus.ACTIVE,
          isEmailVerified: true,
          isOAuthUser: false,
        });

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
        phone: `+84${this.randomPhoneDigits()}`,
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
