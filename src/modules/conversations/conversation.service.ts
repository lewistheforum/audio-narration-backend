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

  async create(
    createConversationDto: CreateConversationDto,
  ): Promise<any> {
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
    const conversation = await this.conversationRepository.findConversationByIdWithParticipants(id);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }

  async findByParticipants(
    participants: string[],
  ): Promise<any[]> {
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
    const accounts = await this.conversationRepository.findAdminChatlist();
    return this.mapRawAccountsToResponse(accounts);
  }

  async getClinicAdminChatlist(clinicAdminId: string): Promise<any[]> {
    const accounts = await this.conversationRepository.findClinicAdminChatlist(
      clinicAdminId,
    );
    return this.mapRawAccountsToResponse(accounts);
  }

  async getClinicManagerRelatedAccounts(managerId: string): Promise<any[]> {
    const accounts =
      await this.conversationRepository.findClinicManagerRelatedAccounts(managerId);
    return this.mapRawAccountsToResponse(accounts);
  }

  async getStaffRelatedAccounts(staffId: string): Promise<any[]> {
    const accounts = await this.conversationRepository.findStaffRelatedAccounts(
      staffId,
    );
    return this.mapRawAccountsToResponse(accounts);
  }

  async getDoctorChatlist(doctorId: string): Promise<any[]> {
    const hierarchy = await this.conversationRepository.findStaffRelatedAccounts(doctorId);

    if (!hierarchy || hierarchy.length === 0) {
      return [];
    }

    const patientIds = new Set<string>();
    const staffAccountIds = new Set<string>();

    for (const acc of hierarchy) {
      if (acc.role === 'PATIENT') {
        patientIds.add(acc.id);
      } else if (acc.role !== 'ADMIN' && acc.role !== 'CLINIC_ADMIN' && acc.role !== 'CLINIC_MANAGER') {
        staffAccountIds.add(acc.id);
      }
    }

    const appointmentPatients = await this.AccountsService['accountRepository']
      .createQueryBuilder('account')
      .innerJoin('appointments', 'appt', 'appt.patient_id = account._id')
      .leftJoin('account.generalAccount', 'generalAccount')
      .where('(appt.doctor_id = :doctorId OR EXISTS (SELECT 1 FROM employee_schedule es JOIN clinic_shift cs ON es.clinic_shift_id = cs._id WHERE es.employee_id = :doctorId AND es.clinic_shift_id = cs._id AND cs._id = (SELECT csh.shift_id FROM clinic_shift_hour csh WHERE csh._id = appt.clinic_shift_hour_id)))', {
        doctorId,
      })
      .andWhere('account.role = :patientRole', {
        patientRole: 'PATIENT',
      })
      .andWhere('account.deletedAt IS NULL')
      .select([
        'account._id as id',
        'account.email as email',
        'account.username as username',
        'account.role as role',
        'account.status as status',
        'account.is_email_verified as isEmailVerified',
        'account.created_at as createdAt',
        'account.updated_at as updatedAt',
      ])
      .getRawMany();

    for (const patient of appointmentPatients) {
      patientIds.add(patient.id);
    }

    if (patientIds.size === 0) {
      return [];
    }

    const patients = await this.AccountsService['accountRepository']
      .createQueryBuilder('account')
      .leftJoinAndSelect('account.generalAccount', 'generalAccount')
      .where('account._id = ANY(:patientIds)', { patientIds: Array.from(patientIds) })
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
      ])
      .getRawMany();

    const combined = [...hierarchy.filter(a => a.role === 'PATIENT' || (a.role !== 'ADMIN' && a.role !== 'CLINIC_ADMIN' && a.role !== 'CLINIC_MANAGER')), ...patients];
    const uniqueIds = new Set<string>();
    const result = [];
    for (const acc of combined) {
      if (!uniqueIds.has(acc.id)) {
        uniqueIds.add(acc.id);
        result.push({
          id: acc.id,
          email: acc.email,
          username: acc.username,
          role: acc.role,
          status: acc.status,
          isEmailVerified: acc.isEmailVerified,
          createdAt: acc.createdAt,
          updatedAt: acc.updatedAt,
          profileInformation: acc.generalAccount || acc.general_account || null,
        });
      }
    }
    return result;
  }

  async getPatientChatlist(patientId: string): Promise<any[]> {
    const doctors = await this.AccountsService['accountRepository']
      .createQueryBuilder('account')
      .innerJoinAndSelect('account.doctorInformation', 'doctorInformation')
      .innerJoin('employee_schedule', 'es', 'es.employee_id = account._id')
      .innerJoin('clinic_shift', 'cs', 'cs._id = es.clinic_shift_id')
      .innerJoin('appointments', 'appt', 'appt.clinic_shift_hour_id = cs._id')
      .where('appt.patient_id = :patientId', { patientId })
      .andWhere('account.role = :doctorRole', { doctorRole: 'DOCTOR' })
      .andWhere('account.deletedAt IS NULL')
      .getMany();

    return doctors.map((d: any) => {
      return {
        id: d._id,
        email: d.email,
        username: d.username,
        role: d.role,
        status: d.status,
        isEmailVerified: d.isEmailVerified,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        profileInformation: d.doctorInformation || null,
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

  private mapRawAccountsToResponse(accounts: any[]): any[] {
    return accounts.map((account) => {
      const {
        id,
        email,
        username,
        role,
        status,
        parentId,
        isEmailVerified,
        createdAt,
        updatedAt,
        general_account,
        clinic_admin_information,
        clinic_manager_information,
        clinic_staff_information,
        doctor_information,
      } = account;

      return {
        id,
        email,
        username,
        role,
        status,
        parentId,
        isEmailVerified,
        createdAt,
        updatedAt,
        profileInformation:
          clinic_admin_information ||
          clinic_manager_information ||
          clinic_staff_information ||
          doctor_information ||
          general_account ||
          null,
      };
    });
  }
}
