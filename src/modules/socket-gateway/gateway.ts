import { OnModuleInit } from '@nestjs/common';
import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: 'socket-gateway',
})
export class SocketGateway implements OnModuleInit {
  @WebSocketServer()
  server: Server;

  onModuleInit() {
    this.server.on('connection', (socket) => {
      console.log(socket.id);
      console.log('Socket Connected');
    });
  }

  @SubscribeMessage('updateSchedule')
  onUpdateSchedule(@MessageBody() body: any) {
    console.log(body);
    this.server.emit('updateScheduleData', {
      message: 'Schedule updated',
      data: body,
    });
  }

  @SubscribeMessage('newMessageChat')
  onNewMessageChat(@MessageBody() body: any) {
    console.log(body);
    this.server.emit(`onNewMessageChat-${body.conversationid}`, {
      message: 'New message received',
      data: body,
    });
  }
}
