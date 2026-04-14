import { Injectable, Logger } from '@nestjs/common';
import { AiConversationRepository } from '../../modules/ai-rag-chat-bot/repositories/ai-conversation.repository';
import { AiMessageRepository } from '../../modules/ai-rag-chat-bot/repositories/ai-message.repository';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { AccountRole } from '../../modules/accounts/enums';

@Injectable()
export class AiConversationSeederService {
  private readonly logger = new Logger(AiConversationSeederService.name);

  constructor(
    private readonly aiConversationRepository: AiConversationRepository,
    private readonly aiMessageRepository: AiMessageRepository,
    private readonly accountRepository: AccountRepository,
  ) {}

  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed AI conversations...');

      // Check if conversations already exist
      const existingConversations =
        await this.aiConversationRepository.findAllConversations();
      if (existingConversations.length > 0) {
        this.logger.log('AI Conversations already exist. Skipping seeding.');
        return;
      }

      // Get all patients
      const patients = await this.accountRepository.findAllAccounts();
      const patientAccounts = patients.filter(
        (acc) => acc.role === AccountRole.PATIENT,
      );

      if (patientAccounts.length === 0) {
        this.logger.warn(
          'No patient accounts found. Skipping AI conversation seeding.',
        );
        return;
      }

      this.logger.log(
        `Found ${patientAccounts.length} patients to seed conversations for.`,
      );

      for (const patient of patientAccounts) {
        // Create a conversation for each patient
        const conversation =
          await this.aiConversationRepository.createConversation(patient._id, {
            title: 'Welcome to Medicare AI',
            description: 'Initial consultation and welcome message',
            participants: [patient._id],
            metadata: { desc: 'seeded: true' },
          });

        // Create initial AI message
        await this.aiMessageRepository.createMessage({
          conversationId: conversation._id,
          role: 'assistant',
          content: `Hello ${patient.username}, I am your Medicare AI assistant. How can I help you today?`,
          metadata: { desc: 'type: welcome' },
        });

        // Create user response (mock)
        await this.aiMessageRepository.createMessage({
          conversationId: conversation._id,
          senderId: patient._id,
          role: 'user',
          content: 'I would like to know more about your services.',
          metadata: { desc: 'type: inquiry' },
        });
      }

      this.logger.log(
        `✅ Successfully seeded AI conversations for ${patientAccounts.length} patients.`,
      );
    } catch (error) {
      this.logger.error('Failed to seed AI conversations', error.stack);
    }
  }
}
