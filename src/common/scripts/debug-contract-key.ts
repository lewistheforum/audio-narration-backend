import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { ContractPackageRepository } from '../../modules/contracts/repositories/contract-package.repository';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import * as crypto from 'crypto';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const contractPackageRepo = app.get(ContractPackageRepository);
    const accountRepo = app.get(AccountRepository);

    const contractId = '03f3b276-0b0c-4c4a-810a-870edbb9009f'; // The failing ID

    console.log(`Checking Contract: ${contractId}`);

    const contractPackage = await contractPackageRepo.findById(contractId);
    if (!contractPackage) {
        console.error('Contract Package not found');
        return;
    }
    console.log(`Clinic ID (Manager): ${contractPackage.clinicManagerId}`);

    const manager = await accountRepo.findAccountById(contractPackage.clinicManagerId);
    if (!manager) {
        console.error('Manager Account not found');
        return;
    }

    console.log('--- RAW MANAGER PUBLIC KEY START ---');
    console.log(manager.publicKey);
    console.log('--- RAW MANAGER PUBLIC KEY END ---');

    if (!manager.publicKey) {
        console.error('Manager has no public key');
    } else {
        try {
            console.log('Attempting verify with crypto.createPublicKey...');
            const k = crypto.createPublicKey(manager.publicKey);
            console.log('✅ crypto.createPublicKey SUCCESS');
            console.log('Key Type:', k.asymmetricKeyType);
        } catch (e) {
            console.error('❌ crypto.createPublicKey FAILED');
            console.error(e);
        }
    }

    await app.close();
}

bootstrap();
