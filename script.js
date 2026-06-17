/**
 * ====================================================================
 * DISCORD-LIKE MESSENGER - PRODUCTION-READY REFACTORED VERSION
 * ====================================================================
 * 
 * Architecture Overview:
 * - Centralized appState object (no globals)
 * - Error handling on all network operations
 * - Race condition prevention
 * - Real-time updates without full page reload
 * - Loading states for async operations
 * - Discord-style CSS animations
 * 
 * @author Senior Frontend Developer
 * @version 2.0
 */

/**
 * ====================================================================
 * CENTRALIZED APPLICATION STATE
 * ====================================================================
 */
const appState = {
  // Authentication
  user: null,
  token: null,

  // UI State
  view: 'friends', // 'friends', 'dm', 'server', 'group'
  
  // Navigation
  currentServerId: null,
  currentChannelId: null,
  currentDMUserId: null,
  currentGroupId: null,
  currentChannelName: null,

  // Data (Dynamic - no hardcoded channels)
  servers: [],
  channels: {}, // { [channelId]: { id, name, messages: [] } }
  friends: [],
  pendingRequests: [],
  groupChats: [], // [{ id, name, icon, members: [], createdBy, createdAt }]
  messages: [], // Current view messages

  // Call State
  inCall: false,
  callDetails: null, // { peerId, type: 'audio'|'video', isInitiator }
  
  // Media
  localStream: null,
  screenStream: null,
  peerConnections: {}, // { [peerId]: RTCPeerConnection }
  
  // Media Flags
  isVideoEnabled: true,
  isAudioEnabled: true,
  isMuted: false,
  isDeafened: false,

  // Socket
  socket: null,
  socketConnected: false,

  // Loading States
  isLoading: {
    friends: false,
    messages: false,
    servers: false,
    pendingRequests: false,
    groupChats: false,
  },

  // Event Emitters for internal communication
  listeners: {
    'state-change': [],
    'message-added': [],
    'friend-status-updated': [],
    'call-ended': [],
  },

  // ---- PROFILE SYSTEM ----
  // Badge Registry — централизованное описание всех бейджей
  BADGE_REGISTRY: {
    'nitro':        { id: 'nitro',        name: 'Nitro',          icon: 'nitro',        path: 'src/assets/badges/nitro.svg',        description: 'Discord Nitro Subscriber' },
    'nitro-classic':{ id: 'nitro-classic',name: 'Nitro Classic',   icon: 'nitro-classic',path: 'src/assets/badges/nitro-classic.svg', description: 'Nitro Classic' },
    'booster':      { id: 'booster',      name: 'Server Booster',  icon: 'booster',      path: 'src/assets/badges/booster.svg',      description: 'Server Boosting' },
    'developer':    { id: 'developer',    name: 'Developer',       icon: 'developer',    path: 'src/assets/badges/developer.svg',    description: 'Active Developer' },
    'moderator':    { id: 'moderator',    name: 'Moderator',       icon: 'moderator',    path: 'src/assets/badges/moderator.svg',    description: 'Discord Moderator' },
    'verified':     { id: 'verified',     name: 'Verified',        icon: 'verified',     path: 'src/assets/badges/verified.svg',     description: 'Verified User' },
    'early':        { id: 'early',        name: 'Early Supporter', icon: 'early',        path: 'src/assets/badges/early.svg',        description: 'Early Supporter' },
  },
  // User's earned badges — по умолчанию каждому новый пользователь получает Nitro
  userBadges: [{ badgeId: 'nitro', earnedAt: new Date().toISOString() }],

  // Avatar decoration
  avatarDecoration: null, // { type, color, url }

  // Nameplate style
  nameplate: { style: 'default', color: null },

  // Profile banner
  profileBanner: null, // URL string

  // Profile theme
  profileTheme: {
    primaryColor: '#5865f2',
    accentColor: '#3ba55d',
  },

  // Profile Widgets
  profileWidgets: [], // [{ id, type: 'game', title, description, icon, url }]
  
  // Group DM state
  groupCreation: {
    selectedFriends: [], // Array of friend IDs
    groupName: '',
  },

  /**
   * Subscribe to internal events
   */
  subscribe(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  },

  /**
   * Emit internal events
   */
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  },

  /**
   * Update state safely
   */
  update(updates) {
    Object.assign(this, updates);
    this.emit('state-change', this);
  }
};

// Global socket reference
let socket = null;

/**
 * ====================================================================
 * ERROR HANDLING UTILITIES
 * ====================================================================
 */

class AppError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    console.error(`[AppError] ${code}: ${message}`, details);
  }
}

/**
 * Safe fetch with error handling
 */
async function fetchWithError(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${appState.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new AppError(
        error.error || `HTTP ${response.status}`,
        `HTTP_${response.status}`,
        error
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      `Network error: ${error.message}`,
      'NETWORK_ERROR',
      error
    );
  }
}

/**
 * Safe socket emit with error handling
 */
function socketEmitSafe(event, data, callback = null) {
  if (!appState.socket || !appState.socketConnected) {
    console.warn(`[Socket] Not connected. Cannot emit ${event}`);
    return false;
  }

  try {
    if (callback) {
      appState.socket.emit(event, data, callback);
    } else {
      appState.socket.emit(event, data);
    }
    return true;
  } catch (error) {
    console.error(`[Socket] Error emitting ${event}:`, error);
    return false;
  }
}

/**
 * ====================================================================
 * INITIALIZATION
 * ====================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  try {
    appState.token = localStorage.getItem('token');
    const userStr = localStorage.getItem('currentUser');
    
    if (!appState.token || !userStr) {
      window.location.replace('login.html');
      return;
    }
    
    try {
      appState.user = JSON.parse(userStr);
    } catch (e) {
      throw new AppError('Invalid user data in storage', 'INVALID_USER_DATA', e);
    }

    initializeApp();
  } catch (error) {
    console.error('Initialization failed:', error);
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    window.location.replace('login.html');
  }
});

/**
 * Dynamically load a client-side module script.
 * @param {string} src - Script filename
 * @returns {Promise<void>}
 */
