import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ArrayContains, FindOptionsWhere } from 'typeorm';
import { Message } from '../entities/message.entity';

/**
 * Message Repository
 *
 * Data access layer for Message entity.
 * Implements the Repository Pattern to separate data access logic from business logic.
 *
 * Responsibilities:
 * - Direct database operations (CRUD) for Message entity
 * - Query construction and execution
 * - No business logic (handled by MessagesService)
 * - No validation (handled by DTOs and Service)
 *
 * @class MessageRepository
 * @injectable
 */
@Injectable()
export class MessageRepository {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  /**
   * Create a new message
   *
   * @param {Partial<Message>} messageData - Message data to create
   * @returns {Promise<Message>} Created message entity
   */
  async createMessage(messageData: Partial<Message>): Promise<Message> {
    const message = this.messageRepository.create(messageData);
    return this.messageRepository.save(message);
  }

  /**
   * Find all messages
   *
   * @returns {Promise<Message[]>} Array of all message entities
   */
  async findAllMessages(): Promise<Message[]> {
    return this.messageRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find message by ID
   *
   * @param {string} id - Message UUID
   * @returns {Promise<Message | null>} Message entity or null if not found
   */
  async findMessageById(id: string): Promise<Message | null> {
    return this.messageRepository.findOne({
      where: { _id: id },
    });
  }

  /**
   * Find messages by conversation ID
   *
   * @param {string} conversationId - Conversation UUID
   * @returns {Promise<Message[]>} Array of messages in the conversation
   */
  async findMessagesByConversationId(
    conversationId: string,
  ): Promise<Message[]> {
    return this.messageRepository.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Find deleted messages in conversation by user ID
   *
   * @param {string} conversationId - Conversation UUID
   * @param {string} userId - User UUID
   * @returns {Promise<Message[]>} Array of deleted messages
   */
  async findDeletedMessagesByUser(
    conversationId: string,
    userId: string,
  ): Promise<Message[]> {
    return this.messageRepository.find({
      where: {
        conversationId,
        deletedBy: ArrayContains([userId]),
      },
    });
  }

  /**
   * Update message
   *
   * @param {string} id - Message UUID
   * @param {Partial<Message>} updateData - Data to update
   * @returns {Promise<Message | null>} Updated message entity or null
   */
  async updateMessage(
    id: string,
    updateData: Partial<Message>,
  ): Promise<Message | null> {
    await this.messageRepository.update(id, updateData);
    return this.findMessageById(id);
  }

  /**
   * Soft delete message
   *
   * @param {string} id - Message UUID
   * @returns {Promise<void>}
   */
  async softDeleteMessage(id: string): Promise<void> {
    await this.messageRepository.softDelete(id);
  }

  /**
   * Hard delete message
   *
   * @param {string} id - Message UUID
   * @returns {Promise<void>}
   */
  async hardDeleteMessage(id: string): Promise<void> {
    await this.messageRepository.delete(id);
  }

  /**
   * Bulk soft delete messages
   *
   * @param {string[]} ids - Array of message UUIDs
   * @returns {Promise<void>}
   */
  async bulkSoftDeleteMessages(ids: string[]): Promise<void> {
    await this.messageRepository.softDelete(ids);
  }

  /**
   * Find messages by sender ID
   *
   * @param {string} senderId - Sender UUID
   * @returns {Promise<Message[]>} Array of messages sent by user
   */
  async findMessagesBySenderId(senderId: string): Promise<Message[]> {
    return this.messageRepository.find({
      where: { senderId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Count unread messages for user in conversation
   *
   * @param {string} conversationId - Conversation UUID
   * @param {string} receiverId - Receiver UUID
   * @returns {Promise<number>} Count of unread messages
   */
  async countUnreadMessages(
    conversationId: string,
    receiverId: string,
  ): Promise<number> {
    return this.messageRepository.count({
      where: {
        conversationId,
        receiverId,
        isRead: false,
      },
    });
  }

  /**
   * Mark messages as read
   *
   * @param {string} conversationId - Conversation UUID
   * @param {string} receiverId - Receiver UUID
   * @returns {Promise<void>}
   */
  async markMessagesAsRead(
    conversationId: string,
    receiverId: string,
  ): Promise<void> {
    await this.messageRepository.update(
      {
        conversationId,
        receiverId,
        isRead: false,
      },
      { isRead: true },
    );
  }

  /**
   * Find messages by IDs using PostgreSQL ANY() for type safety
   *
   * @param {string[]} ids - Array of message UUIDs
   * @returns {Promise<Message[]>} Array of messages
   */
  async findMessagesByIds(ids: string[]): Promise<Message[]> {
    if (!ids || ids.length === 0) {
      return [];
    }
    return this.messageRepository
      .createQueryBuilder('message')
      .where('message._id = ANY(:ids)', { ids })
      .getMany();
  }

  /**
   * Bulk save messages
   *
   * @param {Message[]} messages - Array of messages to save
   * @returns {Promise<Message[]>} Array of saved messages
   */
  async bulkSaveMessages(messages: Message[]): Promise<Message[]> {
    return this.messageRepository.save(messages);
  }

  /**
   * Delete messages by conversation ID
   *
   * @param {string} conversationId - Conversation UUID
   * @returns {Promise<void>}
   */
  async deleteMessagesByConversation(conversationId: string): Promise<void> {
    await this.messageRepository.delete({ conversationId });
  }

  /**
   * Find last message by conversation ID
   *
   * @param {string} conversationId - Conversation UUID
   * @returns {Promise<Message | null>} Last message or null
   */
  async findLastMessageByConversation(
    conversationId: string,
  ): Promise<Message | null> {
    return this.messageRepository.findOne({
      where: { conversationId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Update message deletedBy field directly
   *
   * @param {string} id - Message UUID
   * @param {string[]} deletedBy - Array of user IDs who deleted the message
   * @returns {Promise<void>}
   */
  async updateMessageDeletedBy(id: string, deletedBy: string[]): Promise<void> {
    await this.messageRepository.update(id, { deletedBy });
  }
}
