/**
 * Discord Profile Settings Module v3 — NO WIDGETS
 * Clean settings: Banner, Theme Colors, Decoration, Nameplate, Live Preview
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
  let displayNameInput = null;
  let aboutMeInput = null;
  let bannerInput = null;
  let primaryColorInput = null;
  let accentColorInput = null;
  let decorationTypeInput = null;
  let nameplateColorInput = null;

  const STATUS_OPTIONS = ['Online', 'Idle', 'DND', 'Invisible'];

  function init(dependencies) {
    deps = dependencies;
    buildModal();
    bindEvents();
  }

  function buildModal() {
    if (document.getElementById('settingsModalOverlay')) return;

    overlay = document.createElement('div');
    overlay.id = 'settingsModalOverlay';
    overlay.className = 'settings-modal-overlay';
    overlay.setAttribute('aria-hidden', 'true');

    overlay.innerHTML = `
      <div class="settings-modal" role="dialog">
        <div class="settings-modal-header">
          <h2>⚙ User Settings</h2>
          <button type="button" class="settings-modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="settings-modal-body">
          <div class="settings-section">
            <h3 class="settings-section-title">Basic Info</h3>
            <div class="settings-field">
              <label>Display Name</label>
              <input type="text" id="settingsDisplayName" maxlength="32" placeholder="Your display name" />
            </div>
            <div class="settings-field">
              <label>Username</label>
              <input type="text" id="settingsNickname" maxlength="32" placeholder="Your username" />
            </div>
            <div class="settings-field">
              <label>About Me</label>
              <textarea id="settingsAboutMe" maxlength="190" placeholder="Tell us about yourself..." rows="3"></textarea>
            </div>
            <div class="settings-field">
              <label>Status</label>
              <select id="settingsStatus">
                ${STATUS_OPTIONS.map(s => `<option value="${s}">${s}</option>`).join('')}
              </select>
            </div>
            <div class="settings-field">
              <label>Avatar URL</label>
              <input type="url" id="settingsAvatar" placeholder="https://example.com/avatar.png" />
            </div>
          </div>

          <div class="settings-section">
            <h3 class="settings-section-title">Profile Customization</h3>
            <div class="settings-field">
              <label>Banner Image URL</label>
              <input type="url" id="settingsBanner" placeholder="https://example.com/banner.png" />
              <span class="settings-field-hint">Recommended: 600×240</span>
            </div>
            <div class="settings-row">
              <div class="settings-field settings-field-half">
                <label>Primary Color</label>
                <input type="color" id="settingsPrimaryColor" value="#5865f2" />
              </div>
              <div class="settings-field settings-field-half">
                <label>Accent Color</label>
                <input type="color" id="settingsAccentColor" value="#3ba55d" />
              </div>
            </div>
            <div class="settings-field">
              <label>Avatar Decoration</label>
              <select id="settingsDecorationType">
                <option value="">None</option>
                <option value="ring">Glow Ring</option>
                <option value="url">Custom Image</option>
              </select>
            </div>
            <div class="settings-field" id="decorationUrlField" style="display:none;">
              <label>Decoration Image URL</label>
              <input type="url" id="settingsDecorationUrl" placeholder="https://example.com/deco.png" />
            </div>
            <div class="settings-field">
              <label>Nameplate Color</label>
              <input type="color" id="settingsNameplateColor" value="#5865f2" />
            </div>
          </div>

          <div class="settings-section">
            <h3 class="settings-section-title">Profile Preview</h3>
            <div class="settings-profile-preview">
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
  }

  function bindEvents() {
    overlay.querySelector('.settings-modal-close').addEventListener('click', close);
    overlay.querySelector('.settings-btn-cancel').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    saveBtn.addEventListener('click', saveProfile);

    if (decorationTypeInput) {
      decorationTypeInput.addEventListener('change', () => {
        const f = overlay.querySelector('#decorationUrlField');
        if (f) f.style.display = decorationTypeInput.value === 'url' ? 'block' : 'none';
      });
    }

    ['#settingsDisplayName','#settingsNickname','#settingsAboutMe','#settingsBanner','#settingsPrimaryColor','#settingsAccentColor','#settingsNameplateColor','#settingsAvatar'].forEach(sel => {
      const el = overlay.querySelector(sel);
      if (el) el.addEventListener('input', updatePreview);
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && overlay.classList.contains('visible')) close();
    });
  }

  function updatePreview() {
    const pb = document.getElementById('previewBanner');
    const pd = document.getElementById('previewDecoration');
    const pa = document.getElementById('previewAvatar');
    const pbadges = document.getElementById('previewBadges');
    const pname = document.getElementById('previewDisplayName');
    const puser = document.getElementById('previewUsername');
    const pabout = document.getElementById('previewAbout');
    const card = document.querySelector('.preview-card');

    const bUrl = bannerInput?.value || '';
    pb.style.backgroundImage = bUrl ? `url(${bUrl})` : '';
    pb.style.display = bUrl ? 'block' : 'none';

    const aUrl = avatarInput?.value || '';
    const name = displayNameInput?.value || deps.appState.user?.displayName || deps.appState.user?.username || 'U';
    pa.textContent = aUrl ? '' : name.charAt(0).toUpperCase();
    if (aUrl.startsWith('http')) {
      pa.style.backgroundImage = `url(${aUrl})`;
      pa.style.backgroundSize = 'cover';
      pa.style.color = 'transparent';
    } else { pa.style.backgroundImage = ''; pa.style.color = ''; }

    const dt = decorationTypeInput?.value || '';
    const pc = primaryColorInput?.value || '#5865f2';
    if (dt === 'ring') { pd.style.display = 'block'; pd.style.border = `3px solid ${pc}`; pd.style.boxShadow = `0 0 12px ${pc}44`; }
    else { pd.style.display = 'none'; }

    card.style.setProperty('--preview-primary', pc);
    card.style.setProperty('--preview-accent', accentColorInput?.value || '#3ba55d');

    const nc = nameplateColorInput?.value || '';
    if (nc) { pname.style.borderLeft = `3px solid ${nc}`; pname.style.paddingLeft = '10px'; }
    else { pname.style.borderLeft = 'none'; pname.style.paddingLeft = ''; }

    pname.textContent = displayNameInput?.value || deps.appState.user?.displayName || deps.appState.user?.username || 'Display Name';
    puser.textContent = '@' + (nicknameInput?.value || deps.appState.user?.username || 'username');
    pabout.textContent = aboutMeInput?.value || 'About me...';

    pbadges.innerHTML = `<span class="preview-badge" title="Nitro" style="background:linear-gradient(135deg,#ff73fa,#5865f2);">N</span>`;
  }

  function populateFields() {
    const user = deps.appState.user;
    if (!user) return;
    nicknameInput.value = user.username || '';
    displayNameInput.value = user.displayName || '';
    aboutMeInput.value = user.aboutMe || '';
    statusSelect.value = STATUS_OPTIONS.includes(user.status) ? user.status : 'Online';
    avatarInput.value = user.avatar?.startsWith('http') ? user.avatar : '';

    const theme = deps.appState.profileTheme || {};
    const nameplate = deps.appState.nameplate || {};
    const decoration = deps.appState.avatarDecoration || {};

    if (bannerInput) bannerInput.value = deps.appState.profileBanner || '';
    if (primaryColorInput) primaryColorInput.value = theme.primaryColor || '#5865f2';
    if (accentColorInput) accentColorInput.value = theme.accentColor || '#3ba55d';
    if (decorationTypeInput) decorationTypeInput.value = decoration.type || '';
    if (nameplateColorInput) nameplateColorInput.value = nameplate.color || '#5865f2';

    updatePreview();
    hideError();
  }

  function open() {
    populateFields();
    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
    nicknameInput?.focus();
  }

  function close() {
    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');
    hideError();
  }

  function hideError() { if (errorEl) { errorEl.hidden = true; errorEl.textContent = ''; } }
  function showError(msg) { if (errorEl) { errorEl.textContent = msg; errorEl.hidden = false; } }

  async function saveProfile() {
    const username = nicknameInput.value.trim();
    const displayName = displayNameInput.value.trim();
    const aboutMe = aboutMeInput.value.trim();
    const status = statusSelect.value;
    const avatar = avatarInput.value.trim();

    if (username.length < 2) { showError('Username must be at least 2 characters'); return; }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    hideError();

    try {
      const profileData = {
        username, displayName, aboutMe, status,
        avatar: avatar || null,
        profileBanner: bannerInput?.value?.trim() || null,
        profileTheme: {
          primaryColor: primaryColorInput?.value || '#5865f2',
          accentColor: accentColorInput?.value || '#3ba55d',
        },
        avatarDecoration: decorationTypeInput?.value ? {
          type: decorationTypeInput.value,
          color: decorationTypeInput.value === 'ring' ? (primaryColorInput?.value || '#5865f2') : null,
          url: overlay.querySelector('#settingsDecorationUrl')?.value?.trim() || null,
        } : null,
        nameplate: {
          style: nameplateColorInput?.value ? 'colored' : 'default',
          color: nameplateColorInput?.value || null,
        },
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
      });
      localStorage.setItem('currentUser', JSON.stringify(mergedUser));
      deps.updateUserInfo();
      close();
    } catch (error) {
      showError(error.message || 'Failed to save');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
    }
  }

  return { init, open, close };
})();