function loadModule(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load module: ${src}`));
    document.body.appendChild(script);
  });
}

/**
 * Initialize application
 */
async function initializeApp() {
  try {
    await loadModule('settings.js');
    SettingsModule.init({ appState, fetchWithError, updateUserInfo });

    // 1. Update UI with user info
    updateUserInfo();

    // 2. Initialize UI listeners BEFORE socket connection (prevent race conditions)
    initializeFriendsTabs();
    initializeChannels();
    initializeMessageInput();
    initializeUserControls();
    initializeCallControls();
    initializeServerManagement();
    initializeFileUpload();
    initializeEmojiPicker();
    initializeDraggableCallWindow();

    // 3. Request notifications
    requestNotificationPermission();

    // 4. Connect to Socket.IO (LAST - ready to handle all events)
    await connectToSocketIO();

    await loadModule('typing.js');
    TypingModule.init({ appState, socketEmitSafe });

    await loadModule('contextMenu.js');
    ContextMenuModule.init();

    await loadModule('profile.js');
    ProfileModule.init({ appState, fetchWithError, socketEmitSafe });

    // 5. Load data from server
    await loadUserServers();
    await loadFriends();

    // 6. Show initial view
    showFriendsView();

    console.log('[App] Initialization complete');
  } catch (error) {
    console.error('[App] Initialization error:', error);
    alert('Failed to initialize app. Please refresh.');
  }
}

/**
 * ====================================================================
 * SOCKET.IO CONNECTION WITH PROPER EVENT HANDLING
 * ====================================================================
 */

async function connectToSocketIO() {
  return new Promise((resolve, reject) => {
    if (typeof io === 'undefined') {
      reject(new AppError('Socket.IO not loaded', 'SOCKET_IO_NOT_LOADED'));
      return;
    }

    try {
      socket = io({
        auth: { token: appState.token },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      });

      appState.socket = socket;

      // Connection events
      socket.on('connect', () => {
        console.log('[Socket] Connected:', socket.id);
        appState.update({ socketConnected: true });
        resolve();
      });

      socket.on('connect_error', (error) => {
        console.error('[Socket] Connection error:', error);
        appState.update({ socketConnected: false });
      });

      socket.on('disconnect', (reason) => {
        console.warn('[Socket] Disconnected:', reason);
        appState.update({ socketConnected: false });
      });

      // ===== MESSAGE EVENTS (with error handling) =====
      socket.on('new-message', (data) => {
        try {
          handleNewMessage(data);
        } catch (error) {
          console.error('[Socket] Error handling new-message:', error);
        }
      });

      socket.on('message-deleted', (data) => {
        try {
          handleMessageDeleted(data);
        } catch (error) {
          console.error('[Socket] Error handling message-deleted:', error);
        }
      });

      // ===== REACTION EVENTS =====
      socket.on('reaction-update', (data) => {
        try {
          updateMessageReactions(data.messageId, data.reactions);
        } catch (error) {
          console.error('[Socket] Error handling reaction-update:', error);
        }
      });

      // ===== FRIEND EVENTS (Real-time) =====
      socket.on('friend-accepted', () => {
        try {
          handleFriendAccepted();
        } catch (error) {
          console.error('[Socket] Error handling friend-accepted:', error);
        }
      });

      socket.on('new-friend-request', () => {
        try {
          handleNewFriendRequest();
        } catch (error) {
          console.error('[Socket] Error handling new-friend-request:', error);
        }
      });

      socket.on('user-status-change', (data) => {
        try {
          handleUserStatusChange(data);
        } catch (error) {
          console.error('[Socket] Error handling user-status-change:', error);
        }
      });

      socket.on('friend-removed', (data) => {
        try {
          handleFriendRemoved(data);
        } catch (error) {
          console.error('[Socket] Error handling friend-removed:', error);
        }
      });

      // ===== DM EVENTS =====
      socket.on('new-dm', (data) => {
        try {
          handleNewDM(data);
        } catch (error) {
          console.error('[Socket] Error handling new-dm:', error);
        }
      });

      socket.on('dm-sent', (data) => {
        try {
          handleDMSent(data);
        } catch (error) {
          console.error('[Socket] Error handling dm-sent:', error);
        }
      });

      // ===== WEBRTC SIGNALING =====
      socket.on('user-joined-voice', (data) => {
        try {
          if (appState.inCall) {
            createPeerConnection(data.socketId, true);
          }
        } catch (error) {
          console.error('[Socket] Error handling user-joined-voice:', error);
        }
      });

      socket.on('existing-voice-users', (users) => {
        try {
          if (appState.inCall) {
            users.forEach(user => createPeerConnection(user.socketId, false));
          }
        } catch (error) {
          console.error('[Socket] Error handling existing-voice-users:', error);
        }
      });

      socket.on('user-left-voice', (socketId) => {
        try {
          handleUserLeftVoice(socketId);
        } catch (error) {
          console.error('[Socket] Error handling user-left-voice:', error);
        }
      });

      socket.on('offer', async (data) => {
        try {
          await handleWebRTCOffer(data);
        } catch (error) {
          console.error('[Socket] Error handling offer:', error);
        }
      });

      socket.on('answer', async (data) => {
        try {
          await handleWebRTCAnswer(data);
        } catch (error) {
          console.error('[Socket] Error handling answer:', error);
        }
      });

      socket.on('ice-candidate', async (data) => {
        try {
          await handleICECandidate(data);
        } catch (error) {
          console.error('[Socket] Error handling ice-candidate:', error);
        }
      });

      socket.on('video-toggle', (data) => {
        try {
          handleVideoToggle(data);
        } catch (error) {
          console.error('[Socket] Error handling video-toggle:', error);
        }
      });

      // ===== CALL EVENTS =====
      socket.on('incoming-call', (data) => {
        try {
          if (data && data.from) {
            showIncomingCall(data.from, data.type);
          }
        } catch (error) {
          console.error('[Socket] Error handling incoming-call:', error);
        }
      });

      socket.on('call-accepted', (data) => {
        try {
          handleCallAccepted(data);
        } catch (error) {
          console.error('[Socket] Error handling call-accepted:', error);
        }
      });

      socket.on('call-rejected', (data) => {
        try {
          handleCallRejected(data);
        } catch (error) {
          console.error('[Socket] Error handling call-rejected:', error);
        }
      });

      socket.on('call-ended', (data) => {
        try {
          handleCallEnded(data);
        } catch (error) {
          console.error('[Socket] Error handling call-ended:', error);
        }
      });

      // Set a timeout to ensure connection is attempted
      setTimeout(() => {
        if (!appState.socketConnected) {
          reject(new AppError('Socket connection timeout', 'SOCKET_TIMEOUT'));
        }
      }, 5000);

    } catch (error) {
      reject(new AppError('Socket.IO initialization failed', 'SOCKET_INIT_FAILED', error));
    }
  });
}

/**
 * ====================================================================
 * MESSAGE HANDLING FUNCTIONS
 * ====================================================================
 */

/**
 * Normalizes message objects from socket, API, or DM into a unified shape.
 * Socket: { author, text, avatar, timestamp }
 * API:    { username, content, avatar, created_at }
 * @param {Object} raw - Raw message payload
 * @returns {Object} Normalized message
 */
function normalizeMessage(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      id: Date.now(),
      author: 'Unknown',
      avatar: '?',
      text: '',
      timestamp: new Date().toISOString(),
      reactions: [],
    };
  }

  const author = raw.author || raw.username || raw.sender_name || 'Unknown';
  const text = raw.text ?? raw.content ?? '';

  return {
    id: raw.id ?? Date.now(),
    author,
    avatar: raw.avatar || author.charAt(0).toUpperCase(),
    text,
    timestamp: raw.timestamp || raw.created_at || new Date().toISOString(),
    reactions: raw.reactions || [],
  };
}

/**
 * Parses new-message socket payload (nested or flat structure).
 * @param {Object} data - Socket event data
 * @returns {{ channelId: string|number, message: Object }}
 */
function parseNewMessagePayload(data) {
  const channelId = data.channelId ?? data.channel_id;
  const rawMessage = data.message ?? data;
  return { channelId, message: normalizeMessage(rawMessage) };
}

/**
 * Handle incoming message with optimized rendering (no full re-render)
 */
function handleNewMessage(data) {
  try {
    const { channelId, message } = parseNewMessagePayload(data);
    if (!channelId) return;

    const isCurrentChannel =
      appState.view === 'server' &&
      String(appState.currentChannelId) === String(channelId);

    if (isCurrentChannel) {
      appState.update({ messages: [...appState.messages, message] });
      addMessageToUI(message);
      scrollToBottom();

      if (document.hidden && message.author !== appState.user?.username) {
        const preview = message.text.length > 50
          ? `${message.text.substring(0, 50)}...`
          : message.text;
        showNotification('New Message', `${message.author}: ${preview}`);
      }
    }

    appState.emit('message-added', { channelId, message });
  } catch (error) {
    console.error('[Message Handler] Error:', error);
  }
}

function handleMessageDeleted(data) {
  try {
    const messageEl = document.querySelector(`[data-message-id="${data.messageId}"]`);
    if (messageEl) {
      messageEl.remove();
    }
  } catch (error) {
    console.error('[Delete Handler] Error:', error);
  }
}

/**
 * ====================================================================
 * FRIEND & STATUS HANDLING (Real-time Updates)
 * ====================================================================
 */

async function handleFriendAccepted() {
  try {
    console.log('[Friend] Friend accepted in real-time');
    await loadFriends();
    await loadPendingRequests();
    
    // Update DM list if in friends view
    if (appState.currentView === 'friends' || appState.currentView === 'dm') {
      populateDMList(appState.friends);
    }
    
    showNotification('Friend Added', 'A new friend has been added to your list!');
    appState.emit('friend-status-updated', { action: 'accepted' });
  } catch (error) {
    console.error('[Friend Handler] Error accepting friend:', error);
  }
}

async function handleNewFriendRequest() {
  try {
    console.log('[Friend] New friend request received');
    await loadPendingRequests();
    showNotification('New Friend Request', 'You have a new friend request!');
    appState.emit('friend-status-updated', { action: 'request-received' });
  } catch (error) {
    console.error('[Friend Handler] Error on new request:', error);
  }
}

function handleUserStatusChange(data) {
  try {
    // Update friend status in UI without full reload
    const friendEl = document.querySelector(`[data-friend-id="${data.userId}"]`);
    if (friendEl) {
      const statusEl = friendEl.querySelector('.friend-status');
      if (statusEl) {
        statusEl.textContent = data.status;
        statusEl.classList.toggle('offline', data.status !== 'Online');
      }
    }
    appState.emit('friend-status-updated', { userId: data.userId, status: data.status });
  } catch (error) {
    console.error('[Status Handler] Error:', error);
  }
}

async function handleFriendRemoved(data) {
  try {
    console.log('[Friend] Friend removed');
    await loadFriends();
    appState.emit('friend-status-updated', { action: 'removed', userId: data.friendId });
  } catch (error) {
    console.error('[Friend Handler] Error removing friend:', error);
  }
}

/**
 * ====================================================================
 * DM HANDLING
 * ====================================================================
 */

function handleNewDM(data) {
  try {
    if (data.senderId === appState.currentDMUserId && appState.view === 'dm') {
      addMessageToUI({
        id: data.message.id,
        author: data.message.author,
        avatar: data.message.avatar,
        text: data.message.text,
        timestamp: data.message.timestamp
      });
      scrollToBottom();
    }
  } catch (error) {
    console.error('[DM Handler] Error on new DM:', error);
  }
}

function handleDMSent(data) {
  try {
    if (data.receiverId === appState.currentDMUserId && appState.view === 'dm') {
      addMessageToUI({
        id: data.message.id,
        author: appState.user.username,
        avatar: appState.user.avatar,
        text: data.message.text,
        timestamp: data.message.timestamp
      });
      scrollToBottom();
    }
  } catch (error) {
    console.error('[DM Handler] Error on DM sent:', error);
  }
}

/**
 * ====================================================================
 * WebRTC SIGNALING
 * ====================================================================
 */

async function handleWebRTCOffer(data) {
  if (!appState.peerConnections[data.from]) {
    createPeerConnection(data.from, false);
  }
  
  const pc = appState.peerConnections[data.from];
  try {
    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socketEmitSafe('answer', { to: data.from, answer });
  } catch (error) {
    console.error('[WebRTC] Error handling offer:', error);
  }
}

async function handleWebRTCAnswer(data) {
  const pc = appState.peerConnections[data.from];
  if (pc) {
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    } catch (error) {
      console.error('[WebRTC] Error handling answer:', error);
    }
  }
}

async function handleICECandidate(data) {
  const pc = appState.peerConnections[data.from];
  if (pc && data.candidate) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (error) {
      console.error('[WebRTC] Error adding ICE candidate:', error);
    }
  }
}

function handleVideoToggle(data) {
  const participantDiv = document.getElementById(`participant-${data.from}`);
  if (participantDiv) {
    participantDiv.style.opacity = data.enabled ? '1' : '0.7';
  }
}

function handleUserLeftVoice(socketId) {
  if (appState.peerConnections[socketId]) {
    appState.peerConnections[socketId].close();
    delete appState.peerConnections[socketId];
  }
  const remoteVideo = document.getElementById(`remote-${socketId}`);
  if (remoteVideo) remoteVideo.remove();
}

/**
 * ====================================================================
 * CALL HANDLING
 * ====================================================================
 */

function handleCallAccepted(data) {
  console.log('[Call] Call accepted by:', data.from?.username);
  document.querySelector('.call-channel-name').textContent = `Connected with ${data.from.username}`;
  
  if (!appState.peerConnections[data.from.socketId]) {
    createPeerConnection(data.from.socketId, true);
  }
}

function handleCallRejected(data) {
  console.log('[Call] Call rejected');
  alert('Call was declined');
  
  if (appState.localStream) {
    appState.localStream.getTracks().forEach(track => track.stop());
    appState.update({ localStream: null });
  }
  
  appState.update({ inCall: false, callDetails: null });
  document.getElementById('callInterface').classList.add('hidden');
}

function handleCallEnded(data) {
  if (appState.peerConnections[data.from]) {
    appState.peerConnections[data.from].close();
    delete appState.peerConnections[data.from];
  }
  const remoteVideo = document.getElementById(`remote-${data.from}`);
  if (remoteVideo) remoteVideo.remove();
  
  if (Object.keys(appState.peerConnections).length === 0) {
    leaveVoiceChannel(true);
  }
}

/**
 * ====================================================================
 * UI FUNCTIONS - FRIENDS
 * ====================================================================
 */

function updateUserInfo() {
  const userAvatar = document.querySelector('.user-avatar');
  const username = document.querySelector('.username');
  const userStatus = document.querySelector('.user-status');

  if (userAvatar && appState.user) {
    const avatar = appState.user.avatar;
    const fallback = appState.user.username.charAt(0).toUpperCase();
    userAvatar.textContent = avatar && !avatar.startsWith('http') ? avatar : fallback;
  }
  if (username && appState.user) {
    username.textContent = appState.user.username;
  }
  if (userStatus && appState.user) {
    userStatus.textContent = appState.user.status || 'Online';
  }
}

function initializeFriendsTabs() {
  const tabs = document.querySelectorAll('.friends-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab');
      switchFriendsTab(tabName);
    });
  });
  
  const searchBtn = document.getElementById('searchUserBtn');
  if (searchBtn) {
    searchBtn.addEventListener('click', searchUsers);
  }
}

function switchFriendsTab(tabName) {
  document.querySelectorAll('.friends-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
  
  document.querySelectorAll('.friends-list').forEach(l => l.classList.remove('active-tab'));
  const contentMap = {
    'online': 'friendsOnline',
    'all': 'friendsAll',
    'pending': 'friendsPending',
    'add': 'friendsAdd'
  };
  
  const contentEl = document.getElementById(contentMap[tabName]);
  if (contentEl) contentEl.classList.add('active-tab');
  
  if (tabName === 'pending') {
    loadPendingRequests();
  }
}

async function loadFriends() {
  try {
    appState.update({ isLoading: { ...appState.isLoading, friends: true } });
    const friends = await fetchWithError('/api/friends');
    appState.update({ friends, isLoading: { ...appState.isLoading, friends: false } });
    displayFriends(friends);
    populateDMList(friends);
  } catch (error) {
    console.error('[Friends] Load error:', error);
    appState.update({ isLoading: { ...appState.isLoading, friends: false } });
    showNotification('Error', 'Failed to load friends');
  }
}

function displayFriends(friends) {
  const onlineList = document.getElementById('friendsOnline');
  const allList = document.getElementById('friendsAll');
  
  onlineList.innerHTML = '';
  allList.innerHTML = '';
  
  if (friends.length === 0) {
    onlineList.innerHTML = '<div class="friends-empty">No friends yet</div>';
    allList.innerHTML = '<div class="friends-empty">No friends yet</div>';
    return;
  }
  
  const onlineFriends = friends.filter(f => f.status === 'Online');
  
  if (onlineFriends.length === 0) {
    onlineList.innerHTML = '<div class="friends-empty">No one is online</div>';
  } else {
    onlineFriends.forEach(friend => {
      onlineList.appendChild(createFriendItem(friend));
    });
  }
  
  friends.forEach(friend => {
    allList.appendChild(createFriendItem(friend));
  });
}

function createFriendItem(friend) {
  const div = document.createElement('div');
  div.className = 'friend-item';
  div.setAttribute('data-friend-id', friend.id);
  
  div.innerHTML = `
    <div class="friend-avatar">${friend.avatar || friend.username.charAt(0).toUpperCase()}</div>
    <div class="friend-info">
      <div class="friend-name">${friend.username}</div>
      <div class="friend-status ${friend.status === 'Online' ? 'online' : 'offline'}">${friend.status}</div>
    </div>
    <div class="friend-actions">
      <button class="friend-action-btn message" title="Message">💬</button>
      <button class="friend-action-btn audio-call" title="Audio Call">📞</button>
      <button class="friend-action-btn video-call" title="Video Call">📹</button>
      <button class="friend-action-btn remove" title="Remove">🗑️</button>
    </div>
  `;

  div.querySelector('.message').addEventListener('click', () => startDM(friend.id, friend.username));
  div.querySelector('.audio-call').addEventListener('click', () => initiateCall(friend.id, 'audio'));
  div.querySelector('.video-call').addEventListener('click', () => initiateCall(friend.id, 'video'));
  div.querySelector('.remove').addEventListener('click', () => removeFriend(friend.id));
  
  return div;
}

async function searchUsers() {
  const searchInput = document.getElementById('searchUserInput');
  const query = searchInput.value.trim();
  
  if (!query) return;
  
  try {
    const users = await fetchWithError('/api/users');
    const results = users.filter(u => 
      u.username.toLowerCase().includes(query.toLowerCase()) && 
      u.id !== appState.user.id
    );
    displaySearchResults(results);
  } catch (error) {
    console.error('[Search] Error:', error);
  }
}

function displaySearchResults(users) {
  const resultsDiv = document.getElementById('searchResults');
  resultsDiv.innerHTML = '';
  
  if (users.length === 0) {
    resultsDiv.innerHTML = '<div class="friends-empty">No users found</div>';
    return;
  }
  
  users.forEach(user => {
    const div = document.createElement('div');
    div.className = 'user-search-item';
    
    div.innerHTML = `
      <div class="user-avatar">${user.avatar || user.username.charAt(0).toUpperCase()}</div>
      <div class="user-info">
        <div class="user-name">${user.username}</div>
      </div>
      <button class="add-friend-btn">Add Friend</button>
    `;
    
    div.querySelector('.add-friend-btn').addEventListener('click', () => sendFriendRequest(user.id));
    resultsDiv.appendChild(div);
  });
}

async function sendFriendRequest(friendId) {
  try {
    await fetchWithError('/api/friends/request', {
      method: 'POST',
      body: JSON.stringify({ friendId })
    });
    alert('Friend request sent!');
  } catch (error) {
    console.error('[Friend Request] Error:', error);
    alert('Failed to send friend request');
  }
}

async function loadPendingRequests() {
  try {
    appState.update({ isLoading: { ...appState.isLoading, pendingRequests: true } });
    const requests = await fetchWithError('/api/friends/pending');
    appState.update({ pendingRequests: requests, isLoading: { ...appState.isLoading, pendingRequests: false } });
    
    const pendingList = document.getElementById('friendsPending');
    pendingList.innerHTML = '';
    
    if (requests.length === 0) {
      pendingList.innerHTML = '<div class="friends-empty">No pending requests</div>';
      return;
    }
    
    requests.forEach(request => {
      const div = document.createElement('div');
      div.className = 'friend-item';
      
      div.innerHTML = `
        <div class="friend-avatar">${request.avatar || request.username.charAt(0).toUpperCase()}</div>
        <div class="friend-info">
          <div class="friend-name">${request.username}</div>
          <div class="friend-status">Incoming Friend Request</div>
        </div>
        <div class="friend-actions">
          <button class="friend-action-btn accept">✓</button>
          <button class="friend-action-btn reject">✕</button>
        </div>
      `;
      
      div.querySelector('.accept').addEventListener('click', () => acceptFriendRequest(request.id));
      div.querySelector('.reject').addEventListener('click', () => rejectFriendRequest(request.id));
      
      pendingList.appendChild(div);
    });
  } catch (error) {
    console.error('[Pending Requests] Error:', error);
  }
}

async function acceptFriendRequest(friendId) {
  try {
    await fetchWithError('/api/friends/accept', {
      method: 'POST',
      body: JSON.stringify({ friendId })
    });
    
    await loadPendingRequests();
    await loadFriends();
    
    // Notify via socket
    socketEmitSafe('friend-accepted-notify', { to: friendId });
  } catch (error) {
    console.error('[Accept] Error:', error);
  }
}

async function rejectFriendRequest(friendId) {
  try {
    await fetchWithError('/api/friends/reject', {
      method: 'POST',
      body: JSON.stringify({ friendId })
    });
    await loadPendingRequests();
  } catch (error) {
    console.error('[Reject] Error:', error);
  }
}

async function removeFriend(friendId) {
  if (!confirm('Are you sure you want to remove this friend?')) return;
  
  try {
    await fetchWithError(`/api/friends/${friendId}`, {
      method: 'DELETE'
    });
    await loadFriends();
  } catch (error) {
    console.error('[Remove] Error:', error);
  }
}

function populateDMList(friends) {
  const dmList = document.getElementById('dmList');
  if (!dmList) return;
  
  dmList.innerHTML = '';
  
  if (friends.length === 0) {
    dmList.innerHTML = '<div class="dm-empty">No friends to message</div>';
    return;
  }
  
  friends.forEach(friend => {
    const div = document.createElement('div');
    div.className = 'channel dm-channel';
    const avatarLetter = (friend.avatar && !friend.avatar.startsWith('http')) ? friend.avatar : friend.username.charAt(0).toUpperCase();
    let avatarStyle = '';
    if (friend.avatar && friend.avatar.startsWith('http')) {
      avatarStyle = `style="background-image: url('${friend.avatar}'); background-size: cover; color: transparent;"`;
    }
    div.innerHTML = `
      <div class="dm-avatar" ${avatarStyle}>${avatarLetter}</div>
      <span class="dm-name">${friend.username}</span>
    `;
    div.addEventListener('click', () => startDM(friend.id, friend.username));
    dmList.appendChild(div);
  });
}

function startDM(friendId, friendUsername) {
  appState.update({
    view: 'dm',
    currentDMUserId: friendId,
    currentServerId: null,
    currentChannelId: null,
    currentGroupId: null,
    messages: []
  });

  document.getElementById('friendsView').style.display = 'none';
  document.getElementById('chatView').style.display = 'flex';
  document.getElementById('channelsView').style.display = 'none';
  document.getElementById('dmListView').style.display = 'block';

  const chatHeaderInfo = document.getElementById('chatHeaderInfo');
  chatHeaderInfo.innerHTML = `
    <div class="dm-header-left">
      <div class="friend-avatar">${friendUsername.charAt(0).toUpperCase()}</div>
      <span class="channel-name">${friendUsername}</span>
    </div>
    <div class="dm-header-actions">
      <button class="dm-call-btn audio-call-btn" title="Audio Call">📞</button>
      <button class="dm-call-btn video-call-btn" title="Video Call">📹</button>
    </div>
  `;

  chatHeaderInfo.querySelector('.audio-call-btn')?.addEventListener('click', () => initiateCall(friendId, 'audio'));
  chatHeaderInfo.querySelector('.video-call-btn')?.addEventListener('click', () => initiateCall(friendId, 'video'));
  
  document.getElementById('messageInput').placeholder = `Message @${friendUsername}`;
  
  loadDMHistory(friendId);
}

async function loadDMHistory(friendId) {
  try {
    appState.update({ isLoading: { ...appState.isLoading, messages: true } });
    document.getElementById('messagesContainer').innerHTML = '<div class="loading-spinner"></div>';
    
    const messages = await fetchWithError(`/api/dm/${friendId}`);
    appState.update({ 
      messages,
      isLoading: { ...appState.isLoading, messages: false } 
    });
    
    document.getElementById('messagesContainer').innerHTML = '';
    messages.forEach(msg => addMessageToUI(msg));
    scrollToBottom();
  } catch (error) {
    console.error('[DM History] Error:', error);
    appState.update({ isLoading: { ...appState.isLoading, messages: false } });
  }
}

function showFriendsView() {
  appState.update({
    view: 'friends',
    currentDMUserId: null,
    currentServerId: null,
    currentChannelId: null
  });

  document.getElementById('friendsView').style.display = 'flex';
  document.getElementById('chatView').style.display = 'none';
  document.getElementById('channelsView').style.display = 'none';
  document.getElementById('dmListView').style.display = 'block';
  
  document.getElementById('serverName').textContent = 'Friends';
  
  document.querySelectorAll('.server-icon').forEach(icon => icon.classList.remove('active'));
  document.getElementById('friendsBtn').classList.add('active');
}

/**
 * ====================================================================
 * CHANNELS & SERVERS (Dynamic - no hardcoding)
 * ====================================================================
 */

async function loadUserServers() {
  try {
    appState.update({ isLoading: { ...appState.isLoading, servers: true } });
    const servers = await fetchWithError('/api/servers');
    appState.update({ servers, isLoading: { ...appState.isLoading, servers: false } });
    servers.forEach(server => addServerToUI(server, false));
  } catch (error) {
    console.error('[Servers] Load error:', error);
    appState.update({ isLoading: { ...appState.isLoading, servers: false } });
  }
}

function initializeServerManagement() {
  const friendsBtn = document.getElementById('friendsBtn');
  const addServerBtn = document.getElementById('addServerBtn');
  
  friendsBtn.addEventListener('click', showFriendsView);
  addServerBtn.addEventListener('click', createNewServer);
}

async function createNewServer() {
  const serverName = prompt('Enter server name:');
  
  if (!serverName || serverName.trim() === '') return;
  
  try {
    const server = await fetchWithError('/api/servers', {
      method: 'POST',
      body: JSON.stringify({ name: serverName.trim() })
    });
    
    appState.servers.push(server);
    addServerToUI(server, true);
  } catch (error) {
    console.error('[Server Create] Error:', error);
    alert('Failed to create server');
  }
}

function addServerToUI(server, switchTo = false) {
  const serverList = document.querySelector('.server-list');
  const addServerBtn = document.getElementById('addServerBtn');
  
  const serverIcon = document.createElement('div');
  serverIcon.className = 'server-icon';
  serverIcon.textContent = server.icon || server.name.charAt(0).toUpperCase();
  serverIcon.title = server.name;
  serverIcon.setAttribute('data-server-id', server.id);
  
  serverIcon.addEventListener('click', () => {
    document.querySelectorAll('.server-icon').forEach(icon => icon.classList.remove('active'));
    serverIcon.classList.add('active');
    showServerView(server);
  });
  
  serverList.insertBefore(serverIcon, addServerBtn);
  
  if (switchTo) {
    serverIcon.click();
  }
}

function showServerView(server) {
  appState.update({
    view: 'server',
    currentServerId: server.id,
    currentDMUserId: null
  });

  document.getElementById('friendsView').style.display = 'none';
  document.getElementById('chatView').style.display = 'flex';
  document.getElementById('channelsView').style.display = 'block';
  document.getElementById('dmListView').style.display = 'none';

  document.getElementById('serverName').textContent = server.name;
  
  // Load channels for this server dynamically
  loadServerChannels(server.id);
  switchChannel(server.id, 'general');
}

async function loadServerChannels(serverId) {
  try {
    // This assumes API endpoint exists to get server channels
    const channels = await fetchWithError(`/api/servers/${serverId}/channels`);
    appState.channels = { ...appState.channels, [serverId]: channels };
    renderServerChannels(channels);
  } catch (error) {
    console.error('[Channels] Load error:', error);
    // Fallback to default channels if API fails
    renderServerChannels([
      { id: 1, name: 'general', type: 'text' },
      { id: 2, name: 'random', type: 'text' }
    ]);
  }
}

function renderServerChannels(channels) {
  const channelsContainer = document.querySelector('.channels-container');
  if (!channelsContainer) return;
  
  // Simple implementation - can be expanded
  const textChannels = channels.filter(ch => ch.type === 'text');
  
  if (textChannels.length > 0) {
    document.querySelectorAll('.text-channel').forEach((el, idx) => {
      if (idx < textChannels.length) {
        el.setAttribute('data-channel-id', textChannels[idx].id);
        el.setAttribute('data-channel', textChannels[idx].name);
        el.querySelector('span').textContent = textChannels[idx].name;
      }
    });
  }
}

function initializeChannels() {
  const channelElements = document.querySelectorAll('.channel');
  
  channelElements.forEach(channel => {
    channel.addEventListener('click', () => {
      const channelName = channel.getAttribute('data-channel');
      const channelId = channel.getAttribute('data-channel-id');
      const isVoiceChannel = channel.classList.contains('voice-channel');
      
      if (isVoiceChannel) {
        joinVoiceChannel(channelName, channelId);
      } else {
        switchChannel(channelId, channelName);
      }
    });
  });
}

function switchChannel(channelId, channelName) {
  appState.update({
    currentChannelId: channelId,
    currentChannelName: channelName,
    messages: []
  });
  
  document.querySelectorAll('.text-channel').forEach(ch => ch.classList.remove('active'));
  const channelEl = document.querySelector(`[data-channel="${channelName}"]`);
  if (channelEl) channelEl.classList.add('active');
  
  document.getElementById('messageInput').placeholder = `Message #${channelName}`;
  
  loadChannelMessages(channelId);
}

