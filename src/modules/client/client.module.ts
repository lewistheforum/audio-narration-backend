import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientController } from './client.controller';
import { ClientService } from './client.service';
import { ClientRepository } from './client.repository';
import { User } from './entities/accounts.entity';
import { GeneralAccount } from './entities/general_accounts.entity';
import { CodeVerification } from '../mailer/entities/mailer.entity';
import { MailerModule } from '../mailer/mailer.module';

/**
 * Client Module
 *
 * Provides client management functionality including:
 * - Client CRUD operations
 * - Patient and clinic staff creation
 * - Password management
 * - Client search and retrieval
 * - Email verification
 * - Automatic profile creation on client registration
 *
 * Uses two entities:
 * - User: Common account data (email, password, role, status)
 * - GeneralAccount: Client-specific data (fullName, gender)
 *
 * Architecture:
 * - ClientRepository: Handles all database operations
 * - ClientService: Contains business logic, uses ClientRepository for data access
 *
 * Exported Services:
 * - ClientService: Used by AuthModule for client operations during authentication
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User, GeneralAccount, CodeVerification]),
    forwardRef(() => MailerModule),
  ],
  controllers: [ClientController],
  providers: [ClientRepository, ClientService],
  exports: [ClientService],
})
export class ClientModule {}
