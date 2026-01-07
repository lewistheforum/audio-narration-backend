import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Account } from '../../modules/accounts/entities/accounts.entity';
import { GeneralAccount } from '../../modules/accounts/entities/general_accounts.entity';
import { AccountRole, AccountStatus } from '../../modules/accounts/enums';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { GeneralAccountRepository } from '../../modules/accounts/repositories/general-account.repository';

/**
 * Admin Seeder Service
 * - Runs on application startup
 * - Checks if default admin account exists
 * - Creates admin account with GeneralAccount if not found
 * - Admin account is immediately ACTIVE with verified email
 */
@Injectable()
export class AdminSeederService {
  private readonly logger = new Logger(AdminSeederService.name);
  private readonly BCRYPT_SALT_ROUNDS = 10;

  // Default admin credentials - should be changed after first login
  private readonly DEFAULT_ADMIN = {
    username: 'admin',
    email: 'admin@medicare.com',
    password: 'Admin@123456',
    fullName: 'System Administrator',
    role: AccountRole.ADMIN,
  };

  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly generalAccountRepository: GeneralAccountRepository,
  ) {}

  /**
   * Seed default admin account if it doesn't exist
   *
   * Creates both Account and GeneralAccount entities
   * Admin account is immediately ACTIVE with verified email
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
   */
  async seed(): Promise<void> {
    try {
      // Check if admin already exists by email
      const existingAdmin = await this.accountRepository.findAccountByEmail(
        this.DEFAULT_ADMIN.email,
      );

      if (existingAdmin) {
        this.logger.log('Default admin account already exists');
        return;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(
        this.DEFAULT_ADMIN.password,
        this.BCRYPT_SALT_ROUNDS,
      );

      // Create Account entity
      const admin = this.accountRepository.createAccount({
        username: this.DEFAULT_ADMIN.username,
        email: this.DEFAULT_ADMIN.email,
        password: hashedPassword,
        role: this.DEFAULT_ADMIN.role,
        status: AccountStatus.ACTIVE,
        isEmailVerified: true,
        isOAuthUser: false,
      });

      const savedAdmin = await this.accountRepository.saveAccount(admin);

      // Create GeneralAccount entity
      const generalAccount = this.generalAccountRepository.createGeneralAccount({
        generalAccId: savedAdmin._id,
        fullName: this.DEFAULT_ADMIN.fullName,
      });

      await this.generalAccountRepository.saveGeneralAccount(generalAccount);

      this.logger.log(
        `✅ Default admin account created successfully: ${this.DEFAULT_ADMIN.email}`,
      );
      this.logger.warn(
        `⚠️  Default password: ${this.DEFAULT_ADMIN.password} - CHANGE IMMEDIATELY!`,
      );
    } catch (error) {
      this.logger.error('Failed to seed admin account', error.stack);
    }
  }
}
