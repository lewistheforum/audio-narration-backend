import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicManagersController } from './clinic-managers.controller';
import { ClinicManagersService } from './clinic-managers.service';
import { ClinicRevenueController } from './clinic-revenue.controller';
import { ClinicRevenueService } from './clinic-revenue.service';
import { Account } from '../entities/accounts.entity';
import { BanHistory } from '../entities/ban-history.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { MailerModule } from '../../mailer/mailer.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Account, BanHistory, Transaction]),
    MailerModule,
  ],
  controllers: [ClinicManagersController, ClinicRevenueController],
  providers: [ClinicManagersService, ClinicRevenueService],
  exports: [ClinicRevenueService],
})
export class ClinicManagersModule {}
