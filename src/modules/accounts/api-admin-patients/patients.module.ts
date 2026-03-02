import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { Account } from '../entities/accounts.entity';
import { Appointment } from '../../appointments/entities/appointment.entity';
import { ClinicManagerInformation } from '../entities/clinic_manager_information.entity';
import { ClinicAdminInformation } from '../entities/clinic-admin-information.entity';
import { BanHistory } from '../entities/ban-history.entity';

import { MailerModule } from '../../mailer/mailer.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Account,
      Appointment,
      ClinicManagerInformation,
      ClinicAdminInformation,
      BanHistory,
    ]),
    MailerModule,
  ],
  controllers: [PatientsController],
  providers: [PatientsService],
})
export class PatientsModule {}
