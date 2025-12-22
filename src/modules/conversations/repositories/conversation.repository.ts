import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ArrayContains, In } from 'typeorm';
import { Conversation } from '../entities/conversation.entity';

/**
 * Conversation Repository
 *
 * Data access layer for Conversation entity.
 * Implements the Repository Pattern to separate data access logic from business logic.
 *
 * Responsibilities:
 * - Direct database operations (CRUD) for Conversation entity
 * - Query construction and execution
 * - No business logic (handled by ConversationService)
 * - No validation (handled by DTOs and Service)
 *
 * @class ConversationRepository
 * @injectable
 */
@Injectable()
export class ConversationRepository {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
  ) {}

  /**
   * Create a new conversation
   *
   * @param {Partial<Conversation>} conversationData - Conversation data to create
   * @returns {Promise<Conversation>} Created conversation entity
   */
  async createConversation(
    conversationData: Partial<Conversation>,
  ): Promise<Conversation> {
    const conversation = this.conversationRepository.create(conversationData);
    return this.conversationRepository.save(conversation);
  }

  /**
   * Find all conversations
   *
   * @returns {Promise<Conversation[]>} Array of all conversation entities
   */
  async findAllConversations(): Promise<Conversation[]> {
    return this.conversationRepository.find({
      order: { updatedAt: 'DESC' },
    });
  }

  /**
   * Find conversation by ID
   *
   * @param {string} id - Conversation UUID
   * @returns {Promise<Conversation | null>} Conversation entity or null if not found
   */
  async findConversationById(id: string): Promise<Conversation | null> {
    return this.conversationRepository.findOne({
      where: { id },
    });
  }

  /**
   * Find conversations by participant IDs
   *
   * @param {string[]} participantIds - Array of participant UUIDs
   * @returns {Promise<Conversation[]>} Array of conversations
   */
  async findConversationsByParticipants(
    participantIds: string[],
  ): Promise<Conversation[]> {
    return this.conversationRepository.find({
      where: {
        participants: ArrayContains(participantIds),
      },
    });
  }

  /**
   * Find conversations for a specific user
   *
   * @param {string} userId - User UUID
   * @returns {Promise<Conversation[]>} Array of conversations the user is part of
   */
  async findConversationsByUserId(userId: string): Promise<Conversation[]> {
    return this.conversationRepository.find({
      where: {
        participants: ArrayContains([userId]),
      },
      order: { updatedAt: 'DESC' },
    });
  }

  /**
   * Update conversation
   *
   * @param {string} id - Conversation UUID
   * @param {Partial<Conversation>} updateData - Data to update
   * @returns {Promise<Conversation | null>} Updated conversation entity or null
   */
  async updateConversation(
    id: string,
    updateData: Partial<Conversation>,
  ): Promise<Conversation | null> {
    await this.conversationRepository.update(id, updateData);
    return this.findConversationById(id);
  }

  /**
   * Soft delete conversation
   *
   * @param {string} id - Conversation UUID
   * @returns {Promise<void>}
   */
  async softDeleteConversation(id: string): Promise<void> {
    await this.conversationRepository.softDelete(id);
  }

  /**
   * Hard delete conversation
   *
   * @param {string} id - Conversation UUID
   * @returns {Promise<void>}
   */
  async hardDeleteConversation(id: string): Promise<void> {
    await this.conversationRepository.delete(id);
  }

  /**
   * Check if conversation has deleted by values
   *
   * @param {string} id - Conversation UUID
   * @returns {Promise<boolean>} True if deletedBy array has values
   */
  async hasDeletedByValues(id: string): Promise<boolean> {
    const conversation = await this.findConversationById(id);
    return (
      conversation !== null &&
      conversation.deletedBy &&
      conversation.deletedBy.length > 0
    );
  }

  /**
   * Clear deletedBy array for conversation
   *
   * @param {string} id - Conversation UUID
   * @returns {Promise<void>}
   */
  async clearDeletedBy(id: string): Promise<void> {
    await this.conversationRepository.update(id, { deletedBy: [] });
  }

  /**
   * Add user to deletedBy array
   *
   * @param {string} id - Conversation UUID
   * @param {string} userId - User UUID to add
   * @returns {Promise<void>}
   */
  async addUserToDeletedBy(id: string, userId: string): Promise<void> {
    const conversation = await this.findConversationById(id);
    if (conversation) {
      const deletedBy = conversation.deletedBy || [];
      if (!deletedBy.includes(userId)) {
        deletedBy.push(userId);
        await this.conversationRepository.update(id, { deletedBy });
      }
    }
  }

  /**
   * Remove user from deletedBy array
   *
   * @param {string} id - Conversation UUID
   * @param {string} userId - User UUID to remove
   * @returns {Promise<void>}
   */
  async removeUserFromDeletedBy(id: string, userId: string): Promise<void> {
    const conversation = await this.findConversationById(id);
    if (conversation && conversation.deletedBy) {
      const deletedBy = conversation.deletedBy.filter((id) => id !== userId);
      await this.conversationRepository.update(id, { deletedBy });
    }
  }

  /**
   * Find conversations where user is in deletedBy array
   *
   * @param {string} userId - User UUID
   * @returns {Promise<Conversation[]>} Array of deleted conversations for user
   */
  async findDeletedConversationsByUserId(
    userId: string,
  ): Promise<Conversation[]> {
    const allConversations = await this.conversationRepository.find({
      where: {
        participants: ArrayContains([userId]),
      },
    });

    return allConversations.filter(
      (conv) => conv.deletedBy && conv.deletedBy.includes(userId),
    );
  }
}
