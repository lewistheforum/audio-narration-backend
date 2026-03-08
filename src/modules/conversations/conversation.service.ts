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
  ) {}

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
          existingConversation._id,
          { deletedBy: updatedDeletedBy },
        );

        // Return the updated conversation
        const updatedConversation = await this.findConversationEntityById(
          existingConversation._id,
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
    const savedConversation =
      await this.conversationRepository.createConversation(
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

    const conversations =
      await this.conversationRepository.findConversationsByParticipants(
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
    const conversations =
      await this.conversationRepository.findAllConversations();
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
    const conversations =
      await this.conversationRepository.findConversationsByParticipants(
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
    const updatedConversation =
      await this.conversationRepository.updateConversation(
        id,
        updateConversationDto,
      );

    return ConversationResponseDto.createWithParticipants(
      updatedConversation,
      this.AccountsService,
    );
  }

  async delete(conversationId: string, userId: string): Promise<void> {
    await this.conversationRepository.addUserToDeletedBy(
      conversationId,
      userId,
    );
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
    const conversation =
      await this.conversationRepository.findConversationById(id);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }

  // --- Account Fetching for Chat ---

  async getAdminChatlist(): Promise<any[]> {
    const accounts = await this.AccountsService[
      'accountRepository'
    ].findAccounts({
      where: [{ role: 'ADMIN' as any }, { role: 'CLINIC_ADMIN' as any }],
      relations: ['generalAccount', 'clinicAdminInformation'],
    });

    return this.mapAccountsToResponse(accounts);
  }

  async getClinicAdminChatlist(clinicAdminId: string): Promise<any[]> {
    const accounts = await this.AccountsService[
      'accountRepository'
    ].findAccounts({
      where: [
        { role: 'ADMIN' as any }, // The system admin
        { parentId: clinicAdminId }, // The Clinic Managers under this admin
      ],
      relations: ['generalAccount', 'clinicManagerInformation'],
    });

    return this.mapAccountsToResponse(accounts);
  }

  async getClinicManagerRelatedAccounts(managerId: string): Promise<any[]> {
    const managerAccount =
      await this.AccountsService.findAccountEntityById(managerId);

    // Admin is the parent of the manager
    const adminId = managerAccount.parentId;

    // Find admin, and all staff/doctors whose parent is this manager
    const accounts = await this.AccountsService[
      'accountRepository'
    ].findAccounts({
      where: [
        { _id: adminId }, // The Clinic Admin
        { parentId: managerId }, // Staff and Doctors
      ],
      relations: [
        'clinicAdminInformation',
        'clinicManagerInformation',
        'clinicStaffInformation',
        'doctorInformation',
      ],
    });

    return this.mapAccountsToResponse(accounts);
  }

  async getStaffRelatedAccounts(staffId: string): Promise<any[]> {
    const staffAccount =
      await this.AccountsService.findAccountEntityById(staffId);

    // Manager is the parent of the staff
    const managerId = staffAccount.parentId;
    if (!managerId) {
      return [];
    }

    const managerAccount =
      await this.AccountsService.findAccountEntityById(managerId);
    const adminId = managerAccount.parentId;

    // Find the admin, the manager, and all other staff/doctors with the same manager
    const accounts = await this.AccountsService[
      'accountRepository'
    ].findAccounts({
      where: [
        ...(adminId ? [{ _id: adminId }] : []), // The Clinic Admin
        { _id: managerId }, // The Clinic Manager
        { parentId: managerId }, // Other Staff and Doctors
      ],
      relations: [
        'clinicAdminInformation',
        'clinicManagerInformation',
        'clinicStaffInformation',
        'doctorInformation',
      ],
    });

    // Optionally filter out the requesting staff itself
    const filteredAccounts = accounts.filter((acc) => acc._id !== staffId);

    return this.mapAccountsToResponse(filteredAccounts);
  }

  async getDoctorChatlist(doctorId: string): Promise<any[]> {
    // 1. Get staff/doctors with the same manager
    const staffAccounts = await this.getStaffRelatedAccounts(doctorId);

    // 2. Get patients examined by this doctor
    const patients = await this.AccountsService['accountRepository']
      .createQueryBuilder('account')
      .innerJoinAndSelect('account.generalAccount', 'generalAccount')
      .innerJoin('appointments', 'appt', 'appt.patient_id = account._id')
      .leftJoin(
        'clinic_shift_hour',
        'csh',
        'csh._id = appt.clinic_shift_hour_id',
      )
      .leftJoin('clinic_shift', 'cs', 'cs._id = csh.shift_id')
      .leftJoin('employee_schedule', 'es', 'es.clinic_shift_id = cs._id')
      .where('(appt.doctor_id = :doctorId OR es.employee_id = :doctorId)', {
        doctorId,
      })
      .getMany();

    const formattedPatients = patients.map((p) => {
      const { _id, generalAccount, ...rest } = p;
      return {
        id: _id,
        ...rest,
        profileInformation: generalAccount || null,
      };
    });

    const combined = [...staffAccounts, ...formattedPatients];
    const uniqueIds = new Set();
    const result = [];
    for (const acc of combined) {
      if (
        !uniqueIds.has(acc.id) &&
        acc.role !== 'ADMIN' &&
        acc.role !== 'CLINIC_ADMIN' &&
        acc.role !== 'CLINIC_MANAGER'
      ) {
        uniqueIds.add(acc.id);
        result.push(acc);
      }
    }
    return result;
  }

  async getPatientChatlist(patientId: string): Promise<any[]> {
    const doctors = await this.AccountsService['accountRepository']
      .createQueryBuilder('account')
      .innerJoinAndSelect('account.doctorInformation', 'doctorInformation')
      .leftJoin('employee_schedule', 'es', 'es.employee_id = account._id')
      .leftJoin('clinic_shift', 'cs', 'cs._id = es.clinic_shift_id')
      .leftJoin('clinic_shift_hour', 'csh', 'csh.shift_id = cs._id')
      .innerJoin(
        'appointments',
        'appt',
        '(appt.clinic_shift_hour_id = csh._id OR appt.doctor_id = account._id)',
      )
      .where('appt.patient_id = :patientId', { patientId })
      .getMany();

    return doctors.map((d: any) => {
      const { _id, doctorInformation, ...rest } = d;
      return {
        id: _id,
        ...rest,
        profileInformation: doctorInformation || null,
      };
    });
  }

  private mapAccountsToResponse(accounts: any[]): any[] {
    return accounts.map((account) => {
      const {
        _id,
        clinicAdminInformation,
        clinicManagerInformation,
        clinicStaffInformation,
        doctorInformation,
        ...rest
      } = account;

      return {
        id: _id,
        ...rest,
        profileInformation:
          clinicAdminInformation ||
          clinicManagerInformation ||
          clinicStaffInformation ||
          doctorInformation ||
          null,
      };
    });
  }
}
