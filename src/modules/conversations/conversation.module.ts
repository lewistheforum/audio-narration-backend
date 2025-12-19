import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConversationService } from './conversation.service';
import { ConversationController } from './conversation.controller';
import { Conversation } from './entities/conversation.entity';
import { AccountsModule } from '../accounts/client.module';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation]),
    AccountsModule,
    forwardRef(() => MessagesModule),
  ],
  controllers: [ConversationController],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationModule { }
