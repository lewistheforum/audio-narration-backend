import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientController } from './client.controller';
import { ClientService } from './client.service';
import { User } from './entities/accounts.entity';
import { GeneralAccount } from './entities/general_accounts.entity';
import { MailerModule } from '../mailer/mailer.module';
import { ProfileModule } from '../profile/profile.module';

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
 * Exported Services:
 * - ClientService: Used by AuthModule for client operations during authentication
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([User, GeneralAccount]),
        MailerModule,
        forwardRef(() => ProfileModule),
    ],
    controllers: [ClientController],
    providers: [ClientService],
    exports: [ClientService],
})
export class ClientModule { }
