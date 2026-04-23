import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { API } from '../../common/utils/ai-api';

/**
 * AI Cron Controller
 *
 * Automated tasks for the AI module.
 * - Syncs the knowledge base every 10 days at 00:00 AM.
 * - Syncs the medicine knowledge base every 10 days at 00:00 AM.
 */
@Injectable()
export class AiCronController {
  private readonly logger = new Logger(AiCronController.name);

  constructor(private readonly httpService: HttpService) {}

  /**
   * Run every 10 days at 00:00 AM
   * Cron expression: '0 0 * / 10 * *' (without spaces) -> At 00:00 on every 10th day-of-month
   */
  @Cron('0 0 */10 * *')
  async handleKnowledgeBaseSyncs() {
    this.logger.debug('Starting automated AI knowledge base syncs...');

    try {
      // 1. Sync General Knowledge Base
      this.logger.debug(`Triggering sync at ${API.AI.SYNC_DATA}`);
      const syncResponse = await firstValueFrom(
        this.httpService.post(API.AI.SYNC_DATA, {
          sync_clinic_services: true,
          sync_doctor_profiles: true,
          sync_clinic_info: true,
          sync_staff_info: true,
          sync_blogs: true,
          sync_user_info: true,
          clear_existing: true,
        }),
      );
      this.logger.log(
        `General Knowledge Base sync completed successfully. Data: ${JSON.stringify(syncResponse.data)}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to sync General Knowledge Base: ${error?.message}`,
        error?.stack,
      );
    }

    try {
      // 2. Sync Medicine Knowledge Base
      this.logger.debug(`Triggering sync at ${API.AI.SYNC_DATA_MEDICINE}`);
      const syncMedicineResponse = await firstValueFrom(
        this.httpService.post(API.AI.SYNC_DATA_MEDICINE, {
          clear_existing: true,
        }),
      );
      this.logger.log(
        `Medicine Knowledge Base sync completed successfully. Data: ${JSON.stringify(syncMedicineResponse.data)}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to sync Medicine Knowledge Base: ${error?.message}`,
        error?.stack,
      );
    }

    this.logger.debug('Automated AI knowledge base syncs finished.');
  }
}
