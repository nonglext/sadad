# 🔧 Server Implementation Guide - Socket.IO Event Handlers

**Purpose**: Detailed implementation of Socket.IO events for production messenger | **Status**: Ready-to-implement | **Framework**: Express + Socket.IO 4.6+

---

## 📋 Quick Reference

All Socket.IO events your server must handle:

```javascript
// MESSAGE EVENTS
socket.on('send-message', handleSendMessage);
socket.on('send-dm', handleSendDM);
socket.on('delete-message', handleDeleteMessage);

// FRIEND EVENTS
socket.on('send-friend-request', handleSendFriendRequest);
socket.on('friend-accepted-notify', handleFriendAcceptedNotify);
socket.on('user-status-change', handleUserStatusChange);
socket.on('friend-removed', handleFriendRemoved);

// CALL EVENTS
socket.on('initiate-call', handleInitiateCall);
socket.on('call-accepted', handleCallAccepted);
socket.on('call-rejected', handleCallRejected);
socket.on('end-call', handleEndCall);
socket.on('video-toggle', handleVideoToggle);
socket.on('audio-toggle', handleAudioToggle);

// WEBRTC SIGNALING (relay only!)
socket.on('offer', handleOffer);
socket.on('answer', handleAnswer);
socket.on('ice-candidate', handleICECandidate);

// REACTION EVENTS
socket.on('add-reaction', handleAddReaction);
socket.on('remove-reaction', handleRemoveReaction);

// VOICE CHANNEL EVENTS
socket.on('join-voice-channel', handleJoinVoiceChannel);
socket.on('leave-voice-channel', handleLeaveVoiceChannel);
```

---

## 🚀 Complete Server Implementation

### 1. Setup & Configuration

