import { Test, TestingModule } from '@nestjs/testing';
import { SocketGatewayController } from './socket-gateway.controller';
import { SocketGatewayService } from './socket-gateway.service';

describe('SocketGatewayController', () => {
  let controller: SocketGatewayController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SocketGatewayController],
      providers: [SocketGatewayService],
    }).compile();

    controller = module.get<SocketGatewayController>(SocketGatewayController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
