import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import {
  CreateConversationDto,
  UpdateConversationDto,
  ConversationResponseDto,
} from './dto';
import { Conversation } from './entities/conversation.entity';
import { ConversationRepository } from './repositories';
import { AccountsService } from '../accounts/accounts.service';
import { MessagesService } from '../messages/messages.service';

@Injectable()
export class ConversationService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private AccountsService: AccountsService,
    @Inject(forwardRef(() => MessagesService))
    private messagesService: MessagesService,
  ) { }

  async create(
    createConversationDto: CreateConversationDto,
  ): Promise<ConversationResponseDto> {
    // Check if conversation already exists with exact same participants
    const existingConversation = await this.findExactConversationByParticipants(
      createConversationDto.participants,
    );

    if (existingConversation) {
      // Check if createdUserId is in the deletedBy array
      if (
        createConversationDto.createdUserId &&
        existingConversation.deletedBy?.includes(
          createConversationDto.createdUserId,
        )
      ) {
        // Remove the user ID from deletedBy array
        const updatedDeletedBy = existingConversation.deletedBy.filter(
          (id) => id !== createConversationDto.createdUserId,
        );

        // Update the conversation
        await this.conversationRepository.updateConversation(
          existingConversation.id,
          { deletedBy: updatedDeletedBy },
        );

        // Return the updated conversation
        const updatedConversation = await this.findConversationEntityById(
          existingConversation.id,
        );
        return ConversationResponseDto.createWithParticipants(
          updatedConversation,
          this.AccountsService,
          this.messagesService,
        );
      }

      // If conversation exists but user is not in deletedBy, return existing conversation
      return ConversationResponseDto.createWithParticipants(
        existingConversation,
        this.AccountsService,
        this.messagesService,
      );
    }

    // Create new conversation if none exists
    const savedConversation = await this.conversationRepository.createConversation(
      createConversationDto,
    );
    return ConversationResponseDto.createWithParticipants(
      savedConversation,
      this.AccountsService,
      this.messagesService,
    );
  }

  private async findExactConversationByParticipants(
    participants: string[],
  ): Promise<Conversation | null> {
    // Sort participants to ensure consistent comparison
    const sortedParticipants = [...participants].sort();

    const conversations = await this.conversationRepository.findConversationsByParticipants(
      sortedParticipants,
    );

    // Find conversation with exact same participants (same length and same elements)
    return (
      conversations.find(
        (conv) =>
          conv.participants.length === sortedParticipants.length &&
          [...conv.participants]
            .sort()
            .every(
              (participant, index) => participant === sortedParticipants[index],
            ),
      ) || null
    );
  }

  async findAll(): Promise<ConversationResponseDto[]> {
    const conversations = await this.conversationRepository.findAllConversations();
    return Promise.all(
      conversations.map((conversation) =>
        ConversationResponseDto.createWithParticipants(
          conversation,
          this.AccountsService,
          this.messagesService,
        ),
      ),
    );
  }

  async findOne(id: string): Promise<ConversationResponseDto> {
    const conversation = await this.findConversationEntityById(id);
    return ConversationResponseDto.createWithParticipants(
      conversation,
      this.AccountsService,
      this.messagesService,
    );
  }

  async findByParticipants(
    participants: string[],
  ): Promise<ConversationResponseDto[]> {
    // Get all conversations with these participants
    const conversations = await this.conversationRepository.findConversationsByParticipants(
      participants,
    );
    
    // Filter out conversations where all participants are in deletedBy
    const filteredConversations = conversations.filter((conv) => {
      return !participants.every((p) => conv.deletedBy?.includes(p));
    });
    
    return Promise.all(
      filteredConversations.map((conversation) =>
        ConversationResponseDto.createWithParticipants(
          conversation,
          this.AccountsService,
          this.messagesService,
        ),
      ),
    );
  }

  async update(
    id: string,
    updateConversationDto: UpdateConversationDto,
  ): Promise<ConversationResponseDto> {
    const updatedConversation = await this.conversationRepository.updateConversation(
      id,
      updateConversationDto,
    );

    return ConversationResponseDto.createWithParticipants(
      updatedConversation,
      this.AccountsService,
    );
  }

  async delete(conversationId: string, userId: string): Promise<void> {
    await this.conversationRepository.addUserToDeletedBy(conversationId, userId);
    await this.messagesService.updateLastMessageDeletedBy(
      conversationId,
      userId,
    );
  }

  async clearDeletedBy(conversationId: string): Promise<void> {
    await this.conversationRepository.clearDeletedBy(conversationId);
  }

  async hasDeletedByValues(conversationId: string): Promise<boolean> {
    return await this.conversationRepository.hasDeletedByValues(conversationId);
  }

  private async findConversationEntityById(id: string): Promise<Conversation> {
    const conversation = await this.conversationRepository.findConversationById(id);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }
}