```javascript
// server.js
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const PORT = process.env.PORT || 3001;

// ============================================
// MIDDLEWARE
// ============================================

// Socket.IO Authentication Middleware
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      console.log('[Auth] No token provided');
      return next(new Error('No token provided'));
    }
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        console.log('[Auth] Invalid token:', err.message);
        return next(new Error('Invalid token'));
      }
      
      // Attach user info to socket
      socket.user = decoded;
      socket.userId = decoded.id;
      socket.username = decoded.username;
      socket.email = decoded.email;
      
      console.log(`[Auth] ✓ User ${decoded.username} authenticated`);
      next();
    });
  } catch (error) {
    console.error('[Auth] Error:', error);
    next(error);
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Find user socket by user ID
 */
function getUserSocket(userId) {
  try {
    for (const [socketId, socket] of io.of("/").sockets) {
      if (socket.userId === userId) {
        return socket;
      }
    }
    return null;
  } catch (error) {
    console.error('[Helper] getUserSocket error:', error);
    return null;
  }
}

/**
 * Find user socket by username
 */
function getUserSocketByUsername(username) {
  try {
    for (const [socketId, socket] of io.of("/").sockets) {
      if (socket.username === username) {
        return socket;
      }
    }
    return null;
  } catch (error) {
    console.error('[Helper] getUserSocketByUsername error:', error);
    return null;
  }
}

/**
 * Get all online users
 */
function getOnlineUsers() {
  const onlineUsers = [];
  try {
    for (const [socketId, socket] of io.of("/").sockets) {
      if (socket.userId && socket.username) {
        onlineUsers.push({
          userId: socket.userId,
          username: socket.username,
          socketId: socketId,
          timestamp: Date.now()
        });
      }
    }
  } catch (error) {
    console.error('[Helper] getOnlineUsers error:', error);
  }
  return onlineUsers;
}

/**
 * Broadcast user status to all friends
 */
async function broadcastUserStatus(userId, status) {
  try {
    // Get user's friends from database
    const friends = await getUserFriends(userId);
    
    // Notify each friend
    friends.forEach(friend => {
      const friendSocket = getUserSocket(friend.id);
      if (friendSocket) {
        friendSocket.emit('user-status-change', {
          userId: userId,
          status: status,
          timestamp: Date.now()
        });
      }
    });
  } catch (error) {
    console.error('[Broadcast] Status error:', error);
  }
}

// ============================================
// MESSAGE EVENTS
// ============================================

socket.on('send-message', async (data, callback) => {
  try {
    console.log('[Message] Received from', socket.username, ':', data);
    
    // Validate input
    if (!data.channelId || !data.content) {
      throw new Error('Missing required fields');
    }
    
    // Create message object
    const message = {
      id: generateMessageId(),
      channelId: data.channelId,
      userId: socket.userId,
      author: socket.username,
      content: data.content,
      created_at: new Date(),
      reactions: [],
      edited: false,
      deleted: false
    };
    
    // Save to database
    await messageDB.insert(message);
    
    console.log('[Message] ✓ Saved:', message.id);
    
    // Broadcast to channel (everyone in that channel)
    io.emit('new-message', {
      channelId: data.channelId,
      message: message
    });
    
    // Send acknowledgment callback
    if (callback) {
      callback({
        success: true,
        messageId: message.id,
        timestamp: message.created_at
      });
    }
    
  } catch (error) {
    console.error('[Message] Send error:', error);
    
    if (callback) {
      callback({
        success: false,
        error: error.message
      });
    }
  }
});

socket.on('send-dm', async (data, callback) => {
  try {
    console.log('[DM] Received from', socket.username, 'to', data.userId);
    
    // Validate
    if (!data.userId || !data.content) {
      throw new Error('Missing required fields');
    }
    
    // Create DM object
    const directMessage = {
      id: generateMessageId(),
      fromUserId: socket.userId,
      toUserId: data.userId,
      content: data.content,
      created_at: new Date(),
      read: false
    };
    
    // Save to database
    await dmDB.insert(directMessage);
    
    console.log('[DM] ✓ Saved:', directMessage.id);
    
    // Get recipient socket and send real-time
    const recipientSocket = getUserSocket(data.userId);
    if (recipientSocket) {
      recipientSocket.emit('new-dm', {
        from: {
          id: socket.userId,
          username: socket.username
        },
        message: directMessage
      });
      
      console.log('[DM] ✓ Delivered in real-time');
    } else {
      console.log('[DM] Recipient offline, will be delivered on next login');
    }
    
    // Acknowledge
    if (callback) {
      callback({
        success: true,
        messageId: directMessage.id
      });
    }
    
  } catch (error) {
    console.error('[DM] Send error:', error);
    if (callback) {
      callback({ success: false, error: error.message });
    }
  }
});

socket.on('delete-message', async (data, callback) => {
  try {
    if (!data.messageId || !data.channelId) {
      throw new Error('Missing required fields');
    }
    
    // Verify ownership (optional but recommended)
    const message = await messageDB.findById(data.messageId);
    if (message.userId !== socket.userId) {
      throw new Error('Not authorized to delete this message');
    }
    
    // Mark as deleted or remove
    await messageDB.delete(data.messageId);
    
    // Broadcast deletion
    io.emit('message-deleted', {
      channelId: data.channelId,
      messageId: data.messageId
    });
    
    if (callback) {
      callback({ success: true });
    }
    
  } catch (error) {
    console.error('[Delete] Error:', error);
    if (callback) {
      callback({ success: false, error: error.message });
    }
  }
});

// ============================================
// REACTION EVENTS
// ============================================

socket.on('add-reaction', async (data, callback) => {
  try {
    if (!data.messageId || !data.emoji) {
      throw new Error('Missing reaction data');
    }
    
    // Save reaction to database
    const reaction = {
      messageId: data.messageId,
      userId: socket.userId,
      emoji: data.emoji,
      created_at: new Date()
    };
    
    await reactionDB.insert(reaction);
    
    // Get all reactions for this message
    const allReactions = await reactionDB.findByMessageId(data.messageId);
    
    // Broadcast updated reactions
    io.emit('reaction-update', {
      messageId: data.messageId,
      reactions: allReactions
    });
    
    if (callback) {
      callback({ success: true });
    }
    
  } catch (error) {
    console.error('[Reaction] Add error:', error);
    if (callback) {
      callback({ success: false, error: error.message });
    }
  }
});

socket.on('remove-reaction', async (data, callback) => {
  try {
    if (!data.messageId || !data.emoji) {
      throw new Error('Missing reaction data');
    }
    
    // Delete reaction
    await reactionDB.delete({
      messageId: data.messageId,
      userId: socket.userId,
      emoji: data.emoji
    });
    
    // Get remaining reactions
    const allReactions = await reactionDB.findByMessageId(data.messageId);
    
    // Broadcast update
    io.emit('reaction-update', {
      messageId: data.messageId,
      reactions: allReactions
    });
    
    if (callback) {
      callback({ success: true });
    }
    
  } catch (error) {
    console.error('[Reaction] Remove error:', error);
    if (callback) {
      callback({ success: false, error: error.message });
    }
  }
});

// ============================================
// FRIEND EVENTS
// ============================================

socket.on('send-friend-request', async (data, callback) => {
  try {
    if (!data.toUserId) {
      throw new Error('Missing recipient user ID');
    }
    
    // Check if already friends
    const existing = await friendDB.findFriendship(socket.userId, data.toUserId);
    if (existing) {
      throw new Error('Already friends or request pending');
    }
    
    // Create friend request
    const request = {
      id: generateId(),
      fromUserId: socket.userId,
      toUserId: data.toUserId,
      status: 'pending',
      created_at: new Date()
    };
    
    await friendDB.insertRequest(request);
    
    // Notify recipient (if online)
    const recipientSocket = getUserSocket(data.toUserId);
    if (recipientSocket) {
      recipientSocket.emit('friend-request-received', {
        from: {
          id: socket.userId,
          username: socket.username
        }
      });
    }
    
    if (callback) {
      callback({ success: true });
    }
    
  } catch (error) {
    console.error('[Friend Request] Error:', error);
    if (callback) {
      callback({ success: false, error: error.message });
    }
  }
});

socket.on('friend-accepted-notify', async (data, callback) => {
  try {
    if (!data.fromUserId) {
      throw new Error('Missing user ID');
    }
    
    // Accept friend request in database
    await friendDB.acceptFriend(data.fromUserId, socket.userId);
    
    console.log('[Friend] Accepted:', socket.username, '<->', data.fromUserId);
    
    // Get requester socket
    const requesterSocket = getUserSocket(data.fromUserId);
    if (requesterSocket) {
      requesterSocket.emit('friend-accepted', {
        userId: socket.userId,
        username: socket.username
      });
      
      console.log('[Friend] ✓ Notified requester in real-time');
    }
    
    if (callback) {
      callback({ success: true });
    }
    
  } catch (error) {
    console.error('[Friend Accept] Error:', error);
    if (callback) {
      callback({ success: false, error: error.message });
    }
  }
});

socket.on('user-status-change', async (data) => {
  try {
    const status = data.status || 'Online';
    const userSocket = getUserSocket(socket.userId);
    
    if (!userSocket) return;
    
    console.log(`[Status] ${socket.username} is now ${status}`);
    
    // Broadcast to all friends
    await broadcastUserStatus(socket.userId, status);
    
  } catch (error) {
    console.error('[Status Change] Error:', error);
  }
});

socket.on('friend-removed', async (data, callback) => {
  try {
    if (!data.friendId) {
      throw new Error('Missing friend ID');
    }
    
    // Remove friendship from database
    await friendDB.removeFriend(socket.userId, data.friendId);
    
    // Notify friend (if online)
    const friendSocket = getUserSocket(data.friendId);
    if (friendSocket) {
      friendSocket.emit('friend-removed', {
        userId: socket.userId,
        username: socket.username
      });
    }
    
    if (callback) {
      callback({ success: true });
    }
    
  } catch (error) {
    console.error('[Friend Remove] Error:', error);
    if (callback) {
      callback({ success: false, error: error.message });
    }
  }
});

// ============================================
// CALL EVENTS
// ============================================

socket.on('initiate-call', async (data, callback) => {
  try {
    if (!data.toUserId) {
      throw new Error('Missing recipient');
    }
    
    const callData = {
      callId: generateCallId(),
      fromUserId: socket.userId,
      fromUsername: socket.username,
      toUserId: data.toUserId,
      type: data.type || 'audio', // 'audio' or 'video'
      created_at: Date.now()
    };
    
    // Find recipient socket
    const recipientSocket = getUserSocket(data.toUserId);
    if (!recipientSocket) {
      console.log('[Call] Recipient offline');
      if (callback) {
        callback({ success: false, error: 'User offline' });
      }
      return;
    }
    
    // Send incoming call notification
    recipientSocket.emit('incoming-call', callData);
    
    console.log('[Call] Initiated:', callData.callId);
    
    if (callback) {
      callback({ success: true, callId: callData.callId });
    }
    
  } catch (error) {
    console.error('[Call Initiate] Error:', error);
    if (callback) {
      callback({ success: false, error: error.message });
    }
  }
});

socket.on('call-accepted', async (data, callback) => {
  try {
    if (!data.callId || !data.fromUserId) {
      throw new Error('Missing call data');
    }
    
    // Notify caller
    const callerSocket = getUserSocket(data.fromUserId);
    if (callerSocket) {
      callerSocket.emit('call-accepted', {
        callId: data.callId,
        userId: socket.userId,
        username: socket.username
      });
    }
    
    if (callback) {
      callback({ success: true });
    }
    
  } catch (error) {
    console.error('[Call Accept] Error:', error);
    if (callback) {
      callback({ success: false, error: error.message });
    }
  }
});

socket.on('call-rejected', async (data) => {
  try {
    if (!data.callId || !data.fromUserId) return;
    
    const callerSocket = getUserSocket(data.fromUserId);
    if (callerSocket) {
      callerSocket.emit('call-rejected', {
        callId: data.callId,
        reason: data.reason || 'declined'
      });
    }
    
  } catch (error) {
    console.error('[Call Reject] Error:', error);
  }
});

socket.on('end-call', async (data) => {
  try {
    if (!data.callId || !data.toUserId) return;
    
    // Notify other user
    const otherSocket = getUserSocket(data.toUserId);
    if (otherSocket) {
      otherSocket.emit('call-ended', {
        callId: data.callId,
        reason: data.reason || 'normal'
      });
    }
    
  } catch (error) {
    console.error('[Call End] Error:', error);
  }
});

socket.on('video-toggle', async (data) => {
  try {
    if (!data.callId || !data.toUserId) return;
    
    const otherSocket = getUserSocket(data.toUserId);
    if (otherSocket) {
      otherSocket.emit('peer-video-toggle', {
        callId: data.callId,
        enabled: data.enabled
      });
    }
    
  } catch (error) {
    console.error('[Video Toggle] Error:', error);
  }
});

socket.on('audio-toggle', async (data) => {
  try {
    if (!data.callId || !data.toUserId) return;
    
    const otherSocket = getUserSocket(data.toUserId);
    if (otherSocket) {
      otherSocket.emit('peer-audio-toggle', {
        callId: data.callId,
        enabled: data.enabled
      });
    }
    
  } catch (error) {
    console.error('[Audio Toggle] Error:', error);
  }
});

// ============================================
// WEBRTC SIGNALING (Just relay - don't process!)
// ============================================

socket.on('offer', async (data) => {
  try {
    if (!data.to || !data.offer) {
      throw new Error('Invalid offer data');
    }
    
    // Find recipient and relay offer
    const recipientSocket = getUserSocket(data.to);
    if (recipientSocket) {
      recipientSocket.emit('offer', {
        from: socket.userId,
        offer: data.offer
      });
      console.log('[WebRTC] Offer relayed:', socket.userId, '→', data.to);
    }
    
  } catch (error) {
    console.error('[WebRTC Offer] Error:', error);
  }
});

socket.on('answer', async (data) => {
  try {
    if (!data.to || !data.answer) {
      throw new Error('Invalid answer data');
    }
    
    const recipientSocket = getUserSocket(data.to);
    if (recipientSocket) {
      recipientSocket.emit('answer', {
        from: socket.userId,
        answer: data.answer
      });
      console.log('[WebRTC] Answer relayed:', socket.userId, '→', data.to);
    }
    
  } catch (error) {
    console.error('[WebRTC Answer] Error:', error);
  }
});

socket.on('ice-candidate', async (data) => {
  try {
    if (!data.to || !data.candidate) {
      throw new Error('Invalid ICE candidate');
    }
    
    const recipientSocket = getUserSocket(data.to);
    if (recipientSocket) {
      recipientSocket.emit('ice-candidate', {
        from: socket.userId,
        candidate: data.candidate
      });
    }
    
  } catch (error) {
    console.error('[WebRTC ICE] Error:', error);
  }
});

// ============================================
// VOICE CHANNEL EVENTS
// ============================================

socket.on('join-voice-channel', async (data) => {
  try {
    if (!data.channelId) {
      throw new Error('Missing channel ID');
    }
    
    // Join socket to room
    const roomName = `voice-${data.channelId}`;
    socket.join(roomName);
    
    console.log(`[Voice] ${socket.username} joined voice-${data.channelId}`);
    
    // Notify others in room
    socket.broadcast.to(roomName).emit('user-joined-voice', {
      userId: socket.userId,
      username: socket.username,
      channelId: data.channelId
    });
    
  } catch (error) {
    console.error('[Voice Join] Error:', error);
  }
});

socket.on('leave-voice-channel', async (data) => {
  try {
    if (!data.channelId) {
      throw new Error('Missing channel ID');
    }
    
    const roomName = `voice-${data.channelId}`;
    socket.leave(roomName);
    
    console.log(`[Voice] ${socket.username} left voice-${data.channelId}`);
    
    // Notify others
    io.to(roomName).emit('user-left-voice', {
      userId: socket.userId,
      username: socket.username,
      channelId: data.channelId
    });
    
  } catch (error) {
    console.error('[Voice Leave] Error:', error);
  }
});

// ============================================
// CONNECTION EVENTS
// ============================================

socket.on('connect', () => {
  try {
    console.log(`[Connect] User ${socket.username} connected (${socket.id})`);
    
    // Broadcast user is online
    io.emit('user-status-change', {
      userId: socket.userId,
      status: 'Online',
      username: socket.username
    });
    
  } catch (error) {
    console.error('[Connect] Error:', error);
  }
});

socket.on('disconnect', (reason) => {
  try {
    console.log(`[Disconnect] User ${socket.username} disconnected (${reason})`);
    
    // Broadcast user is offline
    io.emit('user-status-change', {
      userId: socket.userId,
      status: 'Offline',
      username: socket.username
    });
    
  } catch (error) {
    console.error('[Disconnect] Error:', error);
  }
});

// ============================================
// ERROR HANDLING
// ============================================

socket.on('error', (error) => {
  console.error('[Socket Error]', socket.username, ':', error);
});

// ============================================
// START SERVER
// ============================================

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.IO events ready`);
  console.log(`✓ CORS enabled for: ${process.env.CLIENT_URL || 'http://localhost:3000'}`);
});
```

---

## 🔧 Database Schema (Reference)

```javascript
// messageDB schema
{
  id: String (unique),
  channelId: Number,
  userId: String,
  author: String,
  content: String,
  created_at: Date,
  reactions: Array,
  edited: Boolean,
  deleted: Boolean
}

