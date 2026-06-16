/**
 * Typing Indicators Module
 * Debounced typing-start emission and incoming indicator display.
 * @module TypingModule
 */
const TypingModule = (() => {
  /** @type {{ appState: object, socketEmitSafe: Function }} */
  let deps = {};

  const DEBOUNCE_MS = 400;
  const THROTTLE_MS = 2500;
  const HIDE_AFTER_MS = 3000;

  /** @type {Map<number, { username: string, timeoutId: number }>} */
  const typingUsers = new Map();

  let indicatorEl = null;
  let debounceTimer = null;
  let lastEmitTime = 0;

  /**
   * Initialize typing module.
   * @param {object} dependencies
   */
  function init(dependencies) {
    deps = dependencies;
    buildIndicator();
    bindInputEvents();
    bindSocketEvents();
  }

  /**
   * Inject typing indicator above message input.
   */
  function buildIndicator() {
    const inputContainer = document.querySelector('.message-input-container');
    if (!inputContainer || document.getElementById('typingIndicator')) return;

    indicatorEl = document.createElement('div');
    indicatorEl.id = 'typingIndicator';
    indicatorEl.className = 'typing-indicator';
    indicatorEl.hidden = true;
    indicatorEl.innerHTML = '<span class="typing-indicator-text"></span>';

    inputContainer.parentNode.insertBefore(indicatorEl, inputContainer);
  }

  /**
   * Bind debounced input listener on message field.
   */
  function bindInputEvents() {
    const messageInput = document.getElementById('messageInput');
    if (!messageInput) return;

    messageInput.addEventListener('input', () => {
      if (!messageInput.value.trim()) return;
      scheduleTypingEmit();
    });
  }

  /**
   * Debounce + throttle typing-start socket emission.
   */
  function scheduleTypingEmit() {
    clearTimeout(debounceTimer);

    debounceTimer = setTimeout(() => {
      const now = Date.now();
      if (now - lastEmitTime < THROTTLE_MS) return;

      emitTypingStart();
      lastEmitTime = now;
    }, DEBOUNCE_MS);
  }

  /**
   * Emit typing-start for current channel or DM context.
   */
  function emitTypingStart() {
    const { view, currentChannelId, currentDMUserId, socketConnected } = deps.appState;
    if (!socketConnected) return;

    try {
      if (view === 'server' && currentChannelId) {
        deps.socketEmitSafe('typing-start', { channelId: currentChannelId });
      } else if (view === 'dm' && currentDMUserId) {
        deps.socketEmitSafe('typing-start', { dmUserId: currentDMUserId });
      }
    } catch (error) {
      console.error('[Typing] Emit error:', error);
    }
  }

  /**
   * Register socket listener for incoming typing events.
   */
  function bindSocketEvents() {
    const socket = deps.appState.socket;
    if (!socket) return;

    socket.on('typing-start', (data) => {
      try {
        handleIncomingTyping(data);
      } catch (error) {
        console.error('[Typing] Handler error:', error);
      }
    });
  }

  /**
   * Handle incoming typing-start from another user.
   * @param {object} data
   */
  function handleIncomingTyping(data) {
    const { userId, username, channelId, dmUserId } = data;
    const { view, currentChannelId, currentDMUserId, user } = deps.appState;

    if (!userId || userId === user?.id) return;

    const isRelevantChannel =
      view === 'server' &&
      channelId &&
      String(currentChannelId) === String(channelId);

    const isRelevantDM =
      view === 'dm' &&
      (userId === currentDMUserId || dmUserId === user?.id);

    if (!isRelevantChannel && !isRelevantDM) return;

    const existing = typingUsers.get(userId);
    if (existing) clearTimeout(existing.timeoutId);

    typingUsers.set(userId, {
      username,
      timeoutId: setTimeout(() => {
        typingUsers.delete(userId);
        renderIndicator();
      }, HIDE_AFTER_MS),
    });

    renderIndicator();
  }

  /**
   * Update typing indicator text.
   */
  function renderIndicator() {
    if (!indicatorEl) return;

    const names = [...typingUsers.values()].map((entry) => entry.username);

    if (names.length === 0) {
      indicatorEl.hidden = true;
      return;
    }

    const textEl = indicatorEl.querySelector('.typing-indicator-text');
    if (names.length === 1) {
      textEl.textContent = `${names[0]} is typing...`;
    } else if (names.length === 2) {
      textEl.textContent = `${names[0]} and ${names[1]} are typing...`;
    } else {
      textEl.textContent = 'Several people are typing...';
    }

    indicatorEl.hidden = false;
  }

  return { init };
})();