async function loadChannelMessages(channelId) {
  try {
    appState.update({ isLoading: { ...appState.isLoading, messages: true } });
    const messagesContainer = document.getElementById('messagesContainer');
    messagesContainer.innerHTML = '<div class="loading-spinner"></div>';

    const messages = await fetchWithError(`/api/messages/${channelId}`);
    appState.update({ 
      messages,
      isLoading: { ...appState.isLoading, messages: false } 
    });

    messagesContainer.innerHTML = '';
    messages.forEach(message => {
      addMessageToUI({
        id: message.id,
        author: message.username,
        avatar: message.avatar || message.username.charAt(0).toUpperCase(),
        text: message.content,
        timestamp: message.created_at,
        reactions: message.reactions || []
      });
    });

    scrollToBottom();
  } catch (error) {
    console.error('[Load Messages] Error:', error);
    appState.update({ isLoading: { ...appState.isLoading, messages: false } });
  }
}

/**
 * ====================================================================
 * MESSAGE SENDING & RENDERING (Optimized)
 * ====================================================================
 */

function initializeMessageInput() {
  const messageInput = document.getElementById('messageInput');
  
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

function sendMessage() {
  const messageInput = document.getElementById('messageInput');
  const text = messageInput.value.trim();
  
  if (text === '' || !appState.socketConnected) return;

  const message = { text };

  try {
    if (appState.view === 'dm' && appState.currentDMUserId) {
      socketEmitSafe('send-dm', {
        receiverId: appState.currentDMUserId,
        message
      });
    } else if (appState.view === 'server' && appState.currentChannelId) {
      socketEmitSafe('send-message', {
        channelId: appState.currentChannelId,
        message
      });
    }
    
    messageInput.value = '';
  } catch (error) {
    console.error('[Send Message] Error:', error);
  }
}

/**
 * OPTIMIZED MESSAGE RENDERING - Only add new message, don't re-render all
 */
function addMessageToUI(rawMessage) {
  const messagesContainer = document.getElementById('messagesContainer');
  if (!messagesContainer) return;

  const message = normalizeMessage(rawMessage);
  
  const messageGroup = document.createElement('div');
  messageGroup.className = 'message-group';
  messageGroup.setAttribute('data-message-id', message.id);
  
  // Avatar
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = message.avatar;
  
  // Content wrapper
  const content = document.createElement('div');
  content.className = 'message-content';
  
  // Header (author + timestamp)
  const header = document.createElement('div');
  header.className = 'message-header';
  
  const author = document.createElement('span');
  author.className = 'message-author';
  author.textContent = message.author;
  
  const timestamp = document.createElement('span');
  timestamp.className = 'message-timestamp';
  timestamp.textContent = formatTimestamp(message.timestamp);
  
  header.appendChild(author);
  header.appendChild(timestamp);
  content.appendChild(header);
  
  // Message text - detect image markdown ![alt](url) and render as img
  const textContainer = document.createElement('div');
  textContainer.className = 'message-text';
  
  const imgMatch = message.text && message.text.match(/^!\[.*?\]\((.*?)\)$/);
  const videoMatch = message.text && message.text.match(/^\[video\]\((.*?)\)$/);
  
  if (imgMatch) {
    const img = document.createElement('img');
    img.src = imgMatch[1];
    img.className = 'chat-image';
    img.alt = 'Image';
    img.loading = 'lazy';
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof openLightbox === 'function') {
        openLightbox(imgMatch[1]);
      }
    });
    textContainer.appendChild(img);
  } else if (videoMatch) {
    const video = document.createElement('video');
    video.src = videoMatch[1];
    video.className = 'chat-video';
    video.controls = true;
    video.preload = 'metadata';
    textContainer.appendChild(video);
  } else {
    textContainer.textContent = message.text;
  }
  
  content.appendChild(textContainer);
  
  // Reactions container (only show if reactions exist)
  const reactionsContainer = document.createElement('div');
  reactionsContainer.className = 'message-reactions';
  
  if (message.reactions && message.reactions.length > 0) {
    message.reactions.forEach(reaction => {
      const reactionEl = document.createElement('div');
      reactionEl.className = 'reaction';
      reactionEl.innerHTML = `${reaction.emoji} <span>${reaction.count}</span>`;
      reactionEl.title = reaction.users;
      reactionEl.addEventListener('click', () => {
        if (appState.socketConnected) {
          socketEmitSafe('remove-reaction', { messageId: message.id, emoji: reaction.emoji });
        }
      });
      reactionsContainer.appendChild(reactionEl);
    });
  } else {
    reactionsContainer.style.display = 'none';
  }
  content.appendChild(reactionsContainer);
  
  // Add reaction button
  const addReactionBtn = document.createElement('button');
  addReactionBtn.className = 'add-reaction-btn';
  addReactionBtn.textContent = '+';
  addReactionBtn.title = 'Add reaction';
  addReactionBtn.addEventListener('click', () => showEmojiPickerForMessage(message.id || Date.now()));
  content.appendChild(addReactionBtn);
  
  // Assemble message
  messageGroup.appendChild(avatar);
  messageGroup.appendChild(content);
  
  messagesContainer.appendChild(messageGroup);
}

