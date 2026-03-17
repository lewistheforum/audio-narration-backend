import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ContractsService } from './contracts.service';

/**
 * Contracts Cron Service
 * 
 * Background jobs running to automatically manage contract states.
 */
@Injectable()
export class ContractsCronService {
    private readonly logger = new Logger(ContractsCronService.name);

    constructor(private readonly contractsService: ContractsService) { }

    /**
     * Run every day at midnight (Vietnam timezone)
     */
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
        timeZone: 'Asia/Ho_Chi_Minh',
    })
    async handleExpiredContracts() {
        this.logger.log('Starting CRON Job: Update expired contracts to OLD status...');
        try {
            const updatedCount = await this.contractsService.updateExpiredContractsToOld();
            if (updatedCount > 0) {
                this.logger.log(`CRON Job Success: Updated ${updatedCount} expired contracts to OLD.`);
            } else {
                this.logger.log('CRON Job Success: No expired contracts found needing update.');
            }
        } catch (error) {
            this.logger.error('CRON Job Failed: Failed to update expired contracts', error.stack);
        }
    }
}
