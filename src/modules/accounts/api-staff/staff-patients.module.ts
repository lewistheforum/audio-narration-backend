import { Module } from '@nestjs/common';
import { StaffPatientsController } from './staff-patients.controller';
import { StaffPatientsService } from './staff-patients.service';
import { AccountsModule } from '../accounts.module';
import { MailerModule } from '../../mailer/mailer.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account, GeneralAccount } from '../entities';
import { AccountRepository, GeneralAccountRepository } from '../repositories';

/**
 * Staff Patients Module
 * 
 * Module for patient account management by clinic staff.
 * Handles walk-in appointment patient registration.
 * 
 * Features:
 * - Patient account creation with minimal data
 * - Auto-generated password and email delivery
 * - Staff-only access control
 * 
 * Dependencies:
 * - AccountsModule: For account repositories
 * - MailerModule: For sending welcome emails
 * - TypeOrmModule: For database access
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Account, GeneralAccount]),
    MailerModule,
  ],
  controllers: [StaffPatientsController],
  providers: [StaffPatientsService, AccountRepository, GeneralAccountRepository],
  exports: [StaffPatientsService],
})
export class StaffPatientsModule {}