function formatTimestamp(date) {
  try {
    const messageDate = new Date(date);
    const hours = messageDate.getHours().toString().padStart(2, '0');
    const minutes = messageDate.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch {
    return 'Unknown';
  }
}

function scrollToBottom() {
  const messagesContainer = document.getElementById('messagesContainer');
  if (messagesContainer) {
    setTimeout(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 0);
  }
}

/**
 * ====================================================================
 * EMOJI & REACTIONS
 * ====================================================================
 */

function initializeEmojiPicker() {
  const emojiBtn = document.querySelector('.emoji-btn');
  if (emojiBtn) {
    emojiBtn.addEventListener('click', showEmojiPickerForInput);
  }
}

function showEmojiPickerForInput() {
  const emojis = ['😀', '😂', '❤️', '👍', '👎', '🎉', '🔥', '✨', '💯', '🚀'];
  const picker = createEmojiPicker(emojis, (emoji) => {
    const input = document.getElementById('messageInput');
    input.value += emoji;
    input.focus();
  });
  document.body.appendChild(picker);
}

function showEmojiPickerForMessage(messageId) {
  const emojis = ['👍', '❤️', '😂', '😮', '😢', '🎉'];
  const picker = createEmojiPicker(emojis, (emoji) => {
    addReaction(messageId, emoji);
  });
  document.body.appendChild(picker);
}

function createEmojiPicker(emojis, onSelect) {
  const picker = document.createElement('div');
  picker.className = 'emoji-picker';
  
  emojis.forEach(emoji => {
    const btn = document.createElement('button');
    btn.className = 'emoji-option';
    btn.textContent = emoji;
    btn.addEventListener('click', () => {
      onSelect(emoji);
      picker.remove();
    });
    picker.appendChild(btn);
  });
  
  setTimeout(() => {
    document.addEventListener('click', function closePickerAnywhere(e) {
      if (!picker.contains(e.target) && e.target !== document.querySelector('.emoji-btn')) {
        picker.remove();
        document.removeEventListener('click', closePickerAnywhere);
      }
    });
  }, 100);
  
  return picker;
}

function addReaction(messageId, emoji) {
  if (appState.socketConnected) {
    socketEmitSafe('add-reaction', { messageId, emoji });
  }
}

function updateMessageReactions(messageId, reactions) {
  const reactionsContainer = document.querySelector(`[data-message-id="${messageId}"] .message-reactions`);
  if (!reactionsContainer) return;
  
  reactionsContainer.innerHTML = '';
  
  if (!reactions || reactions.length === 0) {
    reactionsContainer.style.display = 'none';
    return;
  }
  
  reactionsContainer.style.display = 'flex';
  
  reactions.forEach(reaction => {
    const reactionEl = document.createElement('div');
    reactionEl.className = 'reaction';
    reactionEl.innerHTML = `${reaction.emoji} <span>${reaction.count}</span>`;
    reactionEl.title = reaction.users || '';
    reactionEl.addEventListener('click', () => {
      if (appState.socketConnected) {
        socketEmitSafe('remove-reaction', { messageId, emoji: reaction.emoji });
      }
    });
    reactionsContainer.appendChild(reactionEl);
  });
}

/**
 * ====================================================================
 * FILE UPLOAD
 * ====================================================================
 */

function initializeFileUpload() {
  const attachBtn = document.querySelector('.attach-btn');
  if (!attachBtn) return;
  
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);
  
  attachBtn.addEventListener('click', () => {
    fileInput.click();
  });
  
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      await uploadFile(file);
    }
    fileInput.value = '';
  });
}

