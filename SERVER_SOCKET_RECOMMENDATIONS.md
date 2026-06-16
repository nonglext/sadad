# Socket.IO Events - Server Recommendations

## 📋 Overview
Этот документ содержит рекомендации для структуры Socket.IO событий в `server.js` для синхронизации с обновленным клиентом.

---

## 🔌 Socket.IO Setup

```javascript
// Убедитесь, что Socket.IO правильно инициализирован
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 1e6, // 1MB для файлов
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
});
```

---

## ✅ MESSAGE EVENTS

### 1. **send-message** (Client → Server)
```javascript
socket.on('send-message', async (data) => {
  try {
    const { channelId, message } = data;
    
    // Валидация
    if (!channelId || !message.text) {
      socket.emit('error', { code: 'INVALID_MESSAGE' });
      return;
    }

    // Сохранить в БД
    const dbMessage = await messageDB.create({
      channelId,
      userId: socket.user.id,
      username: socket.user.username,
      avatar: socket.user.avatar,
      content: message.text,
      created_at: new Date(),
      reactions: []
    });

    // Broadcast всем в канале
    io.to(`channel-${channelId}`).emit('new-message', {
      channelId,
      message: {
        id: dbMessage.id,
        author: socket.user.username,
        avatar: socket.user.avatar,
        text: message.text,
        timestamp: dbMessage.created_at,
        reactions: []
      }
    });
  } catch (error) {
    console.error('Send message error:', error);
    socket.emit('error', { code: 'MESSAGE_ERROR', message: error.message });
  }
});
```

### 2. **send-dm** (Client → Server)
```javascript
socket.on('send-dm', async (data) => {
  try {
    const { receiverId, message } = data;
    
    if (!receiverId || !message.text) {
      socket.emit('error', { code: 'INVALID_DM' });
      return;
    }

    // Сохранить DM в БД
    const dbDM = await dmDB.create({
      senderId: socket.user.id,
      receiverId,
      content: message.text,
      created_at: new Date()
    });

    // Отправить отправителю подтверждение
    socket.emit('dm-sent', {
      receiverId,
      message: {
        id: dbDM.id,
        author: socket.user.username,
        avatar: socket.user.avatar,
        text: message.text,
        timestamp: dbDM.created_at
      }
    });

    // Отправить получателю
    const receiverSocket = io.sockets.sockets.get(/* найти сокет получателя */);
    if (receiverSocket) {
      receiverSocket.emit('new-dm', {
        senderId: socket.user.id,
        message: {
          id: dbDM.id,
          author: socket.user.username,
          avatar: socket.user.avatar,
          text: message.text,
          timestamp: dbDM.created_at
        }
      });
    }
  } catch (error) {
    console.error('Send DM error:', error);
    socket.emit('error', { code: 'DM_ERROR' });
  }
});
```

### 3. **add-reaction** (Client → Server)
```javascript
socket.on('add-reaction', async (data) => {
  try {
    const { messageId, emoji } = data;
    
    const reaction = await reactionDB.add(messageId, socket.user.id, emoji);
    
    // Получить все реакции для этого сообщения
    const reactions = await reactionDB.getByMessageId(messageId);
    
    // Broadcast обновление реакций
    io.emit('reaction-update', {
      messageId,
      reactions: reactions.map(r => ({
        emoji: r.emoji,
        count: r.count,
        users: r.usernames.join(', ')
      }))
    });
  } catch (error) {
    console.error('Add reaction error:', error);
  }
});
```

### 4. **remove-reaction** (Client → Server)
```javascript
socket.on('remove-reaction', async (data) => {
  try {
    const { messageId, emoji } = data;
    
    await reactionDB.remove(messageId, socket.user.id, emoji);
    
    // Получить обновленные реакции
    const reactions = await reactionDB.getByMessageId(messageId);
    
    // Broadcast обновление
    io.emit('reaction-update', {
      messageId,
      reactions: reactions.map(r => ({
        emoji: r.emoji,
        count: r.count,
        users: r.usernames.join(', ')
      }))
    });
  } catch (error) {
    console.error('Remove reaction error:', error);
  }
});
```

