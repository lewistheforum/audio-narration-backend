import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
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
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => AccountsService))
    private AccountsService: AccountsService,
    @Inject(forwardRef(() => MessagesService))
    private messagesService: MessagesService,
  ) {}

  async create(createConversationDto: CreateConversationDto): Promise<any> {
    const existingConversation = await this.findExactConversationByParticipants(
      createConversationDto.participants,
    );

    if (existingConversation) {
      if (
        createConversationDto.createdUserId &&
        existingConversation.deletedBy?.includes(
          createConversationDto.createdUserId,
        )
      ) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          const updatedDeletedBy = existingConversation.deletedBy.filter(
            (id: string) => id !== createConversationDto.createdUserId,
          );

          await queryRunner.manager.update(
            'conversations',
            { _id: existingConversation._id },
            { deletedBy: updatedDeletedBy },
          );

          await queryRunner.commitTransaction();
        } catch (error) {
          await queryRunner.rollbackTransaction();
          throw error;
        } finally {
          await queryRunner.release();
        }

        return this.conversationRepository.findConversationByIdWithParticipants(
          existingConversation._id,
        );
      }

      return this.conversationRepository.findConversationByIdWithParticipants(
        existingConversation._id,
      );
    }

    const savedConversation =
      await this.conversationRepository.createConversation(
        createConversationDto,
      );
    return this.conversationRepository.findConversationByIdWithParticipants(
      savedConversation._id,
    );
  }

  private async findExactConversationByParticipants(
    participants: string[],
  ): Promise<Conversation | null> {
    const sortedParticipants = [...participants].sort();

    const conversations =
      await this.conversationRepository.findConversationsByParticipants(
        sortedParticipants,
      );

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

  async findAll(): Promise<any[]> {
    return this.conversationRepository.findAllConversationsOptimized();
  }

  async findOne(id: string): Promise<any> {
    const conversation =
      await this.conversationRepository.findConversationByIdWithParticipants(
        id,
      );
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }

  async findByParticipants(participants: string[]): Promise<any[]> {
    return this.conversationRepository.findConversationsWithParticipantsAndMessages(
      participants,
      true,
    );
  }

  async update(
    id: string,
    updateConversationDto: UpdateConversationDto,
  ): Promise<any> {
    await this.conversationRepository.updateConversation(
      id,
      updateConversationDto,
    );

    return this.conversationRepository.findConversationByIdWithParticipants(id);
  }

  async delete(conversationId: string, userId: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.update(
        'conversations',
        { _id: conversationId },
        {
          deletedBy: () => `array_append(deleted_by, '${userId}')`,
        },
      );
      await this.messagesService.updateLastMessageDeletedBy(
        conversationId,
        userId,
      );
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async clearDeletedBy(conversationId: string): Promise<void> {
    await this.conversationRepository.clearDeletedBy(conversationId);
  }

  async hasDeletedByValues(conversationId: string): Promise<boolean> {
    return await this.conversationRepository.hasDeletedByValues(conversationId);
  }

  // --- Account Fetching for Chat ---

  async getAdminChatlist(): Promise<any[]> {
    return this.conversationRepository.findAdminChatlist();
  }

  async getClinicAdminChatlist(clinicAdminId: string): Promise<any[]> {
    return this.conversationRepository.findClinicAdminChatlist(clinicAdminId);
  }

  async getClinicManagerRelatedAccounts(managerId: string): Promise<any[]> {
    return this.conversationRepository.findClinicManagerRelatedAccounts(
      managerId,
    );
  }

  async getStaffRelatedAccounts(staffId: string): Promise<any[]> {
    return this.conversationRepository.findStaffRelatedAccounts(staffId);
  }

  async getDoctorChatlist(doctorId: string): Promise<any[]> {
    const staffAccounts =
      await this.conversationRepository.findStaffRelatedAccounts(doctorId);

    // Get patients from appointments
    const appointmentPatients = await this.AccountsService['accountRepository']
      .createQueryBuilder('account')
      .innerJoin('appointments', 'appt', 'appt.patient_id = account._id')
      .where(
        '(appt.doctor_id = :doctorId OR EXISTS (SELECT 1 FROM employee_schedule es JOIN clinic_shift cs ON es.clinic_shift_id = cs._id WHERE es.employee_id = :doctorId AND es.clinic_shift_id = cs._id AND cs._id = (SELECT csh.shift_id FROM clinic_shift_hour csh WHERE csh._id = appt.clinic_shift_hour_id)))',
        {
          doctorId,
        },
      )
      .andWhere('account.role = :patientRole', {
        patientRole: 'PATIENT',
      })
      .andWhere('account.deletedAt IS NULL')
      .select(['account._id as id'])
      .getRawMany();

    const patientIds = appointmentPatients.map((p) => p.id);
    const existingIds = new Set(staffAccounts.map((a) => a.id));
    const idsToFetch = patientIds.filter((id) => !existingIds.has(id));

    const detailedPatients =
      await this.conversationRepository.findAccountsWithDetails(idsToFetch);

    const combined = [...staffAccounts, ...detailedPatients];
    const uniqueIds = new Set<string>();
    return combined.filter((acc) => {
      if (!uniqueIds.has(acc.id)) {
        uniqueIds.add(acc.id);
        return true;
      }
      return false;
    });
  }

  async getPatientChatlist(patientId: string): Promise<any[]> {
    const doctors = await this.AccountsService['accountRepository']
      .createQueryBuilder('account')
      .where('account.role = :doctorRole', { doctorRole: 'DOCTOR' })
      .andWhere('account.deletedAt IS NULL')
      .andWhere(
        `EXISTS (
          SELECT 1 FROM appointments appt 
          WHERE appt.patient_id = :patientId 
          AND (
            appt.doctor_id = account._id 
            OR EXISTS (
              SELECT 1 FROM employee_schedule es 
              JOIN clinic_shift_hour csh ON csh.shift_id = es.clinic_shift_id
              WHERE es.employee_id = account._id 
              AND csh._id = appt.clinic_shift_hour_id
              AND es.work_date = appt.appointment_date
            )
          )
        )`,
        { patientId },
      )
      .select(['account._id as id'])
      .getRawMany();

    const doctorIds = doctors.map((d) => d.id);
    return this.conversationRepository.findAccountsWithDetails(doctorIds);
  }
}