async function uploadFile(file) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('channelId', appState.currentChannelId || appState.currentDMUserId);
    
    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${appState.token}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }
    
    const fileData = await response.json();
    
    const message = {
      text: `Uploaded ${file.name}`,
      file: fileData
    };
    
    if (appState.view === 'dm' && appState.currentDMUserId) {
      socketEmitSafe('send-dm', {
        receiverId: appState.currentDMUserId,
        message
      });
    } else if (appState.view === 'server') {
      socketEmitSafe('send-message', {
        channelId: appState.currentChannelId,
        message
      });
    }
  } catch (error) {
    console.error('[Upload] Error:', error);
    alert('Failed to upload file');
  }
}

/**
 * ====================================================================
 * USER CONTROLS (Mute, Deafen, Settings)
 * ====================================================================
 */

function initializeUserControls() {
  const muteBtn = document.getElementById('muteBtn');
  const deafenBtn = document.getElementById('deafenBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  
  if (muteBtn) {
    muteBtn.addEventListener('click', toggleMute);
  }
  
  if (deafenBtn) {
    deafenBtn.addEventListener('click', toggleDeafen);
  }
  
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => SettingsModule.open());
  }
}

function toggleMute() {
  appState.update({ isMuted: !appState.isMuted });
  
  const muteBtn = document.getElementById('muteBtn');
  muteBtn.querySelector('.icon-normal').style.display = appState.isMuted ? 'none' : 'block';
  muteBtn.querySelector('.icon-slashed').style.display = appState.isMuted ? 'block' : 'none';
  
  if (appState.localStream) {
    appState.localStream.getAudioTracks().forEach(track => {
      track.enabled = !appState.isMuted;
    });
  }
}

function toggleDeafen() {
  appState.update({ isDeafened: !appState.isDeafened });
  
  const deafenBtn = document.getElementById('deafenBtn');
  deafenBtn.querySelector('.icon-normal').style.display = appState.isDeafened ? 'none' : 'block';
  deafenBtn.querySelector('.icon-slashed').style.display = appState.isDeafened ? 'block' : 'none';
  
  if (appState.isDeafened) {
    if (!appState.isMuted) {
      toggleMute();
    }
    document.querySelectorAll('video[id^="remote-"]').forEach(video => {
      video.volume = 0;
    });
  } else {
    document.querySelectorAll('video[id^="remote-"]').forEach(video => {
      video.volume = 1;
    });
  }

  if (appState.localStream) {
    appState.localStream.getAudioTracks().forEach(track => {
      track.enabled = !appState.isMuted;
    });
  }
}

/**
 * ====================================================================
 * NOTIFICATIONS
 * ====================================================================
 */

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function showNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/assets/icon.png',
      tag: 'app-notification',
      requireInteraction: false
    });
  }
}

/**
 * ====================================================================
 * VOICE & VIDEO CALLS
 * ====================================================================
 */

