import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { ContractPackage } from './entities/contract-package.entity';
import { ClinicContractInformation } from './entities/clinic-contract-information.entity';
import { ContractPackageRepository } from './repositories/contract-package.repository';
import { ClinicContractInformationRepository } from './repositories/clinic-contract-information.repository';
import { AccountsModule } from '../accounts/accounts.module';
import { MailerModule } from '../mailer/mailer.module';
import { ContractsCronService } from './contracts-cron.service';


@Module({
    imports: [
        TypeOrmModule.forFeature([ContractPackage, ClinicContractInformation]),
        forwardRef(() => MailerModule),
        forwardRef(() => AccountsModule),
    ],
    controllers: [ContractsController],
    providers: [
        ContractsService,
        ContractPackageRepository,
        ClinicContractInformationRepository,
        ContractsCronService,
    ],
    exports: [
        ContractsService,
        ContractPackageRepository,
        ClinicContractInformationRepository,
    ],
})
export class ContractsModule { }
