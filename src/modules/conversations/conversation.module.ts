import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConversationService } from './conversation.service';
import { ConversationController } from './conversation.controller';
import { Conversation } from './entities/conversation.entity';
import { ConversationRepository } from './repositories';
import { AccountsModule } from '../accounts/accounts.module';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation]),
    forwardRef(() => AccountsModule),
    forwardRef(() => MessagesModule),
  ],
  controllers: [ConversationController],
  providers: [ConversationService, ConversationRepository],
  exports: [ConversationService],
})
export class ConversationModule { }
