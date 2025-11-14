import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../../modules/user/entities/user.entity';
import * as bcrypt from 'bcrypt';

/**
 * Admin seeder service
 * - Runs on application startup
 * - Checks if default admin account exists
 * - Creates admin if not found
 */
@Injectable()
export class AdminSeederService implements OnModuleInit {
  private readonly logger = new Logger(AdminSeederService.name);
  private readonly BCRYPT_SALT_ROUNDS = 10;

  // Default admin credentials - should be changed after first login
  private readonly DEFAULT_ADMIN = {
    email: 'admin@medicare.com',
    password: 'Admin@123456',
    name: 'System Administrator',
    role: UserRole.ADMIN,
  };

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Lifecycle hook - runs when module initializes
   */
  async onModuleInit() {
    await this.seedAdmin();
  }

  /**
   * Seed default admin account if it doesn't exist
   */
  private async seedAdmin(): Promise<void> {
    try {
      const existingAdmin = await this.userRepository.findOne({
        where: { email: this.DEFAULT_ADMIN.email },
      });

      if (existingAdmin) {
        this.logger.log('Default admin account already exists');
        return;
      }

      const hashedPassword = await bcrypt.hash(
        this.DEFAULT_ADMIN.password,
        this.BCRYPT_SALT_ROUNDS,
      );

      const admin = this.userRepository.create({
        email: this.DEFAULT_ADMIN.email,
        password: hashedPassword,
        name: this.DEFAULT_ADMIN.name,
        role: this.DEFAULT_ADMIN.role,
      });

      await this.userRepository.save(admin);

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
