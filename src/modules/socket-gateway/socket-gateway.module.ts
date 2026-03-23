import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SocketGatewayService } from './socket-gateway.service';
import { AccountsModule } from '../accounts/accounts.module';
import { MessagesModule } from '../messages/messages.module';
import { ConversationModule } from '../conversations/conversation.module';
import { getJwtConfig } from '../../config/jwt.config';
import { AppointmentsModule } from '../appointments/appointments.module';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: getJwtConfig,
      inject: [ConfigService],
    }),
    forwardRef(() => AccountsModule),
    forwardRef(() => MessagesModule),
    forwardRef(() => ConversationModule),
    forwardRef(() => AppointmentsModule),
  ],
  controllers: [],
  providers: [SocketGatewayService],
  exports: [SocketGatewayService],
})
export class SocketGatewayModule {}
