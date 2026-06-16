/**
 * Message Context Menu Module
 * Custom right-click menu for chat messages.
 * @module ContextMenuModule
 */
const ContextMenuModule = (() => {
  let menuEl = null;
  /** @type {{ messageId: string, text: string } | null} */
  let activeMessage = null;

  /**
   * Initialize context menu module.
   */
  function init() {
    buildMenu();
    bindEvents();
  }

  /**
   * Inject context menu element.
   */
  function buildMenu() {
    if (document.getElementById('messageContextMenu')) return;

    menuEl = document.createElement('div');
    menuEl.id = 'messageContextMenu';
    menuEl.className = 'message-context-menu';
    menuEl.hidden = true;
    menuEl.innerHTML = `
      <button type="button" class="context-menu-item" data-action="copy">Скопировать текст</button>
      <button type="button" class="context-menu-item context-menu-item-danger" data-action="delete">Удалить сообщение</button>
    `;

    document.body.appendChild(menuEl);
  }

  /**
   * Bind document-level event listeners.
   */
  function bindEvents() {
    const messagesContainer = document.getElementById('messagesContainer');
    if (messagesContainer) {
      messagesContainer.addEventListener('contextmenu', handleContextMenu);
    }

    menuEl.addEventListener('click', (e) => {
      const item = e.target.closest('[data-action]');
      if (!item || !activeMessage) return;

      const action = item.dataset.action;
      if (action === 'copy') {
        handleCopyText(activeMessage.text);
      } else if (action === 'delete') {
        handleDeleteMessage(activeMessage.messageId);
      }
      close();
    });

    document.addEventListener('click', close);
    document.addEventListener('contextmenu', (e) => {
      if (!menuEl.contains(e.target)) close();
    });

    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
  }

  /**
   * Show context menu at cursor position.
   * @param {MouseEvent} e
   */
  function handleContextMenu(e) {
    const messageGroup = e.target.closest('.message-group');
    if (!messageGroup) return;

    e.preventDefault();

    const textEl = messageGroup.querySelector('.message-text');
    activeMessage = {
      messageId: messageGroup.getAttribute('data-message-id'),
      text: textEl?.textContent || '',
    };

    menuEl.hidden = false;

    const menuRect = menuEl.getBoundingClientRect();
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuRect.width > window.innerWidth) {
      x = window.innerWidth - menuRect.width - 8;
    }
    if (y + menuRect.height > window.innerHeight) {
      y = window.innerHeight - menuRect.height - 8;
    }

    menuEl.style.left = `${x}px`;
    menuEl.style.top = `${y}px`;
  }

  /**
   * Close context menu.
   */
  function close() {
    if (!menuEl) return;
    menuEl.hidden = true;
    activeMessage = null;
  }

  /**
   * Stub: copy message text.
   * @param {string} text
   */
  function handleCopyText(text) {
    console.log('[ContextMenu] Copy text (stub):', text);
  }

  /**
   * Stub: delete message.
   * @param {string} messageId
   */
  function handleDeleteMessage(messageId) {
    console.log('[ContextMenu] Delete message (stub):', messageId);
  }

  return { init, close };
})();
