import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateMessageDto } from '../../../../src/modules/messages/dto/create-message.dto';
import { MessageType } from '../../../../src/modules/messages/enums/message-type.enum';
import { MessagesController } from '../../../../src/modules/messages/messages.controller';
import { MessagesService } from '../../../../src/modules/messages/messages.service';

describe('UC-108 Chatting', () => {
  const ids = {
    conversationId: '123e4567-e89b-42d3-a456-426614174501',
    senderId: '123e4567-e89b-42d3-a456-426614174502',
    receiverId: '123e4567-e89b-42d3-a456-426614174503',
    messageId: '123e4567-e89b-42d3-a456-426614174504',
  };

  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(CreateMessageDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const createService = (messageOverrides?: any) => {
    const now = new Date();
    const message = {
      _id: ids.messageId,
      conversationId: ids.conversationId,
      senderId: ids.senderId,
      receiverId: ids.receiverId,
      content: 'hello',
      messageType: MessageType.TEXT,
      isRead: false,
      isUpdated: false,
      deletedBy: [],
      createdAt: now,
      updatedAt: now,
      ...messageOverrides,
    };

    const service = {
      messageRepository: {
        createMessage: jest.fn().mockImplementation(async (d: any) => ({ ...message, ...d })),
        findMessagesByConversationId: jest.fn().mockResolvedValue([message]),
        findDeletedMessagesByUser: jest.fn().mockResolvedValue([]),
        findMessageById: jest.fn().mockResolvedValue(message),
        updateMessage: jest.fn().mockImplementation(async (_id: string, d: any) => ({ ...message, ...d })),
        softDeleteMessage: jest.fn().mockResolvedValue(undefined),
        findLastMessageByConversation: jest.fn().mockResolvedValue(message),
      },
      socketGatewayService: {
        broadcastNewMessage: jest.fn().mockResolvedValue(undefined),
        broadcastMessageUpdate: jest.fn().mockResolvedValue(undefined),
        broadcastMessageDelete: jest.fn().mockResolvedValue(undefined),
      },
      conversationService: {
        hasDeletedByValues: jest.fn().mockResolvedValue(false),
        clearDeletedBy: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
      },
    } as any;

    service.findDeletedMessagesInConversationByUserId =
      MessagesService.prototype.findDeletedMessagesInConversationByUserId;
    service.findMessageEntityById = (MessagesService.prototype as any).findMessageEntityById;

    return service;
  };

  it('UT-108-01: Create message success with defaults.', async () => {
    const service = createService();

    const result = await MessagesService.prototype.create.call(service, {
      conversationId: ids.conversationId,
      senderId: ids.senderId,
      receiverId: ids.receiverId,
      content: 'hello',
    });

    expect(result.messageType).toBe(MessageType.TEXT);
    expect(result.isRead).toBe(false);
  });

  it('UT-108-02: Fetch conversation messages (no deleted marker).', async () => {
    const service = createService();

    const result = await MessagesService.prototype.findByConversation.call(service, ids.conversationId, ids.senderId);

    expect(result).toHaveLength(1);
    expect(service.messageRepository.findDeletedMessagesByUser).toHaveBeenCalled();
  });

  it('UT-108-03: Fetch conversation messages with deleted marker filter.', async () => {
    const oldDeleted = { createdAt: new Date('2024-01-01T00:00:00.000Z') };
    const service = createService({ createdAt: new Date('2024-01-01T01:00:00.000Z') });
    service.messageRepository.findDeletedMessagesByUser.mockResolvedValue([oldDeleted]);

    const result = await MessagesService.prototype.findByConversation.call(service, ids.conversationId, ids.senderId);

    expect(result).toHaveLength(1);
  });

  it('UT-108-04: Update message within 15-minute window.', async () => {
    const service = createService({ createdAt: new Date(Date.now() - 5 * 60 * 1000) });

    const result = await MessagesService.prototype.update.call(service, ids.messageId, { content: 'edited' });

    expect(result.content).toBe('edited');
  });

  it('UT-108-05: Mark message as read success.', async () => {
    const service = createService();

    const result = await MessagesService.prototype.markAsRead.call(service, ids.messageId);

    expect(result.isRead).toBe(true);
  });

  it('UT-108-06: Missing JWT.', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, MessagesController);

    expect(guards).toHaveLength(1);
  });

  it('UT-108-07: Create DTO validation fails.', async () => {
    const messages = await collectMessages({
      conversationId: ids.conversationId,
      senderId: ids.senderId,
      receiverId: ids.receiverId,
      content: '',
    });

    expect(messages.some((m) => m.includes('Message content is required') || m.includes('cannot be empty'))).toBe(true);
  });

  it('UT-108-08: Find message id not found.', async () => {
    const service = createService();
    service.messageRepository.findMessageById.mockResolvedValue(null);

    await expect(MessagesService.prototype.findOne.call(service, ids.messageId)).rejects.toThrow(NotFoundException);
  });

  it('UT-108-09: Update message older than 15 minutes.', async () => {
    const service = createService({ createdAt: new Date(Date.now() - 16 * 60 * 1000) });

    await expect(MessagesService.prototype.update.call(service, ids.messageId, { content: 'edited' })).rejects.toThrow(
      new BadRequestException('Message cannot be edited after 15 minutes'),
    );
  });

  it('UT-108-10: Delete message older than 15 minutes.', async () => {
    const service = createService({ createdAt: new Date(Date.now() - 16 * 60 * 1000) });

    await expect(MessagesService.prototype.delete.call(service, ids.messageId)).rejects.toThrow(
      new BadRequestException('Message cannot be deleted after 15 minutes'),
    );
  });

  it('UT-108-11: Invalid UUID fields in create payload.', async () => {
    const messages = await collectMessages({
      conversationId: 'bad',
      senderId: 'bad',
      receiverId: 'bad',
      content: 'ok',
    });

    expect(messages.some((m) => m.includes('must be a valid UUID'))).toBe(true);
  });

  it('UT-108-12: Invalid messageType enum.', async () => {
    const messages = await collectMessages({
      conversationId: ids.conversationId,
      senderId: ids.senderId,
      receiverId: ids.receiverId,
      content: 'ok',
      messageType: 'INVALID',
    } as any);

    expect(messages.some((m) => m.includes('Message type must be one of'))).toBe(true);
  });

  it('UT-108-13: Invalid boolean fields isRead/isUpdated.', async () => {
    const messages = await collectMessages({
      conversationId: ids.conversationId,
      senderId: ids.senderId,
      receiverId: ids.receiverId,
      content: 'ok',
      isRead: 'true',
      isUpdated: 'false',
    } as any);

    expect(messages).toContain('isRead must be a boolean value');
    expect(messages).toContain('isUpdated must be a boolean value');
  });

  it('UT-108-14: Socket/conversation side-effect errors are caught.', async () => {
    const service = createService();
    service.conversationService.update.mockRejectedValueOnce(new Error('conversation fail'));
    service.socketGatewayService.broadcastNewMessage.mockRejectedValueOnce(new Error('socket fail'));

    const result = await MessagesService.prototype.create.call(service, {
      conversationId: ids.conversationId,
      senderId: ids.senderId,
      receiverId: ids.receiverId,
      content: 'hello',
      messageType: MessageType.TEXT,
    });

    expect(result.content).toBe('hello');
  });

  it('UT-108-15: Content length exactly 1 accepted.', async () => {
    const messages = await collectMessages({
      conversationId: ids.conversationId,
      senderId: ids.senderId,
      receiverId: ids.receiverId,
      content: 'a',
    });

    expect(messages).toEqual([]);
  });

  it('UT-108-16: Content length exactly 2000 accepted.', async () => {
    const messages = await collectMessages({
      conversationId: ids.conversationId,
      senderId: ids.senderId,
      receiverId: ids.receiverId,
      content: 'x'.repeat(2000),
    });

    expect(messages).toEqual([]);
  });
});
