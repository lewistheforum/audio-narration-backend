import { Injectable } from '@nestjs/common';
import { CreateSocketGatewayDto } from './dto/create-socket-gateway.dto';
import { UpdateSocketGatewayDto } from './dto/update-socket-gateway.dto';

@Injectable()
export class SocketGatewayService {
  create(createSocketGatewayDto: CreateSocketGatewayDto) {
    return 'This action adds a new socketGateway';
  }

  findAll() {
    return `This action returns all socketGateway`;
  }

  findOne(id: number) {
    return `This action returns a #${id} socketGateway`;
  }

  update(id: number, updateSocketGatewayDto: UpdateSocketGatewayDto) {
    return `This action updates a #${id} socketGateway`;
  }

  remove(id: number) {
    return `This action removes a #${id} socketGateway`;
  }
}