---

## 👥 FRIEND EVENTS

### 1. **send-friend-request** (Client → Server)
```javascript
socket.on('send-friend-request', async (data) => {
  try {
    const { to: friendId } = data;
    
    // Сохранить запрос в БД
    await friendDB.sendRequest(socket.user.id, friendId);
    
    // Отправить уведомление другу
    const friendSocket = io.sockets.sockets.get(/* найти сокет друга */);
    if (friendSocket) {
      friendSocket.emit('new-friend-request', {
        from: {
          id: socket.user.id,
          username: socket.user.username,
          avatar: socket.user.avatar
        }
      });
    }
  } catch (error) {
    console.error('Friend request error:', error);
  }
});
```

### 2. **friend-accepted-notify** (Client → Server - Real-time update)
```javascript
socket.on('friend-accepted-notify', async (data) => {
  try {
    const { to: friendId } = data;
    
    // Notify the other friend
    const friendSocket = io.sockets.sockets.get(/* найти сокет */);
    if (friendSocket) {
      friendSocket.emit('friend-accepted', {
        from: {
          id: socket.user.id,
          username: socket.user.username,
          avatar: socket.user.avatar
        }
      });
    }
  } catch (error) {
    console.error('Friend accepted notify error:', error);
  }
});
```

### 3. **user-status-change** (Server → Client - Broadcast)
```javascript
// Когда пользователь подключается
socket.on('connect', () => {
  // Broadcast что пользователь онлайн
  io.emit('user-status-change', {
    userId: socket.user.id,
    username: socket.user.username,
    status: 'Online',
    timestamp: new Date()
  });
});

// Когда пользователь отключается
socket.on('disconnect', (reason) => {
  // Broadcast что пользователь офлайн
  io.emit('user-status-change', {
    userId: socket.user.id,
    username: socket.user.username,
    status: 'Offline',
    timestamp: new Date()
  });
});
```

---

## 🎤 VOICE/VIDEO CALL EVENTS

### 1. **initiate-call** (Client → Server)
```javascript
socket.on('initiate-call', async (data) => {
  try {
    const { to: recipientId, type, from } = data;
    
    // Отправить уведомление получателю
    const recipientSocket = io.sockets.sockets.get(/* найти сокет */);
    if (recipientSocket) {
      recipientSocket.emit('incoming-call', {
        from: {
          id: from.id,
          username: from.username,
          avatar: from.avatar || from.username.charAt(0).toUpperCase(),
          socketId: socket.id
        },
        type // 'audio' или 'video'
      });
    }
  } catch (error) {
    console.error('Initiate call error:', error);
  }
});
```

### 2. **accept-call** (Client → Server)
```javascript
socket.on('accept-call', (data) => {
  try {
    const { to: callerId, from } = data;
    
    // Notify caller
    const callerSocket = io.sockets.sockets.get(/* найти сокет */);
    if (callerSocket) {
      callerSocket.emit('call-accepted', {
        from: {
          id: from.id,
          username: from.username,
          avatar: from.avatar,
          socketId: socket.id
        }
      });
    }
  } catch (error) {
    console.error('Accept call error:', error);
  }
});
```

### 3. **reject-call** (Client → Server)
```javascript
socket.on('reject-call', (data) => {
  try {
    const { to: callerId } = data;
    
    const callerSocket = io.sockets.sockets.get(/* найти сокет */);
    if (callerSocket) {
      callerSocket.emit('call-rejected', {
        from: { socketId: socket.id }
      });
    }
  } catch (error) {
    console.error('Reject call error:', error);
  }
});
```

