import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { SocketGatewayService } from './socket-gateway.service';
import { ClientModule } from '../client/client.module';
import { MessagesModule } from '../messages/messages.module';
import { ConversationModule } from '../conversations/conversation.module';
import { getJwtConfig } from '../../config/jwt.config';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: getJwtConfig,
      inject: [],
    }),
    ClientModule,
    MessagesModule,
    ConversationModule,
  ],
  controllers: [],
  providers: [SocketGatewayService],
  exports: [SocketGatewayService],
})
export class SocketGatewayModule { }
