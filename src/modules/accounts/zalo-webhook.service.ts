import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ZaloWebhookService {
  private readonly logger = new Logger(ZaloWebhookService.name);
  private readonly webhookUrl: string | undefined;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.webhookUrl = this.configService.get<string>('N8N_ZALO_FRIEND_REQUEST_WEBHOOK_URL');
  }

  /**
   * Sends a friend request via Zalo webhook
   * @param phone The phone number of the patient
   * @param source The source or event that triggered this request
   */
  async sendFriendRequest(phone: string | undefined, source: string = 'Unknown'): Promise<void> {
    if (!phone) {
      this.logger.warn(`[${source}] No phone number provided for Zalo friend request`);
      return;
    }

    // Basic phone normalization (remove whitespace, dashes, etc.)
    const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');

    try {
      if (!this.webhookUrl) {
        this.logger.warn(`[${source}] Zalo friend request webhook URL is not configured`);
        return;
      }

      this.logger.log(`[${source}] Sending Zalo friend request to: ${normalizedPhone}`);
      await firstValueFrom(
        this.httpService.post(this.webhookUrl, {
          phone: normalizedPhone,
        }),
      );
      this.logger.log(`[${source}] Zalo friend request sent successfully to ${normalizedPhone}`);
    } catch (error) {
      // We log the error but don't throw it to avoid breaking the main application flow
      this.logger.error(
        `[${source}] Failed to send Zalo friend request to ${normalizedPhone}: ${error.message}`,
        error.stack,
      );
    }
  }
}
