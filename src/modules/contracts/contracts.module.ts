import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { ContractPackage } from './entities/contract-package.entity';
import { ClinicContractInformation } from './entities/clinic-contract-information.entity';
import { ContractPackageRepository } from './repositories/contract-package.repository';
import { ClinicContractInformationRepository } from './repositories/clinic-contract-information.repository';
import { AccountsModule } from '../accounts/accounts.module';
import { MailerModule } from '../mailer/mailer.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([ContractPackage, ClinicContractInformation]),
        AccountsModule,
        MailerModule,
    ],
    controllers: [ContractsController],
    providers: [
        ContractsService,
        ContractPackageRepository,
        ClinicContractInformationRepository,
    ],
    exports: [
        ContractsService,
        ContractPackageRepository,
        ClinicContractInformationRepository,
    ],
})
export class ContractsModule { }
