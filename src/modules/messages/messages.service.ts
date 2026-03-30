import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import {
  getCurrentVietnamTime,
  addToVietnamTime,
} from 'src/common/utils/date.util';
import { CreateMessageDto, UpdateMessageDto, MessageResponseDto } from './dto';
import { Message } from './entities/message.entity';
import { MessageType } from './enums';
import { MessageRepository } from './repositories';
import { SocketGatewayService } from '../socket-gateway/socket-gateway.service';
import { ConversationService } from '../conversations/conversation.service';

@Injectable()
export class MessagesService {
  constructor(
    private readonly messageRepository: MessageRepository,
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

    const now = getCurrentVietnamTime();
    const messageData = {
      ...createMessageDto,
      validatedAt: addToVietnamTime(20, 'minute'), // 20 minutes from now
      createdAt: now,
      updatedAt: now,
      messageType: createMessageDto.messageType || MessageType.TEXT,
      isRead: createMessageDto.isRead || false,
    };
    const savedMessage = await this.messageRepository.createMessage(messageData);

    // Update conversation updatedAt to bring it to the top of the list
    try {
      await this.conversationService.update(createMessageDto.conversationId, {
        updatedAt: getCurrentVietnamTime(),
      });
    } catch (error) {
      console.error('Error updating conversation updatedAt:', error);
    }

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
    const messages = await this.messageRepository.findAllMessages();
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
    return await this.messageRepository.findDeletedMessagesByUser(
      conversationId,
      userId,
    );
  }

  async findByConversation(
    conversationId: string,
    userId: string,
  ): Promise<MessageResponseDto[]> {
    const messages = await this.messageRepository.findMessagesByConversationId(
      conversationId,
    );

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
    const messages = await this.messageRepository.findMessagesBySenderId(
      senderId,
    );
    return messages.map((message) => new MessageResponseDto(message));
  }

  async findByReceiver(receiverId: string): Promise<MessageResponseDto[]> {
    const messages = await this.messageRepository.findMessagesBySenderId(
      receiverId,
    );
    return messages.map((message) => new MessageResponseDto(message));
  }

  async update(
    id: string,
    updateMessageDto: UpdateMessageDto,
  ): Promise<MessageResponseDto> {
    const message = await this.findMessageEntityById(id);

    // Check if the message is older than 15 minutes
    const fifteenMinutesMs = 15 * 60 * 1000;
    const now = new Date();
    const createdAt = new Date(message.createdAt);
    if (now.getTime() - createdAt.getTime() > fifteenMinutesMs) {
      throw new BadRequestException(
        'Message cannot be edited after 15 minutes',
      );
    }

    const updateData = {
      ...updateMessageDto,
      updatedAt: getCurrentVietnamTime(),
    };

    Object.assign(message, updateData);
    const updatedMessage = await this.messageRepository.updateMessage(
      id,
      updateData,
    );

    // Update conversation updatedAt
    try {
      await this.conversationService.update(message.conversationId, {
        updatedAt: getCurrentVietnamTime(),
      });
    } catch (error) {
      console.error('Error updating conversation updatedAt on edit:', error);
    }

    // Broadcast message update via socket
    try {
      await this.socketGatewayService.broadcastMessageUpdate(
        message.conversationId,
        updatedMessage,
      );
    } catch (error) {
      console.error('Error broadcasting message update:', error);
    }

    return new MessageResponseDto(updatedMessage);
  }

  async delete(id: string): Promise<void> {
    const message = await this.findMessageEntityById(id);

    // Check if the message is older than 15 minutes
    const fifteenMinutesMs = 15 * 60 * 1000;
    const now = new Date();
    const createdAt = new Date(message.createdAt);
    if (now.getTime() - createdAt.getTime() > fifteenMinutesMs) {
      throw new BadRequestException(
        'Message cannot be deleted after 15 minutes',
      );
    }

    await this.messageRepository.softDeleteMessage(id);

    // After deletion, find the new last message to update participants' sidebars
    try {
      const newLastMessage = await this.messageRepository.findLastMessageByConversation(
        message.conversationId,
      );

      // Notify participants via socket
      await this.socketGatewayService.broadcastMessageDelete(
        message.conversationId,
        id,
        newLastMessage,
      );

      // If there's a new last message, update the conversation's updatedAt to reflect the change
      if (newLastMessage) {
        await this.conversationService.update(message.conversationId, {
          updatedAt: newLastMessage.createdAt,
        });
      }
    } catch (error) {
      console.error('Error handling post-deletion socket/update:', error);
    }
  }

  async markAsRead(id: string): Promise<MessageResponseDto> {
    const updatedMessage = await this.messageRepository.updateMessage(id, {
      isRead: true,
    });
    return new MessageResponseDto(updatedMessage);
  }

  async markMultipleAsRead(
    messageIds: string[],
  ): Promise<MessageResponseDto[]> {
    const messages = await this.messageRepository.findMessagesByIds(messageIds);
    const updatedMessages = messages.map((message) => {
      message.isRead = true;
      return message;
    });
    const savedMessages = await this.messageRepository.bulkSaveMessages(updatedMessages);
    return savedMessages.map((message) => new MessageResponseDto(message));
  }

  async markConversationAsRead(
    conversationId: string,
    userId: string,
  ): Promise<number> {
    await this.messageRepository.markMessagesAsRead(conversationId, userId);
    return await this.messageRepository.countUnreadMessages(
      conversationId,
      userId,
    );
  }

  async deleteByConversation(conversationId: string): Promise<void> {
    await this.messageRepository.deleteMessagesByConversation(conversationId);
  }

  async findLastMessageByConversation(
    conversationId: string,
  ): Promise<MessageResponseDto | null> {
    const lastMessage = await this.messageRepository.findLastMessageByConversation(
      conversationId,
    );

    return lastMessage ? new MessageResponseDto(lastMessage) : null;
  }

  async updateLastMessageDeletedBy(
    conversationId: string,
    userId: string,
  ): Promise<MessageResponseDto | null> {
    // Get the last message in the conversation
    const lastMessage = await this.messageRepository.findLastMessageByConversation(
      conversationId,
    );

    if (!lastMessage) {
      return null;
    }

    // Update the deletedBy array to include the userId
    const updatedDeletedBy = [...(lastMessage.deletedBy || []), userId];

    await this.messageRepository.updateMessageDeletedBy(
      lastMessage._id,
      updatedDeletedBy,
    );

    // Return the updated message
    const updatedMessage = await this.findMessageEntityById(lastMessage._id);
    return new MessageResponseDto(updatedMessage);
  }

  private async findMessageEntityById(id: string): Promise<Message> {
    const message = await this.messageRepository.findMessageById(id);
    if (!message) {
      throw new NotFoundException('Message not found');
    }
    return message;
  }
}
