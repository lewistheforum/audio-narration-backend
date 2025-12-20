import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ArrayContains, In, Not, Repository } from 'typeorm';
import {
  CreateConversationDto,
  UpdateConversationDto,
  ConversationResponseDto,
} from './dto';
import { Conversation } from './entities/conversation.entity';
import { AccountsService } from '../accounts/accounts.service';
import { MessagesService } from '../messages/messages.service';

@Injectable()
export class ConversationService {
  constructor(
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
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
        await this.conversationRepository.update(existingConversation.id, {
          deletedBy: updatedDeletedBy,
        });

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
    const conversation = this.conversationRepository.create(
      createConversationDto,
    );
    const savedConversation = await this.conversationRepository.save(
      conversation,
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

    const conversations = await this.conversationRepository.find({
      where: {
        participants: ArrayContains(sortedParticipants),
      },
    });

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
    const conversations = await this.conversationRepository.find({
      order: { createdAt: 'DESC' },
    });
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
    const conversations = await this.conversationRepository.find({
      where: {
        participants: ArrayContains(participants),
        deletedBy: Not(ArrayContains([...participants])),
      },
    });
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

  async update(
    id: string,
    updateConversationDto: UpdateConversationDto,
  ): Promise<ConversationResponseDto> {
    const conversation = await this.findConversationEntityById(id);

    Object.assign(conversation, updateConversationDto);
    const updatedConversation = await this.conversationRepository.save(
      conversation,
    );

    return ConversationResponseDto.createWithParticipants(
      updatedConversation,
      this.AccountsService,
    );
  }

  async delete(conversationId: string, userId: string): Promise<void> {
    const conversation = await this.findConversationEntityById(conversationId);
    await this.conversationRepository.update(conversationId, {
      deletedBy: [...(conversation.deletedBy || []), userId],
    });
    await this.messagesService.updateLastMessageDeletedBy(
      conversationId,
      userId,
    );
  }

  async clearDeletedBy(conversationId: string): Promise<void> {
    await this.conversationRepository.update(conversationId, {
      deletedBy: [],
    });
  }

  async hasDeletedByValues(conversationId: string): Promise<boolean> {
    const conversation = await this.findConversationEntityById(conversationId);
    return conversation.deletedBy && conversation.deletedBy.length > 0;
  }

  private async findConversationEntityById(id: string): Promise<Conversation> {
    const conversation = await this.conversationRepository.findOne({
      where: { id },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }
}
