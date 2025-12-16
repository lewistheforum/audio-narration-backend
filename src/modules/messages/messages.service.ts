import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ArrayContains, Repository } from 'typeorm';
import { CreateMessageDto, UpdateMessageDto, MessageResponseDto } from './dto';
import { Message } from './entities/message.entity';
import { SocketGatewayService } from '../socket-gateway/socket-gateway.service';
import { ConversationService } from '../conversations/conversation.service';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @Inject(forwardRef(() => SocketGatewayService))
    private socketGatewayService: SocketGatewayService,
    @Inject(forwardRef(() => ConversationService))
    private conversationService: ConversationService,
  ) { }

  async create(
    createMessageDto: CreateMessageDto,
  ): Promise<MessageResponseDto> {
    // Check if conversation has any values in deletedBy array and clear them
    try {
      const hasDeletedBy = await this.conversationService.hasDeletedByValues(
        createMessageDto.conversationId,
      );

      if (hasDeletedBy) {
        // Clear all values from deletedBy array
        await this.conversationService.clearDeletedBy(
          createMessageDto.conversationId,
        );
      }
    } catch (error) {
      console.error('Error checking/clearing conversation deletedBy:', error);
    }

    const message = this.messageRepository.create({
      ...createMessageDto,
      validatedAt: new Date(Date.now() + 20 * 60 * 1000), // 20 minutes from now
      createdAt: new Date(Date.now()),
      updatedAt: new Date(Date.now()),
      messageType: createMessageDto.messageType || 'text',
      isRead: createMessageDto.isRead || false,
    });
    const savedMessage = await this.messageRepository.save(message);

    // Emit socket events for new message
    try {
      await this.socketGatewayService.broadcastNewMessage(
        createMessageDto.conversationId,
        savedMessage,
        createMessageDto.senderId,
      );
    } catch (error) {
      console.error('Error emitting socket events for new message:', error);
    }

    return new MessageResponseDto(savedMessage);
  }

  async findAll(): Promise<MessageResponseDto[]> {
    const messages = await this.messageRepository.find({
      order: { createdAt: 'DESC' },
    });
    return messages.map((message) => new MessageResponseDto(message));
  }

  async findOne(id: string): Promise<MessageResponseDto> {
    const message = await this.findMessageEntityById(id);
    return new MessageResponseDto(message);
  }

  async findDeletedMessagesInConversationByUserId(
    conversationId: string,
    userId: string,
  ): Promise<Message[]> {
    return await this.messageRepository.find({
      where: { conversationId, deletedBy: ArrayContains([userId]) },
    });
  }

  async findByConversation(
    conversationId: string,
    userId: string,
  ): Promise<MessageResponseDto[]> {
    const messages = await this.messageRepository.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
    });

    const deletedMessages =
      await this.findDeletedMessagesInConversationByUserId(
        conversationId,
        userId,
      );

    // If no deleted messages, return all messages that are not deleted by the user
    if (deletedMessages.length === 0) {
      const filteredMessages = messages.filter((message) => {
        return !message.deletedBy.includes(userId);
      });
      return filteredMessages.map((message) => new MessageResponseDto(message));
    }

    const latestDeletedMessage = deletedMessages.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    )[0];

    // Filter messages based on deletedBy array and latest deleted message timestamp
    const filteredMessages = messages.filter((message) => {
      return (
        !message.deletedBy.includes(userId) &&
        message.createdAt > latestDeletedMessage.createdAt
      );
    });

    return filteredMessages.map((message) => new MessageResponseDto(message));
  }

  async findBySender(senderId: string): Promise<MessageResponseDto[]> {
    const messages = await this.messageRepository.find({
      where: { senderId },
      order: { createdAt: 'DESC' },
    });
    return messages.map((message) => new MessageResponseDto(message));
  }

  async findByReceiver(receiverId: string): Promise<MessageResponseDto[]> {
    const messages = await this.messageRepository.find({
      where: { receiverId },
      order: { createdAt: 'DESC' },
    });
    return messages.map((message) => new MessageResponseDto(message));
  }

  async update(
    id: string,
    updateMessageDto: UpdateMessageDto,
  ): Promise<MessageResponseDto> {
    const message = await this.findMessageEntityById(id);

    Object.assign(message, updateMessageDto);
    const updatedMessage = await this.messageRepository.save(message);

    return new MessageResponseDto(updatedMessage);
  }

  async delete(id: string): Promise<void> {
    await this.messageRepository.update(id, {
      deletedAt: new Date(),
    });
  }

  async markAsRead(id: string): Promise<MessageResponseDto> {
    const message = await this.findMessageEntityById(id);
    message.isRead = true;
    const updatedMessage = await this.messageRepository.save(message);
    return new MessageResponseDto(updatedMessage);
  }

  async markMultipleAsRead(
    messageIds: string[],
  ): Promise<MessageResponseDto[]> {
    const messages = await this.messageRepository.findByIds(messageIds);
    const updatedMessages = messages.map((message) => {
      message.isRead = true;
      return message;
    });
    const savedMessages = await this.messageRepository.save(updatedMessages);
    return savedMessages.map((message) => new MessageResponseDto(message));
  }

  async markConversationAsRead(
    conversationId: string,
    userId: string,
  ): Promise<number> {
    const result = await this.messageRepository.update(
      {
        conversationId,
        receiverId: userId,
        isRead: false,
      },
      { isRead: true },
    );
    return result.affected || 0;
  }

  async deleteByConversation(conversationId: string): Promise<void> {
    await this.messageRepository.delete({ conversationId });
  }

  async findLastMessageByConversation(
    conversationId: string,
  ): Promise<MessageResponseDto | null> {
    const lastMessage = await this.messageRepository.findOne({
      where: { conversationId },
      order: { createdAt: 'DESC' },
    });

    return lastMessage ? new MessageResponseDto(lastMessage) : null;
  }

  async updateLastMessageDeletedBy(
    conversationId: string,
    userId: string,
  ): Promise<MessageResponseDto | null> {
    // Get the last message in the conversation
    const lastMessage = await this.messageRepository.findOne({
      where: { conversationId },
      order: { createdAt: 'DESC' },
    });

    if (!lastMessage) {
      return null;
    }

    // Update the deletedBy array to include the userId
    const updatedDeletedBy = [...(lastMessage.deletedBy || []), userId];

    await this.messageRepository.update(lastMessage.id, {
      deletedBy: updatedDeletedBy,
    });

    // Return the updated message
    const updatedMessage = await this.findMessageEntityById(lastMessage.id);
    return new MessageResponseDto(updatedMessage);
  }

  private async findMessageEntityById(id: string): Promise<Message> {
    const message = await this.messageRepository.findOne({
      where: { id },
    });
    if (!message) {
      throw new NotFoundException('Message not found');
    }
    return message;
  }
}
