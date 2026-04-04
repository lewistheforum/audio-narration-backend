import {
    CanActivate,
    ExecutionContext,
    Injectable,
    Logger,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClinicAdminInformation } from '../../accounts/entities/clinic-admin-information.entity';

@Injectable()
export class SeepayAuthGuard implements CanActivate {
    private readonly logger = new Logger(SeepayAuthGuard.name);

    constructor(
        private readonly configService: ConfigService,
        @InjectRepository(ClinicAdminInformation)
        private readonly clinicAdminRepo: Repository<ClinicAdminInformation>,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const body = request.body;
        const authHeader = request.headers['authorization'];

        let extractedKey: string | undefined;

        // 1. Extract from Authorization Header (Standard SePay Format: "Apikey <KEY>")
        if (authHeader && authHeader.startsWith('Apikey ')) {
            extractedKey = authHeader.replace('Apikey ', '').trim();
        }

        // 2. Fallback: Extract from Body Payload
        if (!extractedKey) {
            extractedKey = body?.apiKey || body?.seepayKey;
        }

        this.logger.debug(`Extracted Key: [${extractedKey}]`);
        this.logger.debug(`Payload Info - subAccount: [${body?.subAccount}], accountNumber: [${body?.accountNumber}]`);

        if (!extractedKey) {
            this.logger.error('Authentication Failed: Missing SePay API Key');
            throw new UnauthorizedException('Missing SePay API Key');
        }

        // 3. Strict Dynamic Lookup: Verify Key matches specific Virtual Account or Bank Number
        const vaNumber = body?.subAccount;
        const accNumber = body?.accountNumber;

        if (vaNumber || accNumber) {
            this.logger.debug(`Searching DB for Key: [${extractedKey}] matching VA: [${vaNumber}] OR Bank: [${accNumber}]`);
            
            const clinicAdmin = await this.clinicAdminRepo.findOne({
                where: [
                    { sepayKey: extractedKey, sepayVa: vaNumber },
                    { sepayKey: extractedKey, bankNumber: accNumber }
                ],
            });

            if (clinicAdmin) {
                this.logger.log(`Authentication Successful for Clinic: ${clinicAdmin.clinicName}`);
                return true;
            } else {
                this.logger.warn(`No match found in DB for Key and provided account info`);
            }
        } else {
            this.logger.warn('No account identifiers (subAccount/accountNumber) found in request body');
        }

        // 4. Global Fallback: Compare against system-wide SEEPAY_API_KEY (for Admin/System)
        const globalApiKey = this.configService.get<string>('seepay.apiKey');
        if (globalApiKey && extractedKey === globalApiKey) {
            this.logger.log('Authentication Successful via Global API Key');
            return true;
        }

        this.logger.error('Authentication Failed: Invalid API Key or VA mismatch');
        throw new UnauthorizedException('Invalid API Key for this account');
    }
}
