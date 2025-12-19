// import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';
// import { User, AccountRole, UserStatus } from '../../modules/user/entities/user.entity';
// import * as bcrypt from 'bcrypt';

// /**
//  * Admin seeder service
//  * - Runs on application startup
//  * - Checks if default admin account exists
//  * - Creates admin if not found
//  */
// @Injectable()
// export class AdminSeederService implements OnModuleInit {
//   private readonly logger = new Logger(AdminSeederService.name);
//   private readonly BCRYPT_SALT_ROUNDS = 10;

//   // Default admin credentials - should be changed after first login
//   private readonly DEFAULT_ADMIN = {
//     email: 'admin@medicare.com',
//     password: 'Admin@123456',
//     firstName: 'System',
//     lastName: 'Administrator',
//     role: AccountRole.ADMIN,
//   };

//   constructor(
//     @InjectRepository(User)
//     private userRepository: Repository<User>,
//   ) {}

//   /**
//    * Lifecycle hook - runs when module initializes
//    */
//   async onModuleInit(): Promise<void> {
//     await this.seedAdmin();
//   }

//   /**
//    * Seed default admin account if it doesn't exist
//    * 
//    * Note: With email encryption enabled, we need to load all users
//    * and compare decrypted emails since WHERE clause won't work on encrypted data
//    */
//   private async seedAdmin(): Promise<void> {
//     try {
//       // Load all users and find admin by decrypted email
//       const allUsers = await this.userRepository.find();
//       const existingAdmin = allUsers.find(u => u.email === this.DEFAULT_ADMIN.email);

//       if (existingAdmin) {
//         this.logger.log('Default admin account already exists');
//         return;
//       }

//       const hashedPassword = await bcrypt.hash(
//         this.DEFAULT_ADMIN.password,
//         this.BCRYPT_SALT_ROUNDS,
//       );

//       const admin = this.userRepository.create({
//         email: this.DEFAULT_ADMIN.email,
//         password: hashedPassword,
//         firstName: this.DEFAULT_ADMIN.firstName,
//         lastName: this.DEFAULT_ADMIN.lastName,
//         role: this.DEFAULT_ADMIN.role,
//         status: UserStatus.ACTIVE,
//         isEmailVerified: true,
//       });

//       await this.userRepository.save(admin);

//       this.logger.log(
//         `✅ Default admin account created successfully: ${this.DEFAULT_ADMIN.email}`,
//       );
//       this.logger.warn(
//         `⚠️  Default password: ${this.DEFAULT_ADMIN.password} - CHANGE IMMEDIATELY!`,
//       );
//     } catch (error) {
//       this.logger.error('Failed to seed admin account', error.stack);
//     }
//   }
// }
