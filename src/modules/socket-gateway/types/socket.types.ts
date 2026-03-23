export interface SocketUser {
  userId: string;
  username: string;
  email: string;
  socketId: string;
}

export interface UserStatusUpdate {
  userId: string;
  status: 'online' | 'offline';
  username?: string;
}

export interface OnlineUsersEvent {
  users: SocketUser[];
}

export interface ErrorEvent {
  message: string;
  code: string;
}

// Client to Server Events
export interface ClientToServerEvents {
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
  sendMessage: (data: {
    conversationId: string;
    content: string;
    type?: string;
  }) => void;
  markAsRead: (data: { messageId: string; conversationId: string }) => void;
  markMultipleAsRead: (data: {
    messageIds: string[];
    conversationId: string;
  }) => void;
  markConversationAsRead: (data: { conversationId: string }) => void;
  updateMessage: (data: { messageId: string; content: string }) => void;
  deleteMessage: (data: { messageId: string; conversationId: string }) => void;
  deleteConversation: (conversationId: string) => void;
  startTyping: (conversationId: string) => void;
  stopTyping: (conversationId: string) => void;
  joinClinicRoom: (clinicManagerId: string) => void;
}

// Message and Conversation Event Types
export interface NewMessageEvent {
  message: {
    id: string;
    conversationId: string;
    senderId: string;
    receiverId: string;
    content: string;
    messageType: string;
    isRead: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  sender: {
    id: string;
    username: string;
    email: string;
  };
}

export interface ConversationUpdateEvent {
  conversationId: string;
  lastMessage: {
    id: string;
    content: string;
    senderId: string;
    messageType: string;
    createdAt: Date;
  };
  updatedAt: Date;
}

export interface MessageNotificationEvent {
  conversationId: string;
  messageId: string;
  senderId: string;
  receiverId: string;
  content: string;
  messageType: string;
  isRead: boolean;
  createdAt: Date;
}

// Server to Client Events
export interface ServerToClientEvents {
  userOnline: (data: UserStatusUpdate) => void;
  userOffline: (data: UserStatusUpdate) => void;
  onlineUsers: (data: OnlineUsersEvent) => void;
  userStatus: (data: UserStatusUpdate) => void;
  newMessage: (data: NewMessageEvent) => void;
  messageNotification: (data: MessageNotificationEvent) => void;
  newBlogNotification: (data: { message: string; blog: any }) => void;
  conversationUpdated: (data: ConversationUpdateEvent) => void;
  messageRead: (data: {
    messageId: string;
    conversationId: string;
    readBy: string;
    readAt: Date;
  }) => void;
  messagesRead: (data: {
    messageIds: string[];
    conversationId: string;
    readBy: string;
    readAt: Date;
    count: number;
  }) => void;
  conversationRead: (data: {
    conversationId: string;
    readBy: string;
    readAt: Date;
    messageCount: number;
  }) => void;
  messageUpdated: (data: any) => void;
  messageDeleted: (data: { messageId: string; conversationId: string }) => void;
  conversationDeleted: (data: {
    conversationId: string;
    deletedBy: string;
  }) => void;
  typingStart: (data: { userId: string; conversationId: string }) => void;
  typingStop: (data: { userId: string; conversationId: string }) => void;
  error: (data: ErrorEvent) => void;
  // Legacy events
  updateScheduleData: (data: { message: string; data: any }) => void;
  [key: `onNewMessageChat-${string}`]: (data: {
    message: string;
    data: any;
  }) => void;
  appointmentStatusChanged: (data: {
    appointmentId: string;
    status: string;
    message: string;
  }) => void;
}
