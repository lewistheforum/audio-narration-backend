import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicManagersController } from './clinic-managers.controller';
import { ClinicManagersService } from './clinic-managers.service';
import { Account } from '../entities/accounts.entity';
import { BanHistory } from '../entities/ban-history.entity';
import { MailerModule } from '../../mailer/mailer.module';

@Module({
  imports: [TypeOrmModule.forFeature([Account, BanHistory]), MailerModule],
  controllers: [ClinicManagersController],
  providers: [ClinicManagersService],
})
export class ClinicManagersModule {}
