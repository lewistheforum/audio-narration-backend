import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiConversation } from './entities/ai-conversation.entity';
import { AiMessage } from './entities/ai-message.entity';
import { AiConversationRepository } from './repositories/ai-conversation.repository';
import { AiMessageRepository } from './repositories/ai-message.repository';
import { AiRagChatBotService } from './chat-bot.service';
import { AiRagChatBotController } from './chat-bot.controller';
import { AccountsModule } from '../accounts/accounts.module';
import { EmployeeScheduleRepository } from './repositories/employee-schedule.repository';
import { ClinicServicesModule } from '../clinic-services/clinic-services.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { AppointmentRepository } from '../appointments/repositories';

@Module({
  imports: [
    TypeOrmModule.forFeature([AiConversation, AiMessage]),
    AccountsModule,
    ClinicServicesModule,
    AppointmentsModule,
  ],
  controllers: [AiRagChatBotController],
  providers: [
    AiConversationRepository,
    AiMessageRepository,
    AiRagChatBotService,
    EmployeeScheduleRepository,
    AppointmentRepository,
  ],
  exports: [AiConversationRepository, AiMessageRepository],
})
export class ChatBotModule {}
