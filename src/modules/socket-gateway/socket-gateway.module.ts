import { Module } from '@nestjs/common';
import { SocketGatewayService } from './socket-gateway.service';
import { SocketGatewayController } from './socket-gateway.controller';
import { SocketGateway } from './gateway';

@Module({
  controllers: [SocketGatewayController],
  providers: [SocketGatewayService, SocketGateway],
})
export class SocketGatewayModule {}