async function initiateCall(friendId, type) {
  try {
    const constraints = { video: true, audio: true };
    appState.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    
    if (type === 'audio') {
      appState.localStream.getVideoTracks().forEach(track => {
        track.enabled = false;
      });
    }
    
    const callInterface = document.getElementById('callInterface');
    callInterface.classList.remove('hidden');
    
    document.querySelector('.call-channel-name').textContent = `Calling...`;
    
    const localVideo = document.getElementById('localVideo');
    localVideo.srcObject = appState.localStream;
    
    appState.update({
      callDetails: {
        friendId,
        type,
        isInitiator: true
      },
      inCall: true,
      isVideoEnabled: type === 'video',
      isAudioEnabled: true
    });
    
    updateCallButtons();
    
    if (appState.socketConnected) {
      socketEmitSafe('initiate-call', {
        to: friendId,
        type,
        from: {
          id: appState.user.id,
          username: appState.user.username,
          socketId: socket.id
        }
      });
    }
    
    setTimeout(() => {
      if (typeof initializeResizableVideos === 'function') {
        initializeResizableVideos();
      }
    }, 100);
    
  } catch (error) {
    console.error('[Call] Initiate error:', error);
    alert('Failed to access camera/microphone. Please check permissions.');
  }
}

function showIncomingCall(caller, type) {
  const incomingCallDiv = document.getElementById('incomingCall');
  const callerName = incomingCallDiv.querySelector('.caller-name');
  const callerAvatar = incomingCallDiv.querySelector('.caller-avatar');
  
  callerName.textContent = caller.username || 'Unknown User';
  callerAvatar.textContent = caller.avatar || caller.username?.charAt(0).toUpperCase() || 'U';
  
  incomingCallDiv.classList.remove('hidden');
  
  const acceptBtn = document.getElementById('acceptCallBtn');
  const rejectBtn = document.getElementById('rejectCallBtn');
  
  acceptBtn.onclick = async () => {
    incomingCallDiv.classList.add('hidden');
    await acceptCall(caller, type);
  };
  
  rejectBtn.onclick = () => {
    incomingCallDiv.classList.add('hidden');
    rejectCall(caller);
  };
  
  setTimeout(() => {
    if (!incomingCallDiv.classList.contains('hidden')) {
      incomingCallDiv.classList.add('hidden');
      rejectCall(caller);
    }
  }, 30000);
}

async function acceptCall(caller, type) {
  try {
    const constraints = { video: true, audio: true };
    appState.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    
    if (type === 'audio') {
      appState.localStream.getVideoTracks().forEach(track => {
        track.enabled = false;
      });
    }
    
    const callInterface = document.getElementById('callInterface');
    callInterface.classList.remove('hidden');
    
    document.querySelector('.call-channel-name').textContent = `Call with ${caller.username}`;
    
    const localVideo = document.getElementById('localVideo');
    localVideo.srcObject = appState.localStream;
    
    appState.update({
      callDetails: {
        peerId: caller.socketId,
        type,
        isInitiator: false
      },
      inCall: true,
      isVideoEnabled: type === 'video',
      isAudioEnabled: true
    });
    
    updateCallButtons();
    
    if (appState.socketConnected) {
      socketEmitSafe('accept-call', {
        to: caller.socketId,
        from: {
          id: appState.user.id,
          username: appState.user.username,
          socketId: socket.id
        }
      });
    }
    
    if (!appState.peerConnections[caller.socketId]) {
      createPeerConnection(caller.socketId, false);
    }
    
    setTimeout(() => {
      if (typeof initializeResizableVideos === 'function') {
        initializeResizableVideos();
      }
    }, 100);
    
  } catch (error) {
    console.error('[Call] Accept error:', error);
    alert('Failed to access camera/microphone. Please check permissions.');
  }
}

function rejectCall(caller) {
  if (appState.socketConnected) {
    socketEmitSafe('reject-call', { to: caller.socketId });
  }
}

function initializeCallControls() {
  const closeCallBtn = document.getElementById('closeCallBtn');
  const toggleVideoBtn = document.getElementById('toggleVideoBtn');
  const toggleAudioBtn = document.getElementById('toggleAudioBtn');
  const toggleScreenBtn = document.getElementById('toggleScreenBtn');
  
  closeCallBtn.addEventListener('click', () => {
    if (appState.callDetails) {
      Object.keys(appState.peerConnections).forEach(socketId => {
        if (appState.socketConnected) {
          socketEmitSafe('end-call', { to: socketId });
        }
      });
    }
    leaveVoiceChannel(true);
  });
  
  toggleVideoBtn.addEventListener('click', toggleVideo);
  toggleAudioBtn.addEventListener('click', toggleAudio);
  toggleScreenBtn.addEventListener('click', toggleScreenShare);
}

function toggleVideo() {
  if (!appState.localStream) return;
  
  appState.update({ isVideoEnabled: !appState.isVideoEnabled });
  appState.localStream.getVideoTracks().forEach(track => {
    track.enabled = appState.isVideoEnabled;
  });
  
  Object.keys(appState.peerConnections).forEach(socketId => {
    if (appState.socketConnected) {
      socketEmitSafe('video-toggle', {
        to: socketId,
        enabled: appState.isVideoEnabled
      });
    }
  });
  
  updateCallButtons();
}

function toggleAudio() {
  if (!appState.localStream) return;
  
  appState.update({ isAudioEnabled: !appState.isAudioEnabled });
  appState.localStream.getAudioTracks().forEach(track => {
    track.enabled = appState.isAudioEnabled;
  });
  
  if (!appState.isAudioEnabled) {
    appState.update({ isMuted: true });
    document.getElementById('muteBtn')?.classList.add('active');
  } else {
    appState.update({ isMuted: false });
    document.getElementById('muteBtn')?.classList.remove('active');
  }
  
  updateCallButtons();
}

async function toggleScreenShare() {
  if (appState.screenStream) {
    appState.screenStream.getTracks().forEach(track => track.stop());
    
    const videoTrack = appState.localStream.getVideoTracks()[0];
    Object.values(appState.peerConnections).forEach(pc => {
      const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender && videoTrack) {
        sender.replaceTrack(videoTrack);
      }
    });
    
    appState.update({ screenStream: null });
    
    const localVideo = document.getElementById('localVideo');
    localVideo.srcObject = appState.localStream;
    
    updateCallButtons();
  } else {
    try {
      appState.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });
      
      const screenTrack = appState.screenStream.getVideoTracks()[0];
      
      Object.values(appState.peerConnections).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenTrack);
        }
      });
      
      const localVideo = document.getElementById('localVideo');
      const mixedStream = new MediaStream([
        screenTrack,
        ...appState.localStream.getAudioTracks()
      ]);
      localVideo.srcObject = mixedStream;
      
      screenTrack.addEventListener('ended', () => {
        toggleScreenShare();
      });
      
      updateCallButtons();
    } catch (error) {
      console.error('[Screen Share] Error:', error);
      if (error.name !== 'NotAllowedError') {
        alert('Error sharing screen. Please try again.');
      }
    }
  }
}

function updateCallButtons() {
  const toggleVideoBtn = document.getElementById('toggleVideoBtn');
  const toggleAudioBtn = document.getElementById('toggleAudioBtn');
  const toggleScreenBtn = document.getElementById('toggleScreenBtn');
  
  if (toggleVideoBtn) {
    toggleVideoBtn.classList.toggle('active', !appState.isVideoEnabled);
  }
  
  if (toggleAudioBtn) {
    toggleAudioBtn.classList.toggle('active', !appState.isAudioEnabled);
  }
  
  if (toggleScreenBtn) {
    toggleScreenBtn.classList.toggle('active', appState.screenStream !== null);
  }
}

async function joinVoiceChannel(channelName, channelId) {
  if (appState.inCall) {
    const callInterface = document.getElementById('callInterface');
    if (callInterface.classList.contains('hidden')) {
      callInterface.classList.remove('hidden');
    }
    return;
  }
  
  appState.update({ inCall: true });
  
  document.querySelectorAll('.voice-channel').forEach(ch => ch.classList.remove('in-call'));
  const channelEl = document.querySelector(`[data-channel="${channelName}"]`);
  if (channelEl) channelEl.classList.add('in-call');
  
  const callInterface = document.getElementById('callInterface');
  callInterface.classList.remove('hidden');
  
  document.querySelector('.call-channel-name').textContent = channelName;
  
  try {
    await initializeMedia();
    
    if (appState.socketConnected) {
      socketEmitSafe('join-voice-channel', {
        channelName,
        channelId,
        userId: appState.user.id
      });
    }
  } catch (error) {
    console.error('[Voice Channel] Error:', error);
    alert('Error accessing camera/microphone. Please grant permissions.');
    leaveVoiceChannel(true);
  }
}

async function initializeMedia() {
  try {
    const constraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: 48000,
        sampleSize: 16,
        channelCount: 2
      }
    };
    
    appState.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    
    const localVideo = document.getElementById('localVideo');
    localVideo.srcObject = appState.localStream;
    
    if (appState.isMuted || appState.isDeafened) {
      appState.localStream.getAudioTracks().forEach(track => {
        track.enabled = false;
      });
    }
  } catch (error) {
    console.error('[Media] Initialization error:', error);
    throw error;
  }
}