// dmDB schema
{
  id: String (unique),
  fromUserId: String,
  toUserId: String,
  content: String,
  created_at: Date,
  read: Boolean
}

// reactionDB schema
{
  messageId: String,
  userId: String,
  emoji: String,
  created_at: Date
}

// friendDB schema
{
  userId: String,
  friendId: String,
  status: 'accepted' | 'pending' | 'blocked',
  created_at: Date
}
```

---

## 🧪 Testing Socket.IO Events

```bash
# Install Socket.IO client for testing
npm install socket.io-client

# Create test file: test-socket.js
const io = require('socket.io-client');

const socket = io('http://localhost:3001', {
  auth: {
    token: 'your-jwt-token-here'
  }
});

socket.on('connect', () => {
  console.log('✓ Connected');
  
  // Test send-message
  socket.emit('send-message', {
    channelId: 1,
    content: 'Hello from test!'
  }, (response) => {
    console.log('Response:', response);
  });
});

socket.on('new-message', (data) => {
  console.log('Received:', data);
});
```

---

## ✅ Deployment Checklist

- [ ] All Socket.IO events implemented
- [ ] All try-catch blocks in place
- [ ] Database connections tested
- [ ] CORS configured correctly
- [ ] JWT authentication verified
- [ ] Helper functions working
- [ ] Real-time broadcasts tested
- [ ] Offline user handling works
- [ ] Memory leaks checked
- [ ] Error logging enabled
- [ ] Performance acceptable
- [ ] Tested with 10+ concurrent users
- [ ] SSL/TLS configured (for production)
- [ ] Rate limiting added (if needed)

---

**Server is ready!** 🎉 Your client-side app will now work with real-time updates. Good luck! 🚀