### 4. **WebRTC Signaling** (Server acts as relay)
```javascript
// Offer/Answer/ICE Candidate relay
socket.on('offer', (data) => {
  const { to, offer } = data;
  const targetSocket = io.sockets.sockets.get(/* найти сокет */);
  if (targetSocket) {
    targetSocket.emit('offer', {
      from: socket.id,
      offer
    });
  }
});

socket.on('answer', (data) => {
  const { to, answer } = data;
  const targetSocket = io.sockets.sockets.get(/* найти сокет */);
  if (targetSocket) {
    targetSocket.emit('answer', {
      from: socket.id,
      answer
    });
  }
});

socket.on('ice-candidate', (data) => {
  const { to, candidate } = data;
  const targetSocket = io.sockets.sockets.get(/* найти сокет */);
  if (targetSocket) {
    targetSocket.emit('ice-candidate', {
      from: socket.id,
      candidate
    });
  }
});
```

### 5. **end-call** (Client → Server)
```javascript
socket.on('end-call', (data) => {
  try {
    const { to } = data;
    
    const targetSocket = io.sockets.sockets.get(/* найти сокет */);
    if (targetSocket) {
      targetSocket.emit('call-ended', {
        from: socket.id
      });
    }
  } catch (error) {
    console.error('End call error:', error);
  }
});
```

### 6. **video-toggle** (Client → Server)
```javascript
socket.on('video-toggle', (data) => {
  const { to, enabled } = data;
  
  const targetSocket = io.sockets.sockets.get(/* найти сокет */);
  if (targetSocket) {
    targetSocket.emit('video-toggle', {
      from: socket.id,
      enabled
    });
  }
});
```

---

## 🔊 VOICE CHANNEL EVENTS

### 1. **join-voice-channel** (Client → Server)
```javascript
socket.on('join-voice-channel', async (data) => {
  try {
    const { channelName, channelId, userId } = data;
    
    // Join socket.io room
    socket.join(`voice-${channelId}`);
    
    // Get existing users in channel
    const room = io.sockets.adapter.rooms.get(`voice-${channelId}`);
    const existingUsers = Array.from(room || [])
      .filter(id => id !== socket.id)
      .map(id => ({
        socketId: id,
        username: /* get from user data */
      }));
    
    // Send existing users to new joiner
    socket.emit('existing-voice-users', existingUsers);
    
    // Notify others that someone joined
    socket.broadcast.to(`voice-${channelId}`).emit('user-joined-voice', {
      socketId: socket.id,
      username: socket.user.username,
      userId: socket.user.id
    });
  } catch (error) {
    console.error('Join voice channel error:', error);
  }
});
```

### 2. **leave-voice-channel** (Client → Server)
```javascript
socket.on('leave-voice-channel', (data) => {
  try {
    const { channelName } = data;
    
    socket.broadcast.to(`voice-${channelName}`).emit('user-left-voice', socket.id);
    socket.leave(`voice-${channelName}`);
  } catch (error) {
    console.error('Leave voice channel error:', error);
  }
});
```

---

## 🔐 AUTHENTICATION & MIDDLEWARE

```javascript
// Authentication middleware
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('No token provided'));
    }
    
    // Verify JWT
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        return next(new Error('Invalid token'));
      }
      
      socket.user = decoded;
      socket.userId = decoded.id;
      socket.username = decoded.username;
      next();
    });
  } catch (error) {
    next(error);
  }
});

// Connection handler
io.on('connection', (socket) => {
  console.log(`[Socket] User connected: ${socket.user.username} (${socket.id})`);
  
  // Join user-specific room for direct notifications
  socket.join(`user-${socket.userId}`);
  
  // Handle disconnect
  socket.on('disconnect', (reason) => {
    console.log(`[Socket] User disconnected: ${socket.username} (${reason})`);
    
    // Cleanup peer connections
    // Remove from all voice channels
    const rooms = Array.from(socket.rooms);
    rooms.forEach(room => {
      if (room.startsWith('voice-')) {
        socket.broadcast.to(room).emit('user-left-voice', socket.id);
      }
    });
  });
});
```

---

## 🛠️ HELPER FUNCTIONS FOR FINDING SOCKETS

```javascript
/**
 * Find user socket by user ID
 */
function getUserSocket(userId) {
  for (const [socketId, socket] of io.of("/").sockets) {
    if (socket.userId === userId) {
      return socket;
    }
  }
  return null;
}

/**
 * Find user socket by username
 */
function getUserSocketByUsername(username) {
  for (const [socketId, socket] of io.of("/").sockets) {
    if (socket.username === username) {
      return socket;
    }
  }
  return null;
}

/**
 * Get all online users
 */
function getOnlineUsers() {
  const onlineUsers = [];
  for (const [socketId, socket] of io.of("/").sockets) {
    if (socket.userId && socket.username) {
      onlineUsers.push({
        userId: socket.userId,
        username: socket.username,
        socketId: socketId
      });
    }
  }
  return onlineUsers;
}
```

---

## ⚠️ ERROR HANDLING BEST PRACTICES

```javascript
// Всегда оборачивайте события в try-catch
socket.on('any-event', async (data) => {
  try {
    // Your code here
  } catch (error) {
    console.error('[Socket Event] Error:', error);
    socket.emit('error', {
      code: 'EVENT_ERROR',
      message: error.message,
      event: 'any-event'
    });
  }
});

// Validate all incoming data
function validateMessage(message) {
  if (!message || typeof message !== 'object') {
    throw new Error('Invalid message object');
  }
  
  if (!message.text || typeof message.text !== 'string') {
    throw new Error('Message text is required and must be string');
  }
  
  if (message.text.trim().length === 0) {
    throw new Error('Message text cannot be empty');
  }
  
  if (message.text.length > 2000) {
    throw new Error('Message text is too long (max 2000 chars)');
  }
  
  return true;
}
```

---

## 📊 EVENT SUMMARY TABLE

| Event | Direction | Purpose |
|-------|-----------|---------|
| `new-message` | Server → Client | Broadcast новое сообщение |
| `send-message` | Client → Server | Отправить сообщение |
| `send-dm` | Client → Server | Отправить DM |
| `new-dm` | Server → Client | Уведомить о новом DM |
| `dm-sent` | Server → Client | Подтверждение отправки DM |
| `add-reaction` | Client → Server | Добавить реакцию |
| `reaction-update` | Server → Client | Broadcast обновления реакций |
| `friend-accepted` | Server → Client | Друзья добавлены (Real-time) |
| `new-friend-request` | Server → Client | Новый запрос дружбы |
| `user-status-change` | Server → Client | Статус пользователя изменился |
| `incoming-call` | Server → Client | Входящий вызов |
| `call-accepted` | Server → Client | Вызов принят |
| `call-rejected` | Server → Client | Вызов отклонен |
| `call-ended` | Server → Client | Вызов окончен |
| `offer` | Relay | WebRTC offer relay |
| `answer` | Relay | WebRTC answer relay |
| `ice-candidate` | Relay | ICE candidate relay |
| `join-voice-channel` | Client → Server | Присоединиться к голосовому каналу |
| `leave-voice-channel` | Client → Server | Покинуть голосовой канал |

---

## 🎯 TESTING CHECKLIST

- [ ] Все события имеют обработку ошибок (try-catch)
- [ ] Все события валидируют входящие данные
- [ ] Socket.IO подключение переподключается при разрыве
- [ ] Real-time обновления работают без задержек
- [ ] WebRTC сигнализация работает через сервер
- [ ] Пользователи офлайн/онлайн статус обновляется
- [ ] Сообщения сохраняются в БД перед broadcast
- [ ] Реакции обновляются в real-time для всех
- [ ] Голосовые каналы правильно управляют комнатами
- [ ] Отключение пользователя очищает его сокеты

---

## 📝 Notes

1. Все события должны быть идемпотентными (безопасны для повторения)
2. Используйте `socket.broadcast` для отправки всем кроме отправителя
3. Используйте `io.to(room)` для отправки конкретной комнате
4. Используйте `socket.emit` для отправки только отправителю
5. Всегда проверяйте наличие сокета перед отправкой
6. Логируйте все критические события для дебага
7. Используйте комнаты (rooms) для группировки пользователей
8. Установите таймауты для долгоживущих операций
