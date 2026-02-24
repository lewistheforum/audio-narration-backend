import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { API } from '../utils/ai-api';

@Injectable()
export class KnowledgeBaseSeederService {
  private readonly logger = new Logger(KnowledgeBaseSeederService.name);

  constructor(private readonly httpService: HttpService) {}

  async seed(): Promise<void> {
    this.logger.log('Starting to seed Knowledge Base via API...');

    const url = API.AI.SYNC_DATA;
    const body = {
      sync_clinic_services: true,
      sync_doctor_profiles: true,
      sync_clinic_info: true,
      sync_staff_info: true,
      sync_blogs: true,
      sync_feedbacks: true,
      sync_user_info: true,
      sync_doctor_schedules: true,
      sync_clinic_working_hours: true,
      clear_existing: false,
    };

    try {
      await firstValueFrom(this.httpService.post(url, body));
      this.logger.log('✅ Knowledge Base sync request sent successfully.');
    } catch (error) {
      this.logger.error(
        'Failed to sync Knowledge Base via API',
        error.message,
        error.stack,
      );
      // We don't throw here to allow other seeders to continue if this optional step fails
    }
  }
}
