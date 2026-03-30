import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ArrayContains } from 'typeorm';
import { Conversation } from '../entities/conversation.entity';
import { AccountRole } from '../../accounts/enums';
import { Account } from '../../accounts/entities/accounts.entity';
import { Message } from '../../messages/entities/message.entity';

/**
 * Conversation Repository
 *
 * Data access layer for Conversation entity.
 */
@Injectable()
export class ConversationRepository {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
  ) {}

  async createConversation(
    conversationData: Partial<Conversation>,
  ): Promise<Conversation> {
    const conversation = this.conversationRepository.create(conversationData);
    return this.conversationRepository.save(conversation);
  }

  async findAllConversations(): Promise<Conversation[]> {
    return this.conversationRepository.find({
      order: { updatedAt: 'DESC' },
    });
  }

  async findConversationById(id: string): Promise<Conversation | null> {
    return this.conversationRepository.findOne({
      where: { _id: id },
    });
  }

  async findConversationsByParticipants(
    participantIds: string[],
  ): Promise<Conversation[]> {
    return this.conversationRepository.find({
      where: {
        participants: ArrayContains(participantIds),
      },
    });
  }

  async findConversationsByUserId(userId: string): Promise<Conversation[]> {
    return this.conversationRepository.find({
      where: {
        participants: ArrayContains([userId]),
      },
      order: { updatedAt: 'DESC' },
    });
  }

  async updateConversation(
    id: string,
    updateData: Partial<Conversation>,
  ): Promise<Conversation | null> {
    await this.conversationRepository.update(id, updateData);
    return this.findConversationById(id);
  }

  async softDeleteConversation(id: string): Promise<void> {
    await this.conversationRepository.softDelete(id);
  }

  async hardDeleteConversation(id: string): Promise<void> {
    await this.conversationRepository.delete(id);
  }

  async hasDeletedByValues(id: string): Promise<boolean> {
    const conversation = await this.findConversationById(id);
    return (
      conversation !== null &&
      conversation.deletedBy &&
      conversation.deletedBy.length > 0
    );
  }

  async clearDeletedBy(id: string): Promise<void> {
    await this.conversationRepository.update(id, { deletedBy: [] });
  }

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

  async removeUserFromDeletedBy(id: string, userId: string): Promise<void> {
    const conversation = await this.findConversationById(id);
    if (conversation && conversation.deletedBy) {
      const deletedBy = conversation.deletedBy.filter((id) => id !== userId);
      await this.conversationRepository.update(id, { deletedBy });
    }
  }

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
    const accounts = await this.conversationRepository.manager
      .createQueryBuilder(Account, 'account')
      .leftJoinAndSelect('account.generalAccount', 'generalAccount')
      .leftJoinAndSelect('account.clinicAdminInformation', 'clinicAdminInfo')
      .where('account.role = ANY(:roles)', {
        roles: [AccountRole.ADMIN, AccountRole.CLINIC_ADMIN],
      })
      .andWhere('account.deletedAt IS NULL')
      .getMany();

    return accounts.map((acc) => this.mapAccountToDetail(acc));
  }

  async findClinicAdminChatlist(clinicAdminId: string): Promise<any[]> {
    const accounts = await this.conversationRepository.manager
      .createQueryBuilder(Account, 'account')
      .leftJoinAndSelect('account.generalAccount', 'generalAccount')
      .leftJoinAndSelect(
        'account.clinicManagerInformation',
        'clinicManagerInfo',
      )
      .where(
        '(account.role = :adminRole AND account._id != :clinicAdminId) OR (account.role = :managerRole AND account.parentId = :clinicAdminId)',
        {
          adminRole: AccountRole.ADMIN,
          clinicAdminId,
          managerRole: AccountRole.CLINIC_MANAGER,
        },
      )
      .andWhere('account.deletedAt IS NULL')
      .getMany();

    return accounts.map((acc) => this.mapAccountToDetail(acc));
  }

  async findClinicManagerRelatedAccounts(managerId: string): Promise<any[]> {
    const accounts = await this.conversationRepository.manager
      .createQueryBuilder(Account, 'account')
      .leftJoinAndSelect('account.clinicAdminInformation', 'clinicAdminInfo')
      .leftJoinAndSelect(
        'account.clinicManagerInformation',
        'clinicManagerInfo',
      )
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
      .getMany();

    return accounts.map((acc) => this.mapAccountToDetail(acc));
  }

  async findStaffRelatedAccounts(staffId: string): Promise<any[]> {
    const hierarchy = await this.conversationRepository.manager
      .createQueryBuilder(Account, 'staff')
      .leftJoin('staff.parent', 'manager')
      .select([
        'staff._id as staff_id',
        'staff.parentId as manager_id',
        'manager.parentId as admin_id',
      ])
      .where('staff._id = :staffId', { staffId })
      .andWhere('staff.deletedAt IS NULL')
      .getRawOne();

    if (!hierarchy || !hierarchy.manager_id) {
      return [];
    }

    const { manager_id, admin_id } = hierarchy;

    const accounts = await this.conversationRepository.manager
      .createQueryBuilder(Account, 'account')
      .leftJoinAndSelect('account.clinicAdminInformation', 'clinicAdminInfo')
      .leftJoinAndSelect(
        'account.clinicManagerInformation',
        'clinicManagerInfo',
      )
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
      .getMany();

    return accounts.map((acc) => this.mapAccountToDetail(acc));
  }

  async findAccountsWithDetails(accountIds: string[]): Promise<any[]> {
    if (!accountIds || accountIds.length === 0) return [];

    const accounts = await this.conversationRepository.manager
      .createQueryBuilder(Account, 'account')
      .leftJoinAndSelect('account.clinicAdminInformation', 'clinicAdminInfo')
      .leftJoinAndSelect(
        'account.clinicManagerInformation',
        'clinicManagerInfo',
      )
      .leftJoinAndSelect('account.clinicStaffInformation', 'clinicStaffInfo')
      .leftJoinAndSelect('account.doctorInformation', 'doctorInfo')
      .leftJoinAndSelect('account.generalAccount', 'generalAccount')
      .where('account._id = ANY(:accountIds)', {
        accountIds,
      })
      .andWhere('account.deletedAt IS NULL')
      .getMany();

    return accounts.map((acc) => this.mapAccountToDetail(acc));
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
    for (const conv of conversations) {
      if (conv.participants) {
        conv.participants.forEach((id: string) => allParticipantIds.add(id));
      }
    }

    const participantIdArray = Array.from(allParticipantIds);
    const accounts = await this.findAccountsWithDetails(participantIdArray);
    const accountMap = new Map<string, any>();
    for (const acc of accounts) {
      accountMap.set(acc.id, acc);
    }

    const conversationIds = conversations.map((c) => c._id);
    const lastMessages = await this.conversationRepository.manager
      .createQueryBuilder(Message, 'message')
      .where('message.conversation_id = ANY(:convIds)', {
        convIds: conversationIds,
      })
      .andWhere(
        'message._id = (SELECT m._id FROM messages m WHERE m.conversation_id = message.conversation_id ORDER BY m.created_at DESC LIMIT 1)',
      )
      .getMany();

    const lastMessageMap = new Map<string, any>();
    for (const msg of lastMessages) {
      lastMessageMap.set(msg.conversationId, msg);
    }

    const result = [];
    for (const conv of conversations) {
      if (excludeDeletedByAll && conv.deletedBy && conv.deletedBy.length > 0) {
        const allDeleted = conv.participants.every((pId) =>
          conv.deletedBy.includes(pId),
        );
        if (allDeleted) continue;
      }

      const participants = (conv.participants || [])
        .map((pId: string) => accountMap.get(pId))
        .filter(Boolean);

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
    for (const conv of conversations) {
      if (conv.participants) {
        conv.participants.forEach((id: string) => allParticipantIds.add(id));
      }
    }

    const participantIdArray = Array.from(allParticipantIds);
    const accounts = await this.findAccountsWithDetails(participantIdArray);
    const accountMap = new Map<string, any>();
    for (const acc of accounts) {
      accountMap.set(acc.id, acc);
    }

    const conversationIds = conversations.map((c) => c._id);
    const lastMessages = await this.conversationRepository.manager
      .createQueryBuilder(Message, 'message')
      .distinctOn(['message.conversation_id'])
      .where('message.conversation_id = ANY(:convIds)', {
        convIds: conversationIds,
      })
      .orderBy('message.conversation_id', 'DESC')
      .addOrderBy('message.created_at', 'DESC')
      .getMany();

    const lastMessageMap = new Map<string, any>();
    for (const msg of lastMessages) {
      lastMessageMap.set(msg.conversationId, msg);
    }

    const result = [];
    for (const conv of conversations) {
      const participants = (conv.participants || [])
        .map((pId: string) => accountMap.get(pId))
        .filter(Boolean);

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

  async findConversationByIdWithParticipants(
    conversationId: string,
  ): Promise<any | null> {
    const conv = await this.findConversationById(conversationId);
    if (!conv) return null;

    const participants = await this.findAccountsWithDetails(
      conv.participants || [],
    );

    const lastMessage = await this.conversationRepository.manager
      .createQueryBuilder(Message, 'message')
      .where('message.conversation_id = :convId', { convId: conversationId })
      .orderBy('message.created_at', 'DESC')
      .limit(1)
      .getOne();

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

  private mapAccountToDetail(acc: Account) {
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
      parentId: acc.parentId,
      fullName:
        acc.clinicAdminInformation?.clinicName ||
        acc.clinicManagerInformation?.fullName ||
        acc.clinicStaffInformation?.fullName ||
        acc.doctorInformation?.fullName ||
        acc.generalAccount?.fullName ||
        'Unknown',
      gender:
        acc.clinicManagerInformation?.gender ||
        acc.clinicStaffInformation?.gender ||
        acc.doctorInformation?.gender ||
        acc.generalAccount?.gender ||
        null,
      isEmailVerified: acc.isEmailVerified,
      createdAt: acc.createdAt,
      updatedAt: acc.updatedAt,
      generalAccount: acc.generalAccount,
      clinicAdminInfo: acc.clinicAdminInformation,
      clinicManagerInfo: acc.clinicManagerInformation,
      clinicStaffInfo: acc.clinicStaffInformation,
      doctorInfo: acc.doctorInformation,
      profileInformation: profileInfo,
    };
  }
}
