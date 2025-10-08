import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SocketGatewayService } from './socket-gateway.service';
import { CreateSocketGatewayDto } from './dto/create-socket-gateway.dto';
import { UpdateSocketGatewayDto } from './dto/update-socket-gateway.dto';

@Controller('socket-gateway')
export class SocketGatewayController {
  constructor(private readonly socketGatewayService: SocketGatewayService) {}

  @Post()
  create(@Body() createSocketGatewayDto: CreateSocketGatewayDto) {
    return this.socketGatewayService.create(createSocketGatewayDto);
  }

  @Get()
  findAll() {
    return this.socketGatewayService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.socketGatewayService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSocketGatewayDto: UpdateSocketGatewayDto) {
    return this.socketGatewayService.update(+id, updateSocketGatewayDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.socketGatewayService.remove(+id);
  }
}
