import { Injectable, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getCurrentVietnamTime } from 'src/common/utils/date.util';
import { AccountsService } from '../accounts/accounts.service';
import { MessagesService } from '../messages/messages.service';
import { ConversationService } from '../conversations/conversation.service';
import {
  SocketUser,
  ClientToServerEvents,
  ServerToClientEvents,
  UserStatusUpdate,
  OnlineUsersEvent,
  ErrorEvent,
  NewMessageEvent,
  ConversationUpdateEvent,
  MessageNotificationEvent,
} from './types/socket.types';
import { verifyToken } from './utils/jwt.utils';
import { CreateMessageDto } from '../messages/dto/create-message.dto';
import { MessageType } from '../messages/enums';

@WebSocketGateway({
  cors: {
    origin:
      process.env.NODE_ENV === 'production'
        ? [
            process.env.FRONTEND_LANDING_URL,
            process.env.FRONTEND_STAFF_URL,
            process.env.FRONTEND_MANAGER_URL,
            process.env.FRONTEND_DASHBOARD_URL,
          ]
        : ['http://localhost:8000', 'http://localhost:3000'],
    credentials: true,
  },
  namespace: 'socket-gateway',
  pingTimeout: 60000,
  pingInterval: 25000,
})
@Injectable()
export class SocketGatewayService
  implements OnModuleInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server<ClientToServerEvents, ServerToClientEvents>;

  // User tracking maps
  private connectedUsers = new Map<string, SocketUser>(); // userId -> SocketUser
  private userSockets = new Map<string, string>(); // socketId -> userId

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => AccountsService))
    private readonly accountsService: AccountsService,
    private readonly messagesService: MessagesService,
    private readonly conversationService: ConversationService,
  ) {}

  onModuleInit() {
    console.log('Socket Gateway initialized');
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const user = client.data.user;
    if (user) {
      console.log(`User ${user.username} disconnected`);

      this.connectedUsers.delete(user.userId);
      this.userSockets.delete(client.id);

      client.broadcast.emit('userOffline', {
        userId: user.userId,
        username: user.username,
        status: 'offline',
      });
    }
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      // Extract and validate authentication token
      const token =
        client.handshake.auth.token ||
        client.handshake.auth.access_token ||
        client.handshake.query.token ||
        client.handshake.query.access_token;

      if (!token) {
        client.emit('error', {
          message: 'Authentication token required',
          code: 'AUTH_TOKEN_REQUIRED',
        });
        client.disconnect();
        return;
      }

      const decodedToken = verifyToken(token, this.jwtService);
      const user = await this.accountsService.findAccountEntityById(
        decodedToken.sub,
      );

      if (!user) {
        client.emit('error', {
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        });
        client.disconnect();
        return;
      }

      // Store user data in socket
      client.data.user = {
        userId: user._id,
        username: user.username || user.email,
        email: user.email,
      };

      console.log(
        `User ${client.data.user.username} connected with socket ${client.id}`,
      );

      const socketUser: SocketUser = {
        userId: user._id,
        username: user.username || user.email,
        email: user.email,
        socketId: client.id,
      };

      this.connectedUsers.set(user._id, socketUser);
      this.userSockets.set(client.id, user._id);

      // Send current online users to the newly connected socket
      client.emit('onlineUsers', {
        users: Array.from(this.connectedUsers.values()),
      });

      // Notify others that user is online
      client.broadcast.emit('userOnline', {
        userId: user._id,
        username: user.username || user.email,
        status: 'online',
      });
    } catch (error: any) {
      if (error?.status !== 404 && error?.name !== 'NotFoundException') {
        const message = error.message || error;
        if (message.includes('Invalid authentication token')) {
          console.warn('Socket connection warning:', message);
        } else {
          console.error('Connection error:', message);
        }
      }
      client.emit('error', {
        message: 'Invalid authentication token',
        code: 'INVALID_AUTH_TOKEN',
      });
      client.disconnect();
    }
  }

  // Conversation events
  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ): Promise<void> {
    try {
      // TODO: Validate user has access to this conversation
      client.join(`conversation:${conversationId}`);
      console.log(
        `User ${client.data.user.username} joined conversation ${conversationId}`,
      );
    } catch (error) {
      client.emit('error', {
        message: 'Error joining conversation',
        code: 'JOIN_CONVERSATION_ERROR',
      });
    }
  }

  @SubscribeMessage('leaveConversation')
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ): void {
    client.leave(`conversation:${conversationId}`);
    console.log(
      `User ${client.data.user.username} left conversation ${conversationId}`,
    );
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      conversationId: string;
      content: string;
      type?: string;
      receiverId: string;
    },
  ): Promise<void> {
    try {
      const createMessageDto: CreateMessageDto = {
        conversationId: data.conversationId,
        senderId: client.data.user.userId,
        receiverId: data.receiverId,
        content: data.content,
        messageType: (data.type as MessageType) || MessageType.TEXT,
        isRead: false,
      };

      // Legacy event for backward compatibility
      this.server.emit(`onNewMessageChat-${data.conversationId}`, {
        message: 'New message received',
        data: createMessageDto,
      });

      console.log(
        `Message sent in conversation ${data.conversationId} by ${client.data.user.username}`,
      );
    } catch (error) {
      console.error('Error sending message:', error);
      client.emit('error', {
        message: 'Error sending message',
        code: 'SEND_MESSAGE_ERROR',
      });
    }
  }

  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; conversationId: string },
  ): Promise<void> {
    try {
      // Mark the message as read in the database
      const updatedMessage = await this.messagesService.markAsRead(
        data.messageId,
      );

      // Emit to all users in the conversation room that the message has been read
      this.server
        .to(`conversation:${data.conversationId}`)
        .emit('messageRead', {
          messageId: data.messageId,
          conversationId: data.conversationId,
          readBy: client.data.user.userId,
          readAt: getCurrentVietnamTime(),
        });

      console.log(
        `Message ${data.messageId} marked as read by ${client.data.user.username} in conversation ${data.conversationId}`,
      );
    } catch (error) {
      console.error('Error marking message as read:', error);
      client.emit('error', {
        message: 'Error marking message as read',
        code: 'MARK_AS_READ_ERROR',
      });
    }
  }

  @SubscribeMessage('markMultipleAsRead')
  async handleMarkMultipleAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageIds: string[]; conversationId: string },
  ): Promise<void> {
    try {
      // Mark multiple messages as read in the database
      const updatedMessages = await this.messagesService.markMultipleAsRead(
        data.messageIds,
      );

      // Emit to all users in the conversation room that the messages have been read
      this.server
        .to(`conversation:${data.conversationId}`)
        .emit('messagesRead', {
          messageIds: data.messageIds,
          conversationId: data.conversationId,
          readBy: client.data.user.userId,
          readAt: getCurrentVietnamTime(),
          count: updatedMessages.length,
        });

      console.log(
        `${updatedMessages.length} messages marked as read by ${client.data.user.username} in conversation ${data.conversationId}`,
      );
    } catch (error) {
      console.error('Error marking messages as read:', error);
      client.emit('error', {
        message: 'Error marking messages as read',
        code: 'MARK_MULTIPLE_AS_READ_ERROR',
      });
    }
  }

  @SubscribeMessage('markConversationAsRead')
  async handleMarkConversationAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ): Promise<void> {
    try {
      // Mark all unread messages in the conversation as read
      const affectedCount = await this.messagesService.markConversationAsRead(
        data.conversationId,
        client.data.user.userId,
      );

      // Emit to all users in the conversation room that the conversation has been read
      this.server
        .to(`conversation:${data.conversationId}`)
        .emit('conversationRead', {
          conversationId: data.conversationId,
          readBy: client.data.user.userId,
          readAt: getCurrentVietnamTime(),
          messageCount: affectedCount,
        });

      console.log(
        `Conversation ${data.conversationId} marked as read by ${client.data.user.username} (${affectedCount} messages)`,
      );
    } catch (error) {
      console.error('Error marking conversation as read:', error);
      client.emit('error', {
        message: 'Error marking conversation as read',
        code: 'MARK_CONVERSATION_AS_READ_ERROR',
      });
    }
  }

  // Typing indicators
  @SubscribeMessage('startTyping')
  handleStartTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ): void {
    client.to(`conversation:${conversationId}`).emit('typingStart', {
      userId: client.data.user.userId,
      conversationId,
    });
  }

  @SubscribeMessage('stopTyping')
  handleStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ): void {
    client.to(`conversation:${conversationId}`).emit('typingStop', {
      userId: client.data.user.userId,
      conversationId,
    });
  }

  // Legacy events for backward compatibility
  @SubscribeMessage('updateSchedule')
  onUpdateSchedule(@MessageBody() body: any): void {
    console.log(body);
    (this.server as any).emit('updateScheduleData', {
      message: 'Schedule updated',
      data: body,
    });
  }

  @SubscribeMessage('newMessageChat')
  onNewMessageChat(@MessageBody() body: any): void {
    (this.server as any).emit(`onNewMessageChat-${body.conversationid}`, {
      message: 'New message received',
      data: body,
    });
  }

  @SubscribeMessage('joinClinicRoom')
  async handleJoinClinicRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() clinicManagerId: string,
  ): Promise<void> {
    try {
      // Allow user to join the clinic room based on the provided clinicManagerId
      client.join(`clinic-${clinicManagerId}`);
      console.log(
        `User ${client.data.user?.username} joined clinic room clinic-${clinicManagerId}`,
      );
    } catch (error) {
      client.emit('error', {
        message: 'Error joining clinic room',
        code: 'JOIN_CLINIC_ROOM_ERROR',
      });
    }
  }

  @SubscribeMessage('appointmentCreated')
  async handleAppointmentCreated(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      clinicManagerId: string;
      appointmentId: string;
      status: string;
      message: string;
    },
  ): Promise<void> {
    try {
      if (!payload?.clinicManagerId || !payload?.appointmentId) {
        client.emit('error', {
          message: 'Invalid appointmentCreated payload',
          code: 'APPOINTMENT_CREATED_INVALID',
        });
        return;
      }

      this.server
        .to(`clinic-${payload.clinicManagerId}`)
        .emit('appointmentStatusChanged', {
          appointmentId: payload.appointmentId,
          status: payload.status,
          message: payload.message,
        });

      console.log(
        `Broadcasted appointmentStatusChanged (created) to clinic-${payload.clinicManagerId} for appointment ${payload.appointmentId}`,
      );
    } catch (error) {
      console.error('Error handling appointmentCreated:', error);
      client.emit('error', {
        message: 'Error broadcasting appointment created event',
        code: 'APPOINTMENT_CREATED_ERROR',
      });
    }
  }

  public broadcastAppointmentStatusChange(
    clinicManagerId: string,
    payload: { appointmentId: string; status: string; message: string },
  ): void {
    try {
      this.server
        .to(`clinic-${clinicManagerId}`)
        .emit('appointmentStatusChanged', payload);
      console.log(
        `Broadcasted appointmentStatusChanged to clinic-${clinicManagerId} for appointment ${payload.appointmentId}`,
      );
    } catch (error) {
      console.error('Error broadcasting appointment status change:', error);
    }
  }

  // Public utility methods
  getConnectedUsers(): SocketUser[] {
    return Array.from(this.connectedUsers.values());
  }

  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  getUserSocket(userId: string): string | undefined {
    return this.connectedUsers.get(userId)?.socketId;
  }

  // Send notification to specific user
  sendNotificationToUser(userId: string, notification: ErrorEvent) {
    const user = this.connectedUsers.get(userId);
    if (user) {
      this.server.to(user.socketId).emit('error', notification);
    }
  }

  // Mark user online (called from auth service)
  public markUserOnline(userId: string): void {
    if (!userId) return;
    const user = this.connectedUsers.get(userId);
    if (user) {
      (this.server as any).emit('userStatus', {
        userId,
        username: user.username,
        status: 'online',
      });
    }
  }

  // Mark user offline (called from auth service)
  public markUserOffline(userId: string): void {
    if (!userId) return;
    const user = this.connectedUsers.get(userId);
    if (user) {
      (this.server as any).emit('userStatus', {
        userId,
        username: user.username,
        status: 'offline',
      });
    }
  }

  // Get current list of online users
  public getOnlineUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  // Utility method to broadcast new message to conversation participants
  public async broadcastNewMessage(
    conversationId: string,
    message: any,
    senderId: string,
  ): Promise<void> {
    try {
      // Get conversation details
      const conversation =
        await this.conversationService.findOne(conversationId);

      // Get sender information
      const sender = await this.accountsService.findAccountEntityById(senderId);

      // Prepare the new message event
      const newMessageEvent: NewMessageEvent = {
        message: {
          id: message._id,
          conversationId: message.conversationId,
          senderId: message.senderId,
          receiverId: message.receiverId,
          content: message.content,
          messageType: message.messageType,
          isRead: message.isRead,
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
        },
        sender: {
          id: sender._id,
          username: sender.username || sender.email,
          email: sender.email,
        },
      };

      // Prepare conversation update event
      const conversationUpdateEvent: ConversationUpdateEvent = {
        conversationId: conversationId,
        lastMessage: {
          id: message._id,
          content: message.content,
          senderId: message.senderId,
          messageType: message.messageType,
          createdAt: message.createdAt,
        },
        updatedAt: getCurrentVietnamTime(),
      };

      // Broadcast to all participants in the conversation room
      this.server
        .to(`conversation:${conversationId}`)
        .emit('newMessage', newMessageEvent);

      // Broadcast conversation update to all participants
      this.server
        .to(`conversation:${conversationId}`)
        .emit('conversationUpdated', conversationUpdateEvent);

      // Send notification to all conversation participants who are online
      for (const participant of conversation.participants) {
        if (participant.id !== senderId) {
          const participantSocket = this.getUserSocket(participant.id);
          if (participantSocket) {
            const messageNotificationEvent: MessageNotificationEvent = {
              conversationId: conversationId,
              messageId: message._id,
              senderId: message.senderId,
              receiverId: participant.id,
              content: message.content,
              messageType: message.messageType,
              isRead: message.isRead,
              createdAt: message.createdAt,
            };
            this.server
              .to(participantSocket)
              .emit('messageNotification', messageNotificationEvent);
          }
        }
      }

      console.log(`Broadcasted new message in conversation ${conversationId}`);
    } catch (error) {
      console.error('Error broadcasting new message:', error);
    }
  }

  // Utility method to broadcast conversation update
  public async broadcastConversationUpdate(
    conversationId: string,
    lastMessage: any,
  ): Promise<void> {
    try {
      const conversationUpdateEvent: ConversationUpdateEvent = {
        conversationId: conversationId,
        lastMessage: {
          id: lastMessage._id,
          content: lastMessage.content,
          senderId: lastMessage.senderId,
          messageType: lastMessage.messageType,
          createdAt: lastMessage.createdAt,
        },
        updatedAt: getCurrentVietnamTime(),
      };

      // Broadcast conversation update to all participants
      this.server
        .to(`conversation:${conversationId}`)
        .emit('conversationUpdated', conversationUpdateEvent);

      console.log(`Broadcasted conversation update for ${conversationId}`);
    } catch (error) {
      console.error('Error broadcasting conversation update:', error);
    }
  }

  // Utility method to broadcast message update
  public async broadcastMessageUpdate(
    conversationId: string,
    message: any,
  ): Promise<void> {
    try {
      const updateEvent = {
        messageId: message._id,
        conversationId: conversationId,
        content: message.content,
        updatedAt: message.updatedAt,
      };

      // Broadcast to all participants in the conversation room
      this.server
        .to(`conversation:${conversationId}`)
        .emit('messageUpdated', updateEvent);

      // Also broadcast conversation update to refresh the sidebar (last message content might have changed)
      const conversationUpdateEvent: ConversationUpdateEvent = {
        conversationId: conversationId,
        lastMessage: {
          id: message._id,
          content: message.content,
          senderId: message.senderId,
          messageType: message.messageType,
          createdAt: message.createdAt,
        },
        updatedAt: getCurrentVietnamTime(),
      };

      this.server
        .to(`conversation:${conversationId}`)
        .emit('conversationUpdated', conversationUpdateEvent);

      console.log(`Broadcasted message update in conversation ${conversationId}`);
    } catch (error) {
      console.error('Error broadcasting message update:', error);
    }
  }

  // Utility method to broadcast message deletion
  public async broadcastMessageDelete(
    conversationId: string,
    messageId: string,
    newLastMessage?: any,
  ): Promise<void> {
    try {
      // Broadcast to all participants in the conversation room
      this.server
        .to(`conversation:${conversationId}`)
        .emit('messageDeleted', {
          messageId,
          conversationId,
        });

      // If the deleted message was the latest, broadcast a conversation update with the new last message
      if (newLastMessage) {
        const conversationUpdateEvent: ConversationUpdateEvent = {
          conversationId: conversationId,
          lastMessage: {
            id: newLastMessage._id,
            content: newLastMessage.content,
            senderId: newLastMessage.senderId,
            messageType: newLastMessage.messageType,
            createdAt: newLastMessage.createdAt,
          },
          updatedAt: getCurrentVietnamTime(),
        };

        this.server
          .to(`conversation:${conversationId}`)
          .emit('conversationUpdated', conversationUpdateEvent);
      } else if (newLastMessage === null) {
        // Conversation has no messages left
        this.server
          .to(`conversation:${conversationId}`)
          .emit('conversationUpdated', {
            conversationId,
            lastMessage: null,
            updatedAt: getCurrentVietnamTime(),
          } as any);
      }

      console.log(
        `Broadcasted message deletion in conversation ${conversationId}`,
      );
    } catch (error) {
      console.error('Error broadcasting message deletion:', error);
    }
  }

  // Utility method to send notification to specific user
  public async sendMessageNotification(
    userId: string,
    conversationId: string,
    message: any,
  ): Promise<void> {
    try {
      const userSocket = this.getUserSocket(userId);
      if (userSocket) {
        const messageNotificationEvent: MessageNotificationEvent = {
          conversationId: conversationId,
          messageId: message._id,
          senderId: message.senderId,
          receiverId: userId,
          content: message.content,
          messageType: message.messageType,
          isRead: message.isRead,
          createdAt: message.createdAt,
        };

        this.server
          .to(userSocket)
          .emit('messageNotification', messageNotificationEvent);
        console.log(`Sent message notification to user ${userId}`);
      }
    } catch (error) {
      console.error('Error sending message notification:', error);
    }
  }

  // Utility method to get conversation participants
  public async getConversationParticipants(
    conversationId: string,
  ): Promise<string[]> {
    try {
      const conversation =
        await this.conversationService.findOne(conversationId);
      return conversation.participants.map((participant) => participant.id);
    } catch (error) {
      console.error('Error getting conversation participants:', error);
      return [];
    }
  }

  // Utility method to check if user is in conversation room
  public isUserInConversation(userId: string, conversationId: string): boolean {
    const userSocket = this.getUserSocket(userId);
    if (!userSocket) return false;

    const socket = this.server.sockets.sockets.get(userSocket);
    return socket ? socket.rooms.has(`conversation:${conversationId}`) : false;
  }
}
