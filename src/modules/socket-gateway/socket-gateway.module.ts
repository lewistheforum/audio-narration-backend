import { Module } from '@nestjs/common';
import { SocketGatewayService } from './socket-gateway.service';
import { SocketGatewayController } from './socket-gateway.controller';

@Module({
  controllers: [SocketGatewayController],
  providers: [SocketGatewayService],
})
export class SocketGatewayModule {}