function leaveVoiceChannel(force = false) {
  if (!appState.inCall) return;

  if (force) {
    appState.update({ inCall: false });

    if (appState.localStream) {
      appState.localStream.getTracks().forEach(track => track.stop());
      appState.update({ localStream: null });
    }

    if (appState.screenStream) {
      appState.screenStream.getTracks().forEach(track => track.stop());
      appState.update({ screenStream: null });
    }
    
    if (appState.socketConnected && appState.currentChannelName) {
      socketEmitSafe('leave-voice-channel', appState.currentChannelName);
    }

    Object.values(appState.peerConnections).forEach(pc => pc.close());
    appState.update({ peerConnections: {} });

    document.querySelectorAll('.voice-channel').forEach(ch => ch.classList.remove('in-call'));
    document.getElementById('remoteParticipants').innerHTML = '';
  }

  const callInterface = document.getElementById('callInterface');
  callInterface.classList.add('hidden');

  if (force) {
    const localVideo = document.getElementById('localVideo');
    localVideo.srcObject = null;
    appState.update({ isVideoEnabled: true, isAudioEnabled: true });
    updateCallButtons();
  }
}

function createPeerConnection(peerId, isInitiator) {
  const peerConnection = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  });

  // Add local tracks
  if (appState.localStream) {
    appState.localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, appState.localStream);
    });
  }

  // Handle remote stream
  peerConnection.ontrack = (event) => {
    const remoteVideo = document.getElementById(`remote-${peerId}`) ||
      document.createElement('video');
    
    if (!remoteVideo.id) {
      remoteVideo.id = `remote-${peerId}`;
      remoteVideo.autoplay = true;
      remoteVideo.playsinline = true;
      
      const participant = document.createElement('div');
      participant.className = 'participant';
      participant.id = `participant-${peerId}`;
      participant.appendChild(remoteVideo);
      
      const nameEl = document.createElement('div');
      nameEl.className = 'participant-name';
      nameEl.textContent = 'Peer';
      participant.appendChild(nameEl);
      
      document.getElementById('remoteParticipants').appendChild(participant);
    }
    
    remoteVideo.srcObject = event.streams[0];
  };

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate && appState.socketConnected) {
      socketEmitSafe('ice-candidate', {
        to: peerId,
        candidate: event.candidate
      });
    }
  };

  // Handle connection state changes
  peerConnection.onconnectionstatechange = () => {
    console.log(`[WebRTC] Connection state with ${peerId}:`, peerConnection.connectionState);
    
    if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
      peerConnection.close();
      delete appState.peerConnections[peerId];
    }
  };

  appState.peerConnections[peerId] = peerConnection;

  // Create and send offer if initiator
  if (isInitiator) {
    peerConnection.createOffer()
      .then(offer => {
        peerConnection.setLocalDescription(offer);
        if (appState.socketConnected) {
          socketEmitSafe('offer', { to: peerId, offer });
        }
      })
      .catch(error => console.error('[WebRTC] Offer creation error:', error));
  }
}

function initializeDraggableCallWindow() {
  const callInterface = document.getElementById('callInterface');
  const callHeader = callInterface.querySelector('.call-header');
  let isDragging = false;
  let offsetX, offsetY;

  callHeader.addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.clientX - callInterface.offsetLeft;
    offsetY = e.clientY - callInterface.offsetTop;
    callInterface.style.transition = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      callInterface.style.left = (e.clientX - offsetX) + 'px';
      callInterface.style.top = (e.clientY - offsetY) + 'px';
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    callInterface.style.transition = 'all 0.3s ease';
  });
}

/**
 * ====================================================================
 * LIGHTBOX FOR IMAGE FULL-SCREEN VIEW
 * ====================================================================
 */
let lightboxOverlay = null;

function initializeLightbox() {
  lightboxOverlay = document.getElementById('lightboxOverlay');
  if (!lightboxOverlay) return;
  
  lightboxOverlay.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
  lightboxOverlay.addEventListener('click', (e) => {
    if (e.target === lightboxOverlay) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });
}

function openLightbox(src) {
  if (!lightboxOverlay) return;
  const img = lightboxOverlay.querySelector('.lightbox-image');
  img.src = src;
  lightboxOverlay.classList.remove('hidden');
}

function closeLightbox() {
  if (!lightboxOverlay) return;
  lightboxOverlay.classList.add('hidden');
  const img = lightboxOverlay.querySelector('.lightbox-image');
  img.src = '';
}

/**
 * ====================================================================
 * MEDIA UPLOAD "+" BUTTON (separate from attach - opens file picker for images)
 * ====================================================================
 */
function initializeMediaUpload() {
  const mediaBtn = document.getElementById('mediaUploadBtn');
  if (!mediaBtn) return;
  
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*,video/mp4,video/webm';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);
  
  mediaBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });
  
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if (isImage || isVideo) {
      // Upload via existing upload mechanism but include type info
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('channelId', appState.currentChannelId || appState.currentDMUserId);
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${appState.token}`
          },
          body: formData
        });
        
        if (!response.ok) throw new Error('Upload failed');
        const fileData = await response.json();
        
        // Send as media message with markdown-like syntax for detection
        const message = {
          text: isImage 
            ? `![${file.name}](${fileData.url})` 
            : `[video](${fileData.url})`,
          file: fileData,
          mediaType: isImage ? 'image' : 'video'
        };
        
        if (appState.view === 'dm' && appState.currentDMUserId) {
          socketEmitSafe('send-dm', { receiverId: appState.currentDMUserId, message });
        } else if (appState.view === 'server') {
          socketEmitSafe('send-message', { channelId: appState.currentChannelId, message });
        }
      } catch (error) {
        console.error('[Media Upload] Error:', error);
        alert('Failed to upload media');
      }
    }
    
    fileInput.value = '';
  });
}

/**
 * ====================================================================
 * OPTIMISTIC UI FOR REACTIONS WITH ROLLBACK
 * ====================================================================
 */
function addReactionOptimistic(messageId, emoji) {
  if (!appState.socketConnected) return;
  
  // Store previous state for rollback
  const reactionsContainer = document.querySelector(`[data-message-id="${messageId}"] .message-reactions`);
  const previousHTML = reactionsContainer ? reactionsContainer.innerHTML : '';
  const previousDisplay = reactionsContainer ? reactionsContainer.style.display : '';
  
  // Optimistic update: add reaction immediately in DOM
  if (reactionsContainer) {
    // Check if this emoji already exists
    const existing = reactionsContainer.querySelector(`.reaction[data-emoji="${emoji}"]`);
    if (existing) {
      const countSpan = existing.querySelector('span');
      const count = parseInt(countSpan.textContent) + 1;
      countSpan.textContent = count;
    } else {
      const reactionEl = document.createElement('div');
      reactionEl.className = 'reaction';
      reactionEl.setAttribute('data-emoji', emoji);
      reactionEl.innerHTML = `${emoji} <span>1</span>`;
      reactionEl.title = appState.user?.username || 'You';
      reactionEl.addEventListener('click', () => {
        // Remove reaction on click
        socketEmitSafe('remove-reaction', { messageId, emoji });
      });
      reactionsContainer.appendChild(reactionEl);
      reactionsContainer.style.display = 'flex';
    }
  }
  
  // Send to server
  socketEmitSafe('add-reaction', { messageId, emoji }, (response) => {
    // If server returns error, rollback
    if (response && response.error) {
      console.warn('[Reaction] Server error, rolling back:', response.error);
      if (reactionsContainer) {
        reactionsContainer.innerHTML = previousHTML;
        reactionsContainer.style.display = previousDisplay || 'none';
      }
    }
  });
}

/**
 * ====================================================================
 * GROUP DM / GROUP CHAT SYSTEM
 * ====================================================================
 */

/**
 * Open group creation modal with friend checklist.
 */
function openGroupCreatorModal() {
  // Remove existing modal if any
  const existing = document.getElementById('groupCreatorOverlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'groupCreatorOverlay';
  overlay.className = 'profile-modal-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  const friends = appState.friends || [];
  let friendsHTML = '';
  if (friends.length === 0) {
    friendsHTML = '<div class="group-creator-empty">No friends to add. Add friends first!</div>';
  } else {
    friends.forEach(f => {
      friendsHTML += `
        <label class="group-creator-friend">
          <input type="checkbox" value="${f.id}" data-username="${f.username}" />
          <div class="group-creator-avatar">${f.avatar || f.username.charAt(0).toUpperCase()}</div>
          <span>${f.username}</span>
        </label>
      `;
    });
  }

  overlay.innerHTML = `
    <div class="group-creator-modal">
      <div class="group-creator-header">
        <h2>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;margin-right:8px;"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          Select Friends for Group
        </h2>
        <button type="button" class="profile-modal-close group-creator-close">&times;</button>
      </div>
      <div class="group-creator-body">
        <input type="text" class="group-creator-name-input" id="groupNameInput" placeholder="Group name (optional)" maxlength="32" />
        <div class="group-creator-list">
          ${friendsHTML}
        </div>
      </div>
      <div class="group-creator-footer">
        <span class="group-creator-count" id="groupSelectedCount">0 selected</span>
        <div class="group-creator-actions">
          <button type="button" class="settings-btn settings-btn-cancel group-creator-cancel">Cancel</button>
          <button type="button" class="settings-btn settings-btn-save" id="confirmGroupCreateBtn">Create Group</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Update selected count
  const checkboxes = overlay.querySelectorAll('input[type="checkbox"]');
  const countEl = document.getElementById('groupSelectedCount');
  checkboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      const checked = overlay.querySelectorAll('input[type="checkbox"]:checked').length;
      countEl.textContent = checked + ' selected';
    });
  });

  // Close handlers
  overlay.querySelector('.group-creator-close').addEventListener('click', () => overlay.remove());
  overlay.querySelector('.group-creator-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  // Create group handler
  document.getElementById('confirmGroupCreateBtn').addEventListener('click', () => createGroupChat(overlay));
  
  overlay.classList.add('visible');
}

/**
 * Create a group chat from selected friends.
 * @param {HTMLElement} overlay - The group creator modal overlay
 */
