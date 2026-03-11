import { ApiProperty } from '@nestjs/swagger';
import { MessageResponseDto } from 'src/modules/messages/dto/message-response.dto';
import { AccountResponseDto } from 'src/modules/accounts/dto';
import { AccountsService } from 'src/modules/accounts/accounts.service';
import { MessagesService } from 'src/modules/messages/messages.service';
import { getCurrentVietnamTime } from '../../../common/utils/date.util';

export class ConversationResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the conversation',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Title of the conversation',
    example: 'Medical Consultation',
    nullable: true,
  })
  title: string;

  @ApiProperty({
    description: 'Description of the conversation',
    example: 'Discussion about patient symptoms and treatment options',
    nullable: true,
  })
  description: string;

  @ApiProperty({
    description: 'List of participants in the conversation',
    type: [AccountResponseDto],
    example: [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user1@example.com',
        name: 'John Doe',
        createdAt: '2024-01-15T10:30:00.000Z',
        updatedAt: '2024-01-15T10:30:00.000Z',
      },
      {
        id: '223e4567-e89b-12d3-a456-426614174001',
        email: 'user2@example.com',
        name: 'Jane Smith',
        createdAt: '2024-01-15T10:30:00.000Z',
        updatedAt: '2024-01-15T10:30:00.000Z',
      },
    ],
  })
  participants: AccountResponseDto[];

  @ApiProperty({
    description: 'Last message in the conversation',
    type: MessageResponseDto,
    nullable: true,
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      conversationId: '123e4567-e89b-12d3-a456-426614174000',
      senderId: '123e4567-e89b-12d3-a456-426614174000',
      receiverId: '123e4567-e89b-12d3-a456-426614174000',
      content: 'Hello, how are you feeling today?',
      messageType: 'text',
      isRead: false,
      createdAt: '2024-01-15T10:30:00.000Z',
      updatedAt: '2024-01-15T10:30:00.000Z',
    },
  })
  lastMessage: MessageResponseDto | null;

  @ApiProperty({
    description: 'List of users who have deleted the conversation',
    example: [
      '123e4567-e89b-12d3-a456-426614174000',
      '223e4567-e89b-12d3-a456-426614174001',
    ],
    nullable: true,
  })
  deletedBy: string[];

  @ApiProperty({
    description: 'Date when the conversation was created',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Date when the conversation was last updated',
    example: '2024-01-15T10:30:00.000Z',
  })
  updatedAt: Date;

  constructor(
    conversation:
      | (Omit<Partial<ConversationResponseDto>, 'participants'> & {
          participants?: string[] | AccountResponseDto[];
        })
      | any,
    AccountsService?: AccountsService,
  ) {
    this.id = conversation._id || conversation.id || '';
    this.title = conversation.title || '';
    this.description = conversation.description || '';
    this.participants =
      Array.isArray(conversation.participants) &&
      conversation.participants.length > 0 &&
      typeof conversation.participants[0] === 'string'
        ? []
        : (conversation.participants as AccountResponseDto[]) || [];
    this.lastMessage = conversation.lastMessage || null;
    this.deletedBy = conversation.deletedBy || [];
    this.createdAt = conversation.createdAt || getCurrentVietnamTime();
    this.updatedAt = conversation.updatedAt || getCurrentVietnamTime();
  }

  // Static method to create with populated participants and last message
  static async createWithParticipants(
    conversation:
      | (Omit<Partial<ConversationResponseDto>, 'participants'> & {
          participants: string[];
        })
      | any,
    AccountsService: AccountsService,
    messagesService?: MessagesService,
  ): Promise<ConversationResponseDto> {
    const dto = new ConversationResponseDto(conversation, AccountsService);

    if (conversation.participants && conversation.participants.length > 0) {
      try {
        const participantUsers = await AccountsService.findAccountsByIds(
          conversation.participants,
        );
        dto.participants = participantUsers.map(
          (user) =>
            new AccountResponseDto(
              user,
              user.generalAccount,
              user.clinicStaffInformation,
              user.doctorInformation,
              user.clinicManagerInformation,
              user.clinicAdminInformation,
            ),
        );
      } catch (error) {
        console.error('Error fetching participant data:', error);
        dto.participants = [];
      }
    }

    // Fetch last message if messagesService is provided
    if (messagesService) {
      try {
        dto.lastMessage = await messagesService.findLastMessageByConversation(
          conversation._id || conversation.id,
        );
      } catch (error) {
        console.error('Error fetching last message:', error);
        dto.lastMessage = null;
      }
    }

    return dto;
  }
}
