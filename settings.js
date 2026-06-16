/**
 * Profile Settings Module
 * Discord-style settings modal injected via DOM manipulation.
 * @module SettingsModule
 */
const SettingsModule = (() => {
  /** @type {{ appState: object, fetchWithError: Function, updateUserInfo: Function }} */
  let deps = {};

  let overlay = null;
  let nicknameInput = null;
  let statusSelect = null;
  let avatarInput = null;
  let saveBtn = null;
  let errorEl = null;

  const STATUS_OPTIONS = ['Online', 'Idle', 'DND', 'Invisible'];

  /**
   * Initialize module with app dependencies.
   * @param {object} dependencies
   */
  function init(dependencies) {
    deps = dependencies;
    buildModal();
    bindEvents();
  }

  /**
   * Inject modal markup into the document.
   */
  function buildModal() {
    if (document.getElementById('settingsModalOverlay')) return;

    overlay = document.createElement('div');
    overlay.id = 'settingsModalOverlay';
    overlay.className = 'settings-modal-overlay';
    overlay.setAttribute('aria-hidden', 'true');

    overlay.innerHTML = `
      <div class="settings-modal" role="dialog" aria-labelledby="settingsModalTitle">
        <div class="settings-modal-header">
          <h2 id="settingsModalTitle">User Settings</h2>
          <button type="button" class="settings-modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="settings-modal-body">
          <div class="settings-field">
            <label for="settingsNickname">Никнейм</label>
            <input type="text" id="settingsNickname" maxlength="32" placeholder="Your nickname" />
          </div>
          <div class="settings-field">
            <label for="settingsStatus">Статус</label>
            <select id="settingsStatus">
              ${STATUS_OPTIONS.map(
                (status) => `<option value="${status}">${status}</option>`
              ).join('')}
            </select>
          </div>
          <div class="settings-field">
            <label for="settingsAvatar">Аватар</label>
            <input type="url" id="settingsAvatar" placeholder="https://example.com/avatar.png" />
            <span class="settings-field-hint">URL изображения (placeholder)</span>
          </div>
          <p class="settings-error" id="settingsError" hidden></p>
        </div>
        <div class="settings-modal-footer">
          <button type="button" class="settings-btn settings-btn-cancel">Отмена</button>
          <button type="button" class="settings-btn settings-btn-save" id="settingsSaveBtn">Сохранить</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    nicknameInput = overlay.querySelector('#settingsNickname');
    statusSelect = overlay.querySelector('#settingsStatus');
    avatarInput = overlay.querySelector('#settingsAvatar');
    saveBtn = overlay.querySelector('#settingsSaveBtn');
    errorEl = overlay.querySelector('#settingsError');
  }

  /**
   * Bind modal UI events.
   */
  function bindEvents() {
    overlay.querySelector('.settings-modal-close').addEventListener('click', close);
    overlay.querySelector('.settings-btn-cancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    saveBtn.addEventListener('click', saveProfile);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('visible')) {
        close();
      }
    });
  }

  /**
   * Populate form fields from current user state.
   */
  function populateFields() {
    const user = deps.appState.user;
    if (!user) return;

    nicknameInput.value = user.username || '';
    statusSelect.value = STATUS_OPTIONS.includes(user.status) ? user.status : 'Online';
    avatarInput.value = user.avatar?.startsWith('http') ? user.avatar : '';
    hideError();
  }

  /**
   * Open settings modal.
   */
  function open() {
    populateFields();
    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
    nicknameInput.focus();
  }

  /**
   * Close settings modal.
   */
  function close() {
    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');
    hideError();
  }

  /**
   * Hide error message.
   */
  function hideError() {
    errorEl.hidden = true;
    errorEl.textContent = '';
  }

  /**
   * Show error message in modal.
   * @param {string} message
   */
  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  /**
   * Save profile to server and update local state.
   */
  async function saveProfile() {
    const username = nicknameInput.value.trim();
    const status = statusSelect.value;
    const avatar = avatarInput.value.trim();

    if (username.length < 2) {
      showError('Никнейм должен содержать минимум 2 символа');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Сохранение...';
    hideError();

    try {
      const updatedUser = await deps.fetchWithError('/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ username, status, avatar: avatar || null }),
      });

      const mergedUser = { ...deps.appState.user, ...updatedUser };
      deps.appState.update({ user: mergedUser });
      localStorage.setItem('currentUser', JSON.stringify(mergedUser));
      deps.updateUserInfo();
      close();
    } catch (error) {
      showError(error.message || 'Не удалось сохранить профиль');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Сохранить';
    }
  }

  return { init, open, close };
})();