function createGroupChat(overlay) {
  const checkboxes = overlay.querySelectorAll('input[type="checkbox"]:checked');
  const selectedFriendIds = Array.from(checkboxes).map(cb => cb.value);
  const selectedNames = Array.from(checkboxes).map(cb => cb.getAttribute('data-username'));

  if (selectedFriendIds.length < 1) {
    alert('Please select at least 1 friend to create a group.');
    return;
  }

  const groupNameInput = document.getElementById('groupNameInput');
  const groupName = groupNameInput.value.trim() || selectedNames.join(', ');

  // Create group object locally
  const groupId = 'group_' + Date.now();

  // Build members list (creator + selected friends)
  const members = [
    { id: appState.user.id, username: appState.user.username, isOwner: true },
    ...selectedFriendIds.map((id, idx) => ({
      id,
      username: selectedNames[idx] || 'Unknown',
      isOwner: false,
    }))
  ];

  const newGroup = {
    id: groupId,
    name: groupName,
    icon: groupName.charAt(0).toUpperCase(),
    members,
    createdBy: appState.user.id,
    createdAt: new Date().toISOString(),
  };

  // Add to state
  appState.groupChats.push(newGroup);
  appState.update({ groupChats: [...appState.groupChats] });

  // Close modal
  overlay.remove();

  // Open the group chat
  openGroupChat(groupId, newGroup);
}

/**
 * Open a group chat view.
 * @param {string} groupId
 * @param {object} groupData
 */
function openGroupChat(groupId, groupData) {
  appState.update({
    view: 'group',
    currentGroupId: groupId,
    currentDMUserId: null,
    currentServerId: null,
    currentChannelId: null,
    messages: [],
  });

  document.getElementById('friendsView').style.display = 'none';
  document.getElementById('chatView').style.display = 'flex';
  document.getElementById('channelsView').style.display = 'none';
  document.getElementById('dmListView').style.display = 'block';

  const memberCount = groupData.members ? groupData.members.length : 0;
  const isOwner = groupData.members?.some(m => String(m.id) === String(appState.user.id) && m.isOwner);

  const chatHeaderInfo = document.getElementById('chatHeaderInfo');
  chatHeaderInfo.innerHTML = `
    <div class="dm-header-left">
      <div class="friend-avatar group-avatar" style="background:linear-gradient(135deg,#5865f2,#9b59b6);">
        ${groupData.icon || groupData.name.charAt(0).toUpperCase()}
      </div>
      <div class="group-header-info">
        <span class="channel-name">${groupData.name}</span>
        <span class="group-member-count">${memberCount} members</span>
      </div>
    </div>
    <div class="dm-header-actions">
      <button class="dm-call-btn audio-call-btn" title="Audio Call">📞</button>
      <button class="dm-call-btn video-call-btn" title="Video Call">📹</button>
      ${isOwner ? `
      <button class="dm-call-btn add-participants-btn" id="addParticipantsBtn" title="Add Members">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
      </button>` : ''}
    </div>
  `;

  // Bind actions
  chatHeaderInfo.querySelector('.audio-call-btn')?.addEventListener('click', () => {
    if (groupData.members && groupData.members.length > 0) {
      const firstOther = groupData.members.find(m => String(m.id) !== String(appState.user.id));
      if (firstOther) initiateCall(firstOther.id, 'audio');
    }
  });
  chatHeaderInfo.querySelector('.video-call-btn')?.addEventListener('click', () => {
    if (groupData.members && groupData.members.length > 0) {
      const firstOther = groupData.members.find(m => String(m.id) !== String(appState.user.id));
      if (firstOther) initiateCall(firstOther.id, 'video');
    }
  });
  chatHeaderInfo.querySelector('#addParticipantsBtn')?.addEventListener('click', () => {
    openGroupCreatorModal();
  });

  document.getElementById('messageInput').placeholder = `Message ${groupData.name}`;

  // Update sidebar to show this group
  updateGroupList();

  // Load group chat messages (stub)
  loadGroupChatHistory(groupId);
}

/**
 * Update group list in the DM sidebar.
 */
function updateGroupList() {
  const dmList = document.getElementById('dmList');
  if (!dmList) return;

  // Clear existing DM list groups to prevent duplicates on re-render
  const existingGroups = dmList.querySelectorAll('.group-channel');
  existingGroups.forEach(el => el.remove());

  const groups = appState.groupChats || [];
  // Find the "DIRECT MESSAGES" category header
  const dmCategory = dmList.closest('.channel-category') || document.querySelector('.channel-category .category-header + .dm-list');
  
  groups.forEach(group => {
    // Check if already rendered
    if (dmList.querySelector(`[data-group-id="${group.id}"]`)) return;

    const div = document.createElement('div');
    div.className = 'channel dm-channel group-channel';
    div.setAttribute('data-group-id', group.id);
    div.innerHTML = `
      <div class="dm-avatar group-avatar" style="background:linear-gradient(135deg,#5865f2,#9b59b6);">
        ${group.icon || group.name.charAt(0).toUpperCase()}
      </div>
      <span class="dm-name">${group.name}</span>
    `;
    div.addEventListener('click', () => openGroupChat(group.id, group));
    dmList.appendChild(div);
  });
}

/**
 * Load group chat history (placeholder - can connect to API).
 */
async function loadGroupChatHistory(groupId) {
  try {
    appState.update({ isLoading: { ...appState.isLoading, messages: true } });
    const messagesContainer = document.getElementById('messagesContainer');
    messagesContainer.innerHTML = '<div class="loading-spinner"></div>';

    // Try to load from API if available
    let messages = [];
    try {
      messages = await fetchWithError(`/api/groups/${groupId}/messages`);
    } catch {
      // API endpoint may not exist yet, that's fine
      messages = [];
    }

    appState.update({
      messages,
      isLoading: { ...appState.isLoading, messages: false },
    });

    messagesContainer.innerHTML = '';
    if (messages.length === 0) {
      messagesContainer.innerHTML = `
        <div class="friends-welcome-view" style="display:flex;">
          <div class="friends-welcome-content" style="text-align:center;color:#72767d;">
            <h2 style="font-size:24px;color:#fff;margin-bottom:16px;">
              👋 Welcome to the Group!
            </h2>
            <p>Start the conversation.</p>
          </div>
        </div>
      `;
    } else {
      messages.forEach(msg => addMessageToUI(msg));
    }
    scrollToBottom();
  } catch (error) {
    console.error('[Group History] Error:', error);
    appState.update({ isLoading: { ...appState.isLoading, messages: false } });
  }
}

/**
 * Send a group message via socket.
 * @param {string} groupId
 * @param {string} text
 */
function sendGroupMessage(groupId, text) {
  if (!appState.socketConnected) return;
  socketEmitSafe('send-group-message', {
    groupId,
    message: { text },
    senderId: appState.user.id,
  });
}

/**
 * ====================================================================
 * AVATAR CLICK HANDLERS FOR PROFILE MODAL
 * ====================================================================
 */
function initializeAvatarClicks() {
  // Click on friend avatar in friend list
  document.addEventListener('click', (e) => {
    const friendAvatar = e.target.closest('.friend-item .friend-avatar');
    if (friendAvatar) {
      const friendItem = friendAvatar.closest('.friend-item');
      const friendId = friendItem?.getAttribute('data-friend-id');
      if (friendId) {
        const friend = appState.friends.find(f => String(f.id) === String(friendId));
        if (friend && typeof ProfileModule !== 'undefined') {
          ProfileModule.open(friendId, friend);
          e.stopPropagation();
        }
      }
    }
  });
  
  // Click on user avatar in search results
  document.addEventListener('click', (e) => {
    const searchAvatar = e.target.closest('.user-search-item .user-avatar');
    if (searchAvatar) {
      const searchItem = searchAvatar.closest('.user-search-item');
      // Search items don't have data-friend-id, we need to find by username
      const userName = searchItem?.querySelector('.user-name')?.textContent;
      if (userName) {
        const allUsersPromise = fetchWithError('/api/users');
        allUsersPromise.then(users => {
          const user = users.find(u => u.username === userName);
          if (user && typeof ProfileModule !== 'undefined') {
            ProfileModule.open(user.id, user);
          }
        }).catch(() => {});
      }
    }
  });
  
  // Click on DM avatar in DM header
  document.addEventListener('click', (e) => {
    const dmAvatar = e.target.closest('.dm-header-left .friend-avatar');
    if (dmAvatar && appState.currentDMUserId) {
      const friend = appState.friends.find(f => String(f.id) === String(appState.currentDMUserId));
      if (friend && typeof ProfileModule !== 'undefined') {
        ProfileModule.open(appState.currentDMUserId, friend);
      }
    }
  });

  // Click on own user avatar in user panel
  document.addEventListener('click', (e) => {
    const userPanelAvatar = e.target.closest('.user-panel .user-avatar');
    if (userPanelAvatar && appState.user && typeof ProfileModule !== 'undefined') {
      ProfileModule.open(appState.user.id, appState.user);
    }
  });
}

/**
 * ====================================================================
 * PATCHES TO EXISTING FUNCTIONS
 * ====================================================================
 * Override addMessageToUI to render images
 * Override addReaction function to use optimistic approach
 */

// Patch addReaction to use optimistic update
const originalAddReaction = addReaction;
function addReaction(messageId, emoji) {
  addReactionOptimistic(messageId, emoji);
}

// Patch initializeApp to also init lightbox, media upload, avatar clicks
const originalInitializeApp = initializeApp;
// We can't easily override initializeApp since it's async, 
// so we hook into the init sequence below

// Hook into the initialization
document.addEventListener('DOMContentLoaded', () => {
  // After all modules loaded, initialize new features
  setTimeout(() => {
    initializeLightbox();
    initializeMediaUpload();
    initializeAvatarClicks();
  }, 1000);
});

console.log('[App] Script loaded successfully - Advanced Profile & Media System active!');
