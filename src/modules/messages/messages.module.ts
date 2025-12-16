import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { Message } from './entities/message.entity';
import { SocketGatewayModule } from '../socket-gateway/socket-gateway.module';
import { ConversationModule } from '../conversations/conversation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message]),
    forwardRef(() => SocketGatewayModule),
    forwardRef(() => ConversationModule),
  ],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule { }
