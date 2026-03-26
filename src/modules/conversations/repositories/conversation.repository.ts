import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ArrayContains } from 'typeorm';
import { Conversation } from '../entities/conversation.entity';
import { AccountRole } from '../../accounts/enums';
import { Account } from '../../accounts/entities/accounts.entity';

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
      where: { _id: id },
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

  async findConversationsWithParticipantsByUserId(
    userId: string,
  ): Promise<any[]> {
    return this.conversationRepository
      .createQueryBuilder('conv')
      .leftJoinAndSelect('conv.lastMessage', 'lastMessage')
      .where('conv.participants @> :userId', { userId: [userId] })
      .orderBy('conv.updatedAt', 'DESC')
      .getMany();
  }

  async findConversationsWithParticipants(
    participantIds: string[],
  ): Promise<any[]> {
    return this.conversationRepository
      .createQueryBuilder('conv')
      .leftJoinAndSelect('conv.lastMessage', 'lastMessage')
      .where('conv.participants @> :participantIds', {
        participantIds,
      })
      .orderBy('conv.updatedAt', 'DESC')
      .getMany();
  }

  async findAdminChatlist(): Promise<any[]> {
    return this.conversationRepository.manager
      .createQueryBuilder(Account, 'account')
      .leftJoinAndSelect('account.generalAccount', 'generalAccount')
      .leftJoinAndSelect('account.clinicAdminInformation', 'clinicAdminInfo')
      .where('account.role = ANY(:roles)', {
        roles: [AccountRole.ADMIN, AccountRole.CLINIC_ADMIN],
      })
      .andWhere('account.deletedAt IS NULL')
      .select([
        'account._id as id',
        'account.email as email',
        'account.username as username',
        'account.role as role',
        'account.status as status',
        'account.isEmailVerified as isEmailVerified',
        'account.createdAt as createdAt',
        'account.updatedAt as updatedAt',
        'generalAccount',
        'clinicAdminInfo',
      ])
      .getRawMany();
  }

  async findClinicAdminChatlist(clinicAdminId: string): Promise<any[]> {
    return this.conversationRepository.manager
      .createQueryBuilder(Account, 'account')
      .leftJoinAndSelect('account.generalAccount', 'generalAccount')
      .leftJoinAndSelect('account.clinicManagerInformation', 'clinicManagerInfo')
      .where(
        '(account.role = :adminRole AND account._id != :clinicAdminId) OR (account.role = :managerRole AND account.parentId = :clinicAdminId)',
        {
          adminRole: AccountRole.ADMIN,
          clinicAdminId,
          managerRole: AccountRole.CLINIC_MANAGER,
        },
      )
      .andWhere('account.deletedAt IS NULL')
      .select([
        'account._id as id',
        'account.email as email',
        'account.username as username',
        'account.role as role',
        'account.status as status',
        'account.isEmailVerified as isEmailVerified',
        'account.createdAt as createdAt',
        'account.updatedAt as updatedAt',
        'generalAccount',
        'clinicManagerInfo',
      ])
      .getRawMany();
  }

  async findClinicManagerRelatedAccounts(managerId: string): Promise<any[]> {
    return this.conversationRepository.manager
      .createQueryBuilder(Account, 'account')
      .leftJoinAndSelect('account.clinicAdminInformation', 'clinicAdminInfo')
      .leftJoinAndSelect('account.clinicManagerInformation', 'clinicManagerInfo')
      .leftJoinAndSelect('account.clinicStaffInformation', 'clinicStaffInfo')
      .leftJoinAndSelect('account.doctorInformation', 'doctorInfo')
      .leftJoinAndSelect('account.generalAccount', 'generalAccount')
      .where(
        '(account.role = :adminRole) OR (account.role = :managerRole AND account._id = :managerId) OR (account.role = ANY(:staffRoles) AND account.parentId = :managerId)',
        {
          adminRole: AccountRole.ADMIN,
          managerRole: AccountRole.CLINIC_MANAGER,
          managerId,
          staffRoles: [AccountRole.CLINIC_STAFF, AccountRole.DOCTOR],
        },
      )
      .andWhere('account.deletedAt IS NULL')
      .select([
        'account._id as id',
        'account.email as email',
        'account.username as username',
        'account.role as role',
        'account.status as status',
        'account.parentId as parentId',
        'account.isEmailVerified as isEmailVerified',
        'account.createdAt as createdAt',
        'account.updatedAt as updatedAt',
        'generalAccount',
        'clinicAdminInfo',
        'clinicManagerInfo',
        'clinicStaffInfo',
        'doctorInfo',
      ])
      .getRawMany();
  }

  async findStaffRelatedAccounts(staffId: string): Promise<any[]> {
    const hierarchy = await this.conversationRepository.manager
      .createQueryBuilder(Account, 'staff')
      .leftJoin('staff.clinicStaffInformation', 'staffInfo')
      .leftJoin('clinic_manager_information', 'managerInfo', 'managerInfo._id = staff.parent_id')
      .leftJoin('clinic_admin_information', 'adminInfo', 'adminInfo._id = managerInfo.clinic_admin_id')
      .select([
        'staff._id as staff_id',
        'staff.parent_id as manager_id',
        'managerInfo.clinic_admin_id as admin_id',
      ])
      .where('staff._id = :staffId', { staffId })
      .andWhere('staff.deletedAt IS NULL')
      .getRawOne();

    if (!hierarchy || !hierarchy.manager_id) {
      return [];
    }

    const { manager_id, admin_id } = hierarchy;

    return this.conversationRepository.manager
      .createQueryBuilder(Account, 'account')
      .leftJoinAndSelect('account.clinicAdminInformation', 'clinicAdminInfo')
      .leftJoinAndSelect('account.clinicManagerInformation', 'clinicManagerInfo')
      .leftJoinAndSelect('account.clinicStaffInformation', 'clinicStaffInfo')
      .leftJoinAndSelect('account.doctorInformation', 'doctorInfo')
      .leftJoinAndSelect('account.generalAccount', 'generalAccount')
      .where(
        '(account.role = :adminRole AND account._id = :adminId) OR (account.role = :managerRole AND account._id = :managerId) OR (account.role = ANY(:staffRoles) AND account.parentId = :managerId AND account._id != :staffId)',
        {
          adminRole: AccountRole.ADMIN,
          adminId: admin_id || '00000000-0000-0000-0000-000000000000',
          managerRole: AccountRole.CLINIC_MANAGER,
          managerId: manager_id,
          staffRoles: [AccountRole.CLINIC_STAFF, AccountRole.DOCTOR],
          staffId,
        },
      )
      .andWhere('account.deletedAt IS NULL')
      .select([
        'account._id as id',
        'account.email as email',
        'account.username as username',
        'account.role as role',
        'account.status as status',
        'account.parentId as parentId',
        'account.isEmailVerified as isEmailVerified',
        'account.createdAt as createdAt',
        'account.updatedAt as updatedAt',
        'generalAccount',
        'clinicAdminInfo',
        'clinicManagerInfo',
        'clinicStaffInfo',
        'doctorInfo',
      ])
      .getRawMany();
  }

  async findConversationsWithParticipantsAndMessages(
    participantIds: string[],
    excludeDeletedByAll: boolean = true,
  ): Promise<any[]> {
    const query = this.conversationRepository
      .createQueryBuilder('conv')
      .where('conv.participants @> :participantIds', { participantIds })
      .orderBy('conv.updatedAt', 'DESC');

    const conversations = await query.getMany();

    if (conversations.length === 0) {
      return [];
    }

    const allParticipantIds = new Set<string>();
    const conversationParticipantMap = new Map<string, string[]>();
    
    for (const conv of conversations) {
      const ids = conv.participants || [];
      conversationParticipantMap.set(conv._id, ids);
      ids.forEach((id: string) => allParticipantIds.add(id));
    }

    const participantIdArray = Array.from(allParticipantIds);
    const accounts = await this.conversationRepository.manager
      .createQueryBuilder(Account, 'account')
      .leftJoinAndSelect('account.generalAccount', 'generalAccount')
      .leftJoinAndSelect('account.clinicAdminInformation', 'clinicAdminInfo')
      .leftJoinAndSelect('account.clinicManagerInformation', 'clinicManagerInfo')
      .leftJoinAndSelect('account.clinicStaffInformation', 'clinicStaffInfo')
      .leftJoinAndSelect('account.doctorInformation', 'doctorInfo')
      .where('account._id = ANY(:participantIds)', { participantIds })
      .andWhere('account.deletedAt IS NULL')
      .getMany();

    const accountMap = new Map<string, any>();
    for (const acc of accounts) {
      accountMap.set(acc._id, acc);
    }

    const conversationIds = conversations.map((c) => c._id);
    const lastMessages = await this.conversationRepository.manager
      .createQueryBuilder('message', 'message')
      .where('message.conversation_id = ANY(:convIds)', { convIds: conversationIds })
      .andWhere(
        'message._id = (SELECT m._id FROM messages m WHERE m.conversation_id = message.conversation_id ORDER BY m.created_at DESC LIMIT 1)',
      )
      .getMany();

    const lastMessageMap = new Map<string, any>();
    for (const msg of lastMessages) {
      if (!lastMessageMap.has(msg.conversationId)) {
        lastMessageMap.set(msg.conversationId, msg);
      }
    }

    const result = [];
    for (const conv of conversations) {
      const participantIds_in_conv = conversationParticipantMap.get(conv._id) || [];
      
      if (excludeDeletedByAll && conv.deletedBy) {
        const allDeleted = participantIds.every((pId) => 
          conv.deletedBy.includes(pId)
        );
        if (allDeleted) continue;
      }

      const participants = participantIds_in_conv
        .map((pId: string) => accountMap.get(pId))
        .filter(Boolean)
        .map((acc: any) => {
          const profileInfo =
            acc.clinicAdminInformation ||
            acc.clinicManagerInformation ||
            acc.clinicStaffInformation ||
            acc.doctorInformation ||
            acc.generalAccount ||
            null;

          return {
            id: acc._id,
            email: acc.email,
            username: acc.username,
            role: acc.role,
            status: acc.status,
            isEmailVerified: acc.isEmailVerified,
            createdAt: acc.createdAt,
            updatedAt: acc.updatedAt,
            profileInformation: profileInfo,
          };
        });

      result.push({
        id: conv._id,
        title: conv.title,
        description: conv.description,
        participants,
        lastMessage: lastMessageMap.get(conv._id) || null,
        deletedBy: conv.deletedBy || [],
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      });
    }

    return result;
  }

  async findAllConversationsOptimized(): Promise<any[]> {
    const conversations = await this.conversationRepository.find({
      order: { updatedAt: 'DESC' },
    });

    if (conversations.length === 0) {
      return [];
    }

    const allParticipantIds = new Set<string>();
    const conversationParticipantMap = new Map<string, string[]>();
    
    for (const conv of conversations) {
      const ids = conv.participants || [];
      conversationParticipantMap.set(conv._id, ids);
      ids.forEach((id: string) => allParticipantIds.add(id));
    }

    const participantIdArray = Array.from(allParticipantIds);
    const accounts = await this.conversationRepository.manager
      .createQueryBuilder(Account, 'account')
      .leftJoinAndSelect('account.generalAccount', 'generalAccount')
      .leftJoinAndSelect('account.clinicAdminInformation', 'clinicAdminInfo')
      .leftJoinAndSelect('account.clinicManagerInformation', 'clinicManagerInfo')
      .leftJoinAndSelect('account.clinicStaffInformation', 'clinicStaffInfo')
      .leftJoinAndSelect('account.doctorInformation', 'doctorInfo')
      .where('account._id = ANY(:participantIds)', { participantIds: participantIdArray })
      .andWhere('account.deletedAt IS NULL')
      .getMany();

    const accountMap = new Map<string, any>();
    for (const acc of accounts) {
      accountMap.set(acc._id, acc);
    }

    const conversationIds = conversations.map((c) => c._id);
    const lastMessages = await this.conversationRepository.manager
      .createQueryBuilder('message', 'message')
      .distinctOn(['message.conversation_id'])
      .where('message.conversation_id = ANY(:convIds)', { convIds: conversationIds })
      .orderBy('message.conversation_id', 'DESC')
      .addOrderBy('message.created_at', 'DESC')
      .getMany();

    const lastMessageMap = new Map<string, any>();
    for (const msg of lastMessages) {
      if (!lastMessageMap.has(msg.conversationId)) {
        lastMessageMap.set(msg.conversationId, msg);
      }
    }

    const result = [];
    for (const conv of conversations) {
      const participantIds_in_conv = conversationParticipantMap.get(conv._id) || [];
      
      const participants = participantIds_in_conv
        .map((pId: string) => accountMap.get(pId))
        .filter(Boolean)
        .map((acc: any) => {
          const profileInfo =
            acc.clinicAdminInformation ||
            acc.clinicManagerInformation ||
            acc.clinicStaffInformation ||
            acc.doctorInformation ||
            acc.generalAccount ||
            null;

          return {
            id: acc._id,
            email: acc.email,
            username: acc.username,
            role: acc.role,
            status: acc.status,
            isEmailVerified: acc.isEmailVerified,
            createdAt: acc.createdAt,
            updatedAt: acc.updatedAt,
            profileInformation: profileInfo,
          };
        });

      result.push({
        id: conv._id,
        title: conv.title,
        description: conv.description,
        participants,
        lastMessage: lastMessageMap.get(conv._id) || null,
        deletedBy: conv.deletedBy || [],
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      });
    }

    return result;
  }

  async findConversationByIdWithParticipants(conversationId: string): Promise<any | null> {
    const conv = await this.findConversationById(conversationId);
    if (!conv) return null;

    const participantIds = conv.participants || [];
    
    const accounts = await this.conversationRepository.manager
      .createQueryBuilder(Account, 'account')
      .leftJoinAndSelect('account.generalAccount', 'generalAccount')
      .leftJoinAndSelect('account.clinicAdminInformation', 'clinicAdminInfo')
      .leftJoinAndSelect('account.clinicManagerInformation', 'clinicManagerInfo')
      .leftJoinAndSelect('account.clinicStaffInformation', 'clinicStaffInfo')
      .leftJoinAndSelect('account.doctorInformation', 'doctorInfo')
      .where('account._id = ANY(:participantIds)', { participantIds })
      .andWhere('account.deletedAt IS NULL')
      .getMany();

    const accountMap = new Map<string, any>();
    for (const acc of accounts) {
      accountMap.set(acc._id, acc);
    }

    const lastMessage = await this.conversationRepository.manager
      .createQueryBuilder('message', 'message')
      .where('message.conversation_id = :convId', { convId: conversationId })
      .orderBy('message.created_at', 'DESC')
      .limit(1)
      .getOne();

    const participants = participantIds
      .map((pId: string) => accountMap.get(pId))
      .filter(Boolean)
      .map((acc: any) => {
        const profileInfo =
          acc.clinicAdminInformation ||
          acc.clinicManagerInformation ||
          acc.clinicStaffInformation ||
          acc.doctorInformation ||
          acc.generalAccount ||
          null;

        return {
          id: acc._id,
          email: acc.email,
          username: acc.username,
          role: acc.role,
          status: acc.status,
          isEmailVerified: acc.isEmailVerified,
          createdAt: acc.createdAt,
          updatedAt: acc.updatedAt,
          profileInformation: profileInfo,
        };
      });

    return {
      id: conv._id,
      title: conv.title,
      description: conv.description,
      participants,
      lastMessage,
      deletedBy: conv.deletedBy || [],
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    };
  }
}
