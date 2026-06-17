/**
 * Discord-style Profile Modal v4 — REFACTORED
 * - BADGE_REGISTRY в appState, локальные SVG-файлы
 * - Аватар: object-fit: cover, 120×120, aspect-ratio 1/1
 * - Статус-кружок position: absolute внизу-справа
 * - Бейджи (img src из BADGE_REGISTRY) под username, выше Bio
 * - Опционально: crop иконка звонка из Lucide
 * @module ProfileModule
 */
const ProfileModule = (() => {
  /** @type {{ appState: object, fetchWithError: Function, socketEmitSafe: Function }} */
  let deps = {};

  let overlay = null;
  let currentProfileUserId = null;

  /**
   * Рендер бейджей через BADGE_REGISTRY + локальные SVG-файлы
   * @param {string[]} badgeIds — массив ID бейджей
   */
  function renderBadges(badgeIds) {
    const el = document.getElementById('profileBadges');
    if (!el) return;
    el.innerHTML = '';
    if (!badgeIds || badgeIds.length === 0) {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'flex';

    const registry = deps.appState?.BADGE_REGISTRY || {};

    badgeIds.forEach(id => {
      const badgeData = registry[id];
      if (!badgeData) return;

      const badgeEl = document.createElement('div');
      badgeEl.className = 'badge-icon';
      badgeEl.title = badgeData.description || badgeData.name;

      // Используем <img> с путём к локальному SVG-файлу
      const img = document.createElement('img');
      img.src = badgeData.path;
      img.alt = badgeData.name;
      img.width = 24;
      img.height = 24;
      img.loading = 'lazy';
      img.draggable = false;
      img.onerror = function () {
        this.style.display = 'none';
        badgeEl.textContent = badgeData.name.charAt(0);
      };

      badgeEl.appendChild(img);
      el.appendChild(badgeEl);
    });
  }

  function init(dependencies) {
    deps = dependencies;
    buildModal();
    bindEvents();
  }

  function buildModal() {
    if (document.getElementById('profileModalOverlay')) return;

    overlay = document.createElement('div');
    overlay.id = 'profileModalOverlay';
    overlay.className = 'profile-modal-overlay';
    overlay.setAttribute('aria-hidden', 'true');

    overlay.innerHTML = `
      <div class="profile-modal" role="dialog">
        <button type="button" class="profile-modal-close" aria-label="Close">&times;</button>
        <div class="profile-modal-banner" id="profileBanner"></div>
        <div class="profile-modal-avatar-container" id="profileAvatarContainer">
          <div class="profile-modal-avatar-decoration" id="profileAvatarDecoration"></div>
          <div class="profile-modal-avatar" id="profileAvatar">U</div>
          <div class="profile-modal-status" id="profileStatus">Online</div>
        </div>
        <div class="profile-modal-body">
          <div class="profile-modal-name-row" id="profileNameplate">
            <h2 class="profile-modal-displayname" id="profileDisplayName">Display Name</h2>
            <span class="profile-modal-username" id="profileUsername">@username</span>
            <div class="profile-modal-badges" id="profileBadges"></div>
          </div>
          <div class="profile-modal-divider"></div>
          <div class="profile-modal-section">
            <div class="profile-modal-section-title">About Me</div>
            <p class="profile-modal-bio" id="profileAboutMe">No description set.</p>
          </div>
          <div class="profile-modal-section" id="profileRoleSection" style="display:none;">
            <div class="profile-modal-section-title">Role</div>
            <div class="profile-role-badge" id="profileRoleBadge">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#faa61a"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              <span>Group Owner</span>
            </div>
          </div>
          <div class="profile-modal-actions" id="profileActions">
            <button class="profile-btn profile-btn-primary" id="profileEditBtn" style="display:none;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
              Edit Profile
            </button>
            <button class="profile-btn profile-btn-secondary" id="profileAddFriendBtn" style="display:none;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
              Add Friend
            </button>
            <button class="profile-btn profile-btn-danger" id="profileRemoveFriendBtn" style="display:none;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M14 8c0-2.21-1.79-4-4-4S6 5.79 6 8s1.79 4 4 4 4-1.79 4-4zm-6 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zM2 18v2h16v-2c0-2.66-5.33-4-8-4s-8 1.34-8 4zm2 0c.2-.71 3.3-2 6-2 2.69 0 5.78 1.28 6 2H4z"/></svg>
              Remove Friend
            </button>
            <button class="profile-btn profile-btn-secondary" id="profileMessageBtn" style="display:none;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/></svg>
              Message
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
  }

  function bindEvents() {
    overlay.querySelector('.profile-modal-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('visible')) close();
    });
  }

  function applyProfileTheme(theme) {
    const modal = overlay.querySelector('.profile-modal');
    if (!theme) return;
    modal.style.setProperty('--profile-primary', theme.primaryColor || '#5865f2');
    modal.style.setProperty('--profile-accent', theme.accentColor || '#3ba55d');
  }

  function setBanner(bannerUrl) {
    const el = document.getElementById('profileBanner');
    if (!el) return;
    if (bannerUrl) {
      el.style.backgroundImage = `url(${bannerUrl})`;
      el.style.display = 'block';
    } else {
      el.style.backgroundImage = '';
      el.style.display = 'none';
    }
  }

  function setAvatarDecoration(decoration) {
    const decorEl = document.getElementById('profileAvatarDecoration');
    if (!decorEl) return;
    if (decoration && decoration.type === 'ring') {
      decorEl.style.cssText = `border:3px solid ${decoration.color||'#5865f2'};width:132px;height:132px;border-radius:50%;position:absolute;top:-6px;left:-6px;background:transparent;display:block;box-shadow:0 0 16px ${decoration.color||'#5865f2'}44`;
    } else if (decoration && decoration.url) {
      decorEl.style.cssText = `background-image:url(${decoration.url});background-size:cover;width:140px;height:140px;border-radius:50%;position:absolute;top:-10px;left:-10px;display:block`;
    } else {
      decorEl.style.display = 'none';
    }
  }

  function applyNameplate(nameplate) {
    const row = document.getElementById('profileNameplate');
    if (!row || !nameplate) return;
    if (nameplate.color) {
      row.style.paddingLeft = '12px';
      row.style.borderLeft = `3px solid ${nameplate.color}`;
    } else {
      row.style.paddingLeft = '';
      row.style.borderLeft = 'none';
    }
  }

  async function open(userId, userData) {
    currentProfileUserId = userId;
    let user = userData;

    if (!user) {
      try {
        const allUsers = await deps.fetchWithError('/api/users');
        user = allUsers.find(u => String(u.id) === String(userId));
      } catch (error) {
        console.error('[Profile] Fetch error:', error);
        return;
      }
    }
    if (!user) return;

    const avatarEl = document.getElementById('profileAvatar');
    const statusEl = document.getElementById('profileStatus');
    const displayNameEl = document.getElementById('profileDisplayName');
    const usernameEl = document.getElementById('profileUsername');
    const aboutMeEl = document.getElementById('profileAboutMe');
    const editBtn = document.getElementById('profileEditBtn');
    const addFriendBtn = document.getElementById('profileAddFriendBtn');
    const removeFriendBtn = document.getElementById('profileRemoveFriendBtn');
    const messageBtn = document.getElementById('profileMessageBtn');
    const roleSection = document.getElementById('profileRoleSection');

    // Аватар — через object-fit: cover
    const letter = (user.displayName || user.username || 'U').charAt(0).toUpperCase();
    if (user.avatar && user.avatar.startsWith('http')) {
      avatarEl.innerHTML = ''; // очищаем текст
      avatarEl.style.backgroundImage = `url(${user.avatar})`;
      avatarEl.style.backgroundSize = 'cover';
      avatarEl.style.backgroundPosition = 'center';
      avatarEl.style.color = 'transparent';
    } else {
      avatarEl.textContent = letter;
      avatarEl.style.backgroundImage = '';
      avatarEl.style.color = '';
    }

    // Status — цветной кружок в правом нижнем углу аватарки
    statusEl.textContent = user.status || 'Offline';
    statusEl.className = 'profile-modal-status ' + (
      user.status === 'Online' ? 'status-online' :
      user.status === 'Idle' ? 'status-idle' :
      user.status === 'DND' ? 'status-dnd' : 'status-offline'
    );

    displayNameEl.textContent = user.displayName || user.username;
    usernameEl.textContent = '@' + user.username;
    aboutMeEl.textContent = user.aboutMe || 'No description set.';

    // Banner, Decoration, Theme, Nameplate
    setBanner(user.profileBanner || deps.appState.profileBanner || null);
    setAvatarDecoration(user.avatarDecoration || deps.appState.avatarDecoration || null);
    applyProfileTheme(user.profileTheme || deps.appState.profileTheme || null);
    applyNameplate(user.nameplate || deps.appState.nameplate || null);

    // Бейджи — используем BADGE_REGISTRY + userBadges
    const badgeIds = [];
    const registry = deps.appState?.BADGE_REGISTRY || {};

    // Всегда Nitro
    if (registry['nitro']) badgeIds.push('nitro');

    // Добавляем остальные из earned
    const earnedIds = (user.userBadges || deps.appState.userBadges || []).map(b => b.badgeId || b.id);
    Object.keys(registry).forEach(id => {
      if (id !== 'nitro' && earnedIds.includes(id)) {
        badgeIds.push(id);
      }
    });

    // Dev для владельца
    if (String(user.id) === String(deps.appState.user?.id) && !badgeIds.includes('developer') && registry['developer']) {
      badgeIds.push('developer');
    }

    renderBadges(badgeIds);

    // Role section
    if (user.isGroupOwner) {
      roleSection.style.display = 'block';
      roleSection.querySelector('#profileRoleBadge span').textContent = user.roleLabel || 'Group Owner';
    } else {
      roleSection.style.display = 'none';
    }

    // Actions
    const isOwn = deps.appState.user && String(deps.appState.user.id) === String(userId);
    editBtn.style.display = isOwn ? 'flex' : 'none';

    if (!isOwn) {
      const isFriend = deps.appState.friends.some(f => String(f.id) === String(userId));
      addFriendBtn.style.display = isFriend ? 'none' : 'flex';
      removeFriendBtn.style.display = isFriend ? 'flex' : 'none';
      messageBtn.style.display = 'flex';
    } else {
      addFriendBtn.style.display = 'none';
      removeFriendBtn.style.display = 'none';
      messageBtn.style.display = 'none';
    }

    editBtn.onclick = () => { close(); if (typeof SettingsModule !== 'undefined') SettingsModule.open(); };
    addFriendBtn.onclick = async () => {
      try {
        await deps.fetchWithError('/api/friends/request', { method: 'POST', body: JSON.stringify({ friendId: userId }) });
        addFriendBtn.textContent = 'Request Sent!';
        addFriendBtn.disabled = true;
        setTimeout(() => { addFriendBtn.disabled = false; }, 2000);
      } catch (e) { console.error(e); }
    };
    removeFriendBtn.onclick = async () => {
      if (!confirm('Remove this friend?')) return;
      try {
        await deps.fetchWithError(`/api/friends/${userId}`, { method: 'DELETE' });
        close();
        if (typeof loadFriends === 'function') loadFriends();
      } catch (e) { console.error(e); }
    };
    messageBtn.onclick = () => { close(); if (typeof startDM === 'function') startDM(userId, user.username); };

    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');
    currentProfileUserId = null;
    const modal = overlay.querySelector('.profile-modal');
    if (modal) {
      modal.style.removeProperty('--profile-primary');
      modal.style.removeProperty('--profile-accent');
    }
  }

  return { init, open, close };
})();