import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManagedAccountsController } from './managed-accounts.controller';
import { ManagedAccountsService } from './managed-accounts.service';
import { Account } from '../entities/accounts.entity';
import { BanHistory } from '../entities/ban-history.entity';
import { MailerModule } from '../../mailer/mailer.module';

@Module({
  imports: [TypeOrmModule.forFeature([Account, BanHistory]), MailerModule],
  controllers: [ManagedAccountsController],
  providers: [ManagedAccountsService],
})
export class ManagedAccountsModule {}
