/**
 * Enhanced Profile Settings Module v2
 * Discord-style settings modal with:
 * - Banner URL
 * - Profile theme (primary/accent colors)
 * - Avatar decoration
 * - Nameplate color
 * - Profile widgets (gaming)
 * - Live preview
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
  let bannerInput = null;
  let primaryColorInput = null;
  let accentColorInput = null;
  let decorationTypeInput = null;
  let nameplateColorInput = null;
  let widgetTitleInput = null;
  let widgetDescInput = null;
  let widgetIconInput = null;
  let widgetsContainer = null;

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
          <h2 id="settingsModalTitle">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;margin-right:8px;"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>
            User Settings
          </h2>
          <button type="button" class="settings-modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="settings-modal-body">
          <!-- Basic Info -->
          <div class="settings-section">
            <h3 class="settings-section-title">Basic Info</h3>
            <div class="settings-field">
              <label for="settingsDisplayName">Display Name</label>
              <input type="text" id="settingsDisplayName" maxlength="32" placeholder="Your display name" />
            </div>
            <div class="settings-field">
              <label for="settingsNickname">Username (@username)</label>
              <input type="text" id="settingsNickname" maxlength="32" placeholder="Your nickname" />
              <span class="settings-field-hint">Unique identifier</span>
            </div>
            <div class="settings-field">
              <label for="settingsAboutMe">About Me</label>
              <textarea id="settingsAboutMe" maxlength="190" placeholder="Tell us about yourself..." rows="3"></textarea>
            </div>
            <div class="settings-field">
              <label for="settingsStatus">Status</label>
              <select id="settingsStatus">
                ${STATUS_OPTIONS.map(
                  (status) => `<option value="${status}">${status}</option>`
                ).join('')}
              </select>
            </div>
            <div class="settings-field">
              <label for="settingsAvatar">Avatar URL</label>
              <input type="url" id="settingsAvatar" placeholder="https://example.com/avatar.png" />
            </div>
          </div>

          <!-- Profile Banner & Theme -->
          <div class="settings-section">
            <h3 class="settings-section-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;margin-right:6px;"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
              Profile Customization
            </h3>
            <div class="settings-field">
              <label for="settingsBanner">Banner Image URL</label>
              <input type="url" id="settingsBanner" placeholder="https://example.com/banner.png" />
              <span class="settings-field-hint">Recommended: 600x240px</span>
            </div>
            <div class="settings-row">
              <div class="settings-field settings-field-half">
                <label for="settingsPrimaryColor">Primary Color</label>
                <input type="color" id="settingsPrimaryColor" value="#5865f2" />
              </div>
              <div class="settings-field settings-field-half">
                <label for="settingsAccentColor">Accent Color</label>
                <input type="color" id="settingsAccentColor" value="#3ba55d" />
              </div>
            </div>
            <div class="settings-field">
              <label for="settingsDecorationType">Avatar Decoration</label>
              <select id="settingsDecorationType">
                <option value="">None</option>
                <option value="ring">Glow Ring</option>
                <option value="url">Custom Image URL</option>
              </select>
            </div>
            <div class="settings-field" id="decorationUrlField" style="display:none;">
              <label for="settingsDecorationUrl">Decoration Image URL</label>
              <input type="url" id="settingsDecorationUrl" placeholder="https://example.com/decoration.png" />
            </div>
            <div class="settings-field">
              <label for="settingsNameplateColor">Nameplate Color</label>
              <input type="color" id="settingsNameplateColor" value="#5865f2" />
              <span class="settings-field-hint">Accent bar on your display name</span>
            </div>
          </div>

          <!-- Profile Widgets -->
          <div class="settings-section">
            <h3 class="settings-section-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;margin-right:6px;"><path d="M21 6H3C1.9 6 1 6.9 1 8v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 10H3V8h18v8zM6 15h2v-2h2v-2H8V9H6v2H4v2h2v2z"/></svg>
              Profile Widgets (Gaming)
            </h3>
            <div class="settings-widgets-list" id="settingsWidgetsList"></div>
            <div class="settings-widget-add">
              <div class="settings-field">
                <label>Add Widget</label>
                <div class="settings-widget-form">
                  <input type="text" id="widgetTitleInput" placeholder="Game title (e.g. Valorant)" />
                  <input type="text" id="widgetDescInput" placeholder="Description (e.g. Rank: Diamond)" />
                  <input type="url" id="widgetIconInput" placeholder="Icon URL (optional)" />
                  <button type="button" class="settings-btn settings-btn-small" id="addWidgetBtn">+ Add</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Profile Preview -->
          <div class="settings-section">
            <h3 class="settings-section-title">Profile Preview</h3>
            <div class="settings-profile-preview" id="settingsProfilePreview">
              <div class="preview-card">
                <div class="preview-banner" id="previewBanner"></div>
                <div class="preview-avatar-row">
                  <div class="preview-avatar-decoration" id="previewDecoration">
                    <div class="preview-avatar" id="previewAvatar">U</div>
                  </div>
                  <div class="preview-badges" id="previewBadges"></div>
                </div>
                <div class="preview-info">
                  <div class="preview-name" id="previewDisplayName">Display Name</div>
                  <div class="preview-username" id="previewUsername">@username</div>
                  <div class="preview-about" id="previewAbout">About me...</div>
                </div>
              </div>
            </div>
          </div>

          <p class="settings-error" id="settingsError" hidden></p>
        </div>
        <div class="settings-modal-footer">
          <button type="button" class="settings-btn settings-btn-cancel">Cancel</button>
          <button type="button" class="settings-btn settings-btn-save" id="settingsSaveBtn">Save</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    nicknameInput = overlay.querySelector('#settingsNickname');
    statusSelect = overlay.querySelector('#settingsStatus');
    avatarInput = overlay.querySelector('#settingsAvatar');
    saveBtn = overlay.querySelector('#settingsSaveBtn');
    errorEl = overlay.querySelector('#settingsError');
    displayNameInput = overlay.querySelector('#settingsDisplayName');
    aboutMeInput = overlay.querySelector('#settingsAboutMe');
    bannerInput = overlay.querySelector('#settingsBanner');
    primaryColorInput = overlay.querySelector('#settingsPrimaryColor');
    accentColorInput = overlay.querySelector('#settingsAccentColor');
    decorationTypeInput = overlay.querySelector('#settingsDecorationType');
    nameplateColorInput = overlay.querySelector('#settingsNameplateColor');
    widgetTitleInput = overlay.querySelector('#widgetTitleInput');
    widgetDescInput = overlay.querySelector('#widgetDescInput');
    widgetIconInput = overlay.querySelector('#widgetIconInput');
    widgetsContainer = overlay.querySelector('#settingsWidgetsList');
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
    overlay.querySelector('#addWidgetBtn').addEventListener('click', addWidget);

    // Decoration type toggle
    if (decorationTypeInput) {
      decorationTypeInput.addEventListener('change', () => {
        const urlField = overlay.querySelector('#decorationUrlField');
        urlField.style.display = decorationTypeInput.value === 'url' ? 'block' : 'none';
      });
    }

    // Live preview on input change
    const previewFields = ['#settingsDisplayName', '#settingsNickname', '#settingsAboutMe', '#settingsBanner', '#settingsPrimaryColor', '#settingsAccentColor', '#settingsNameplateColor', '#settingsAvatar'];
    previewFields.forEach(sel => {
      const el = overlay.querySelector(sel);
      if (el) el.addEventListener('input', updatePreview);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('visible')) {
        close();
      }
    });
  }

  /**
   * Update live preview.
   */
  function updatePreview() {
    const previewBanner = document.getElementById('previewBanner');
    const previewDecoration = document.getElementById('previewDecoration');
    const previewAvatar = document.getElementById('previewAvatar');
    const previewBadges = document.getElementById('previewBadges');
    const previewDisplayName = document.getElementById('previewDisplayName');
    const previewUsername = document.getElementById('previewUsername');
    const previewAbout = document.getElementById('previewAbout');
    const previewCard = document.querySelector('.preview-card');

    // Banner
    const bannerUrl = bannerInput?.value || '';
    previewBanner.style.backgroundImage = bannerUrl ? `url(${bannerUrl})` : '';
    previewBanner.style.display = bannerUrl ? 'block' : 'none';

    // Avatar
    const avatarUrl = avatarInput?.value || '';
    const name = displayNameInput?.value || deps.appState.user?.displayName || deps.appState.user?.username || 'U';
    previewAvatar.textContent = avatarUrl ? '' : name.charAt(0).toUpperCase();
    if (avatarUrl.startsWith('http')) {
      previewAvatar.style.backgroundImage = `url(${avatarUrl})`;
      previewAvatar.style.backgroundSize = 'cover';
      previewAvatar.style.color = 'transparent';
    } else {
      previewAvatar.style.backgroundImage = '';
      previewAvatar.style.color = '';
    }

    // Decoration
    const decorType = decorationTypeInput?.value || '';
    const primaryColor = primaryColorInput?.value || '#5865f2';
    if (decorType === 'ring') {
      previewDecoration.style.border = `3px solid ${primaryColor}`;
      previewDecoration.style.boxShadow = `0 0 12px ${primaryColor}44`;
      previewDecoration.style.display = 'block';
    } else {
      previewDecoration.style.display = 'none';
    }

    // Theme
    const accentColor = accentColorInput?.value || '#3ba55d';
    previewCard.style.setProperty('--preview-primary', primaryColor);
    previewCard.style.setProperty('--preview-accent', accentColor);

    // Nameplate
    const nameplateColor = nameplateColorInput?.value || '';
    if (nameplateColor) {
      previewDisplayName.style.borderLeft = `3px solid ${nameplateColor}`;
      previewDisplayName.style.paddingLeft = '10px';
    } else {
      previewDisplayName.style.borderLeft = 'none';
      previewDisplayName.style.paddingLeft = '';
    }

    // Text
    previewDisplayName.textContent = displayNameInput?.value || deps.appState.user?.displayName || deps.appState.user?.username || 'Display Name';
    previewUsername.textContent = '@' + (nicknameInput?.value || deps.appState.user?.username || 'username');
    previewAbout.textContent = aboutMeInput?.value || 'About me...';

    // Badges (demo)
    previewBadges.innerHTML = `
      <span class="preview-badge" title="Nitro" style="background:linear-gradient(135deg,#ff73fa,#5865f2);">N</span>
      <span class="preview-badge" title="Booster" style="background:linear-gradient(135deg,#ff73fa,#f47fff);">B</span>
    `;
  }

  /**
   * Add a widget to the list.
   */
  function addWidget() {
    const title = widgetTitleInput?.value.trim();
    const desc = widgetDescInput?.value.trim();
    const icon = widgetIconInput?.value.trim();

    if (!title) {
      showError('Please enter a widget title');
      return;
    }

    // Add to local state
    if (!deps.appState.profileWidgets) {
      deps.appState.profileWidgets = [];
    }
    deps.appState.profileWidgets.push({
      id: 'widget_' + Date.now(),
      type: 'game',
      title,
      description: desc || '',
      icon: icon || null,
      url: null,
    });

    // Refresh widget list
    renderWidgetsList();
    hideError();

    // Clear inputs
    widgetTitleInput.value = '';
    widgetDescInput.value = '';
    widgetIconInput.value = '';
  }

  /**
   * Render widgets list in settings.
   */
  function renderWidgetsList() {
    if (!widgetsContainer) return;
    const widgets = deps.appState.profileWidgets || [];
    widgetsContainer.innerHTML = '';
    if (widgets.length === 0) {
      widgetsContainer.innerHTML = '<div class="settings-empty">No widgets added yet.</div>';
      return;
    }
    widgets.forEach((widget, index) => {
      const item = document.createElement('div');
      item.className = 'settings-widget-item';
      item.innerHTML = `
        <div class="settings-widget-info">
          <strong>${widget.title}</strong>
          ${widget.description ? `<span>${widget.description}</span>` : ''}
        </div>
        <button type="button" class="settings-widget-remove" data-index="${index}">&times;</button>
      `;
      item.querySelector('.settings-widget-remove').addEventListener('click', () => {
        deps.appState.profileWidgets.splice(index, 1);
        renderWidgetsList();
        updatePreview();
      });
      widgetsContainer.appendChild(item);
    });
  }

  /**
   * Populate form fields from current user state.
   */
  function populateFields() {
    const user = deps.appState.user;
    if (!user) return;

    nicknameInput.value = user.username || '';
    displayNameInput.value = user.displayName || '';
    aboutMeInput.value = user.aboutMe || '';
    statusSelect.value = STATUS_OPTIONS.includes(user.status) ? user.status : 'Online';
    avatarInput.value = user.avatar?.startsWith('http') ? user.avatar : '';

    // Profile customization fields
    const theme = deps.appState.profileTheme || {};
    const nameplate = deps.appState.nameplate || {};
    const decoration = deps.appState.avatarDecoration || {};

    if (bannerInput) bannerInput.value = deps.appState.profileBanner || '';
    if (primaryColorInput) primaryColorInput.value = theme.primaryColor || '#5865f2';
    if (accentColorInput) accentColorInput.value = theme.accentColor || '#3ba55d';
    if (decorationTypeInput) decorationTypeInput.value = decoration.type || '';
    if (nameplateColorInput) nameplateColorInput.value = nameplate.color || '#5865f2';

    // Render widgets
    renderWidgetsList();
    updatePreview();
    hideError();
  }

  /**
   * Open settings modal.
   */
  function open() {
    populateFields();
    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
    nicknameInput?.focus();
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
    if (errorEl) {
      errorEl.hidden = true;
      errorEl.textContent = '';
    }
  }

  /**
   * Show error message in modal.
   * @param {string} message
   */
  function showError(message) {
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.hidden = false;
    }
  }

  /**
   * Save profile to server and update local state.
   */
  async function saveProfile() {
    const username = nicknameInput.value.trim();
    const displayName = displayNameInput.value.trim();
    const aboutMe = aboutMeInput.value.trim();
    const status = statusSelect.value;
    const avatar = avatarInput.value.trim();

    if (username.length < 2) {
      showError('Username must be at least 2 characters');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    hideError();

    try {
      const profileData = {
        username,
        displayName,
        aboutMe,
        status,
        avatar: avatar || null,
        // Profile customization
        profileBanner: bannerInput?.value?.trim() || null,
        profileTheme: {
          primaryColor: primaryColorInput?.value || '#5865f2',
          accentColor: accentColorInput?.value || '#3ba55d',
        },
        avatarDecoration: decorationTypeInput?.value ? {
          type: decorationTypeInput.value,
          color: decorationTypeInput.value === 'ring' ? primaryColorInput?.value || '#5865f2' : null,
          url: overlay.querySelector('#settingsDecorationUrl')?.value?.trim() || null,
        } : null,
        nameplate: {
          style: nameplateColorInput?.value ? 'colored' : 'default',
          color: nameplateColorInput?.value || null,
        },
        profileWidgets: deps.appState.profileWidgets || [],
      };

      const updatedUser = await deps.fetchWithError('/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify(profileData),
      });

      const mergedUser = { ...deps.appState.user, ...updatedUser };
      deps.appState.update({
        user: mergedUser,
        profileBanner: profileData.profileBanner,
        profileTheme: profileData.profileTheme,
        avatarDecoration: profileData.avatarDecoration,
        nameplate: profileData.nameplate,
        profileWidgets: profileData.profileWidgets,
      });
      localStorage.setItem('currentUser', JSON.stringify(mergedUser));
      deps.updateUserInfo();
      close();
    } catch (error) {
      showError(error.message || 'Failed to save profile');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
    }
  }

  return { init, open, close };
})();
