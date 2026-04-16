import { BadRequestException, ConflictException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { AiRagChatBotController } from '../../../../src/modules/ai-rag-chat-bot/chat-bot.controller';
import { AiRagChatBotService } from '../../../../src/modules/ai-rag-chat-bot/chat-bot.service';
import { AiCreateAppointmentDto } from '../../../../src/modules/ai-rag-chat-bot/dto/ai-create-appointment.dto';
import { CreateAiConversationDto } from '../../../../src/modules/ai-rag-chat-bot/dto/create-conversation.dto';

describe('UC-109 Use AI Chatbot', () => {
  const ids = {
    userId: '123e4567-e89b-42d3-a456-426614174601',
    conversationId: '123e4567-e89b-42d3-a456-426614174602',
    clinicId: '123e4567-e89b-42d3-a456-426614174603',
    patientId: '123e4567-e89b-42d3-a456-426614174604',
    doctorId: '123e4567-e89b-42d3-a456-426614174605',
    shiftHourId: '123e4567-e89b-42d3-a456-426614174606',
    clinicServiceId: '123e4567-e89b-42d3-a456-426614174607',
  };

  const collectConversationMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(CreateAiConversationDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const collectAppointmentMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(AiCreateAppointmentDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const validAppointmentDto: AiCreateAppointmentDto = {
    patientId: ids.patientId,
    clinicId: ids.clinicId,
    doctorId: ids.doctorId,
    clinicShiftHourId: ids.shiftHourId,
    appointmentDate: '2026-12-20',
    appointmentHour: '2026-12-20T09:00:00.000Z',
    extraHour: '2026-12-20T09:30:00.000Z',
    services: [{ clinicServiceId: ids.clinicServiceId }],
    total: 100,
    patientNote: 'Need advice',
  };

  it('UT-109-01: Create AI conversation success and welcome message generated.', async () => {
    const service = {
      aiConversationRepository: {
        createConversation: jest.fn().mockResolvedValue({ _id: ids.conversationId }),
      },
      accountsService: {
        findOne: jest.fn().mockResolvedValue({ username: 'patientA', patientProfile: { fullName: 'Patient A' } }),
      },
      aiMessageRepository: {
        createMessage: jest.fn().mockResolvedValue(undefined),
      },
    } as any;

    const result = await AiRagChatBotService.prototype.createConversation.call(service, ids.userId, { title: 'hi' });

    expect(result._id).toBe(ids.conversationId);
    expect(service.aiMessageRepository.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: ids.conversationId, role: 'assistant' }),
    );
  });

  it('UT-109-02: Get conversation messages by conversationId+userId.', async () => {
    const controller = {
      aiRagChatBotService: {
        getMessagesByConversationIdAndUserId: jest.fn().mockResolvedValue([{ id: 'm1' }]),
      },
    } as any;

    const result = await AiRagChatBotController.prototype.getMessages.call(controller, ids.conversationId, ids.userId);

    expect(controller.aiRagChatBotService.getMessagesByConversationIdAndUserId).toHaveBeenCalledWith(ids.conversationId, ids.userId);
    expect(result).toHaveLength(1);
  });

  it('UT-109-03: Find clinic schedules with valid future date/range.', async () => {
    const service = {
      scheduleRepository: {
        findSchedulesPlain: jest.fn().mockResolvedValue([]),
      },
      mapSchedulesPlain: AiRagChatBotService.prototype['mapSchedulesPlain'],
    } as any;

    const result = await AiRagChatBotService.prototype.findClinicSchedules.call(service, ids.clinicId, {}, { from: '2099-01-01' });

    expect(Array.isArray(result)).toBe(true);
    expect(service.scheduleRepository.findSchedulesPlain).toHaveBeenCalled();
  });

  it('UT-109-04: Get clinic managers list success.', async () => {
    const controller = {
      aiRagChatBotService: {
        findAllClinicManagers: jest.fn().mockResolvedValue([{ accountId: 'm1' }]),
      },
    } as any;

    const result = await AiRagChatBotController.prototype.getClinicManagers.call(controller);

    expect(result).toHaveLength(1);
  });

  it('UT-109-05: Get clinic services by manager success.', async () => {
    const controller = {
      aiRagChatBotService: {
        getClinicServicesByManagerId: jest.fn().mockResolvedValue([{ id: 's1' }]),
      },
    } as any;

    const result = await AiRagChatBotController.prototype.getClinicServices.call(controller, ids.userId);

    expect(result).toHaveLength(1);
  });

  it('UT-109-06: AI create appointment success with valid service configs.', async () => {
    const transformed = { id: 'appt1' };
    const service = {
      appointmentRepository: { find: jest.fn().mockResolvedValue([]) },
      dataSource: {
        transaction: jest.fn().mockImplementation(async (cb: any) => {
          const manager = {
            createQueryBuilder: jest.fn().mockImplementation(() => {
              const qb = {
                select: jest.fn().mockReturnThis(),
                addSelect: jest.fn().mockReturnThis(),
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                innerJoin: jest.fn().mockReturnThis(),
                getRawMany: jest
                  .fn()
                  .mockResolvedValueOnce([{ id: ids.clinicServiceId, serviceid: ids.clinicServiceId, price: '100', discount: '0' }])
                  .mockResolvedValueOnce([{ id: 'svc1', serviceName: 'Service', description: 'desc', price: '100', discount: '0' }])
                  .mockResolvedValueOnce([]),
              };
              return qb;
            }),
            create: jest.fn().mockImplementation((_entity: any, d: any) => ({ _id: d.appointmentId || 'new', ...d })),
            save: jest
              .fn()
              .mockImplementation(async (_entity: any, d: any) => ({ _id: d._id || 'saved', ...d })),
            findOne: jest.fn().mockResolvedValue({ _id: 'appt1' }),
          } as any;
          return cb(manager);
        }),
      },
      transformToResponseDto: jest.fn().mockReturnValue(transformed),
    } as any;

    const result = await AiRagChatBotService.prototype.aiCreateAppointment.call(service, validAppointmentDto);

    expect(result).toBe(transformed);
  });

  it('UT-109-07: clinicId missing in schedule query.', async () => {
    const service = {} as any;

    await expect(AiRagChatBotService.prototype.findClinicSchedules.call(service, '', {}, {})).rejects.toThrow(
      new BadRequestException('Clinic ID is required'),
    );
  });

  it('UT-109-08: schedule date in past/today returns empty list branch.', async () => {
    const service = {} as any;

    const result = await AiRagChatBotService.prototype.findClinicSchedules.call(service, ids.clinicId, {}, { date: '2000-01-01' });

    expect(result).toEqual([]);
  });

  it('UT-109-09: Invalid DTO fields for create conversation.', async () => {
    const messages = await collectConversationMessages({
      title: 1,
      description: 2,
      participants: 'bad',
      metadata: 'bad',
    } as any);

    expect(messages.some((m) => m.includes('must be a string'))).toBe(true);
    expect(messages.some((m) => m.includes('must be an object'))).toBe(true);
  });

  it('UT-109-10: Invalid DTO fields for AI create appointment.', async () => {
    const messages = await collectAppointmentMessages({
      patientId: 'bad',
      clinicId: 'bad',
      doctorId: 'bad',
      clinicShiftHourId: 'bad',
      appointmentDate: 'bad',
      appointmentHour: 'bad',
      extraHour: 'bad',
      services: 'bad',
      total: 'bad',
      patientNote: 'x'.repeat(1001),
    } as any);

    expect(messages.some((m) => m.includes('Invalid patient ID format'))).toBe(true);
    expect(messages.some((m) => m.includes('Invalid clinic ID format'))).toBe(true);
    expect(messages.some((m) => m.includes('Services must be an array'))).toBe(true);
  });

  it('UT-109-11: Appointment time conflict.', async () => {
    const service = {
      appointmentRepository: { find: jest.fn().mockResolvedValue([{ _id: 'existing' }]) },
    } as any;

    await expect(AiRagChatBotService.prototype.aiCreateAppointment.call(service, validAppointmentDto)).rejects.toThrow(ConflictException);
  });

  it('UT-109-12: Service inactive/missing in clinic config.', async () => {
    const service = {
      appointmentRepository: { find: jest.fn().mockResolvedValue([]) },
      dataSource: {
        transaction: jest.fn().mockImplementation(async (cb: any) => {
          const manager = {
            createQueryBuilder: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              addSelect: jest.fn().mockReturnThis(),
              from: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getRawMany: jest.fn().mockResolvedValue([]),
            }),
          } as any;
          return cb(manager);
        }),
      },
    } as any;

    await expect(AiRagChatBotService.prototype.aiCreateAppointment.call(service, validAppointmentDto)).rejects.toThrow(
      'One or more services not found or inactive for this clinic',
    );
  });

  it('UT-109-13: Transaction save/runtime error.', async () => {
    const service = {
      appointmentRepository: { find: jest.fn().mockResolvedValue([]) },
      dataSource: {
        transaction: jest.fn().mockRejectedValue(new Error('tx failed')),
      },
    } as any;

    await expect(AiRagChatBotService.prototype.aiCreateAppointment.call(service, validAppointmentDto)).rejects.toThrow('tx failed');
  });

  it('UT-109-14: User profile lookup failure still creates conversation.', async () => {
    const service = {
      aiConversationRepository: {
        createConversation: jest.fn().mockResolvedValue({ _id: ids.conversationId }),
      },
      accountsService: {
        findOne: jest.fn().mockRejectedValue(new Error('profile fail')),
      },
      aiMessageRepository: {
        createMessage: jest.fn().mockResolvedValue(undefined),
      },
    } as any;

    const result = await AiRagChatBotService.prototype.createConversation.call(service, ids.userId, { title: 'hi' });

    expect(result._id).toBe(ids.conversationId);
    expect(service.aiMessageRepository.createMessage).toHaveBeenCalled();
  });

  it('UT-109-15: Controller endpoints do not enforce JWT guard.', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AiRagChatBotController);

    expect(guards).toBeUndefined();
  });

  it('UT-109-16: Invalid date query for managers-by-day repository branch.', async () => {
    const service = {
      dataSource: {
        query: jest.fn().mockResolvedValue([]),
      },
    } as any;

    const result = await AiRagChatBotService.prototype.findManagersByWorkDate.call(service, 'invalid-date');

    expect(result).toEqual([]);
  });

  it('UT-109-17: services array boundary with exactly 1 item accepted.', async () => {
    const messages = await collectAppointmentMessages({
      ...validAppointmentDto,
      services: [{ clinicServiceId: ids.clinicServiceId }],
      total: undefined,
    });

    expect(messages).toEqual([]);
  });

  it('UT-109-18: patientNote length exactly 1000 accepted.', async () => {
    const messages = await collectAppointmentMessages({
      ...validAppointmentDto,
      patientNote: 'x'.repeat(1000),
    });

    expect(messages).toEqual([]);
  });
});
