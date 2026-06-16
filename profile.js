/**
 * Enhanced Profile Modal Module v2
 * Discord-style profile popup with:
 * - Badges (Nitro-style SVG)
 * - Avatar decorations
 * - Nameplates
 * - Profile banners
 * - Theme colors (Primary/Accent)
 * - Profile Widgets (gaming preferences)
 * - Role badges
 * @module ProfileModule
 */
const ProfileModule = (() => {
  /** @type {{ appState: object, fetchWithError: Function, socketEmitSafe: Function }} */
  let deps = {};

  let overlay = null;
  let currentProfileUserId = null;

  /**
   * SVG icon definitions for badges
   */
  const BADGE_ICONS = {
    'nitro-badge': `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="nitroGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ff73fa"/><stop offset="100%" stop-color="#5865f2"/></linearGradient></defs><path d="M12 2L2 7v10l10 5 10-5V7L12 2z" fill="url(#nitroGrad)"/><path d="M12 6l-4 2v4l4 2 4-2V8l-4-2z" fill="#fff"/><circle cx="12" cy="12" r="2" fill="#5865f2"/></svg>`,
    'nitro-classic-badge': `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="nitroClassicGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ff73fa"/><stop offset="100%" stop-color="#9b59b6"/></linearGradient></defs><path d="M12 3L3 8v8l9 5 9-5V8l-9-5z" fill="url(#nitroClassicGrad)"/><path d="M12 7l-3 1.5v3l3 1.5 3-1.5v-3L12 7z" fill="#fff"/></svg>`,
    'booster-badge': `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="boostGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ff73fa"/><stop offset="100%" stop-color="#f47fff"/></linearGradient></defs><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="url(#boostGrad)"/></svg>`,
    'dev-badge': `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7v10l10 5 10-5V7L12 2zm3.5 13.5l-4-4 4-4L14 6l-5 5 5 5 1.5-1.5z" fill="#5865f2"/></svg>`,
    'mod-badge': `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" fill="#43b581"/></svg>`,
    'verified-badge': `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" fill="#3ba55d"/></svg>`,
    'early-badge': `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" fill="#faa61a"/></svg>`,
  };

  /**
   * Returns SVG HTML for a badge icon.
   * @param {string} iconName
   * @returns {string}
   */
  function getBadgeSVG(iconName) {
    return BADGE_ICONS[iconName] || '';
  }

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
   * Inject profile modal markup into the document.
   */
  function buildModal() {
    if (document.getElementById('profileModalOverlay')) return;

    overlay = document.createElement('div');
    overlay.id = 'profileModalOverlay';
    overlay.className = 'profile-modal-overlay';
    overlay.setAttribute('aria-hidden', 'true');

    overlay.innerHTML = `
      <div class="profile-modal" role="dialog" aria-labelledby="profileModalTitle">
        <button type="button" class="profile-modal-close" aria-label="Close">&times;</button>
        <!-- Banner -->
        <div class="profile-modal-banner" id="profileBanner"></div>
        <!-- Avatar + Decoration -->
        <div class="profile-modal-avatar-container" id="profileAvatarContainer">
          <div class="profile-modal-avatar-decoration" id="profileAvatarDecoration"></div>
          <div class="profile-modal-avatar" id="profileAvatar">U</div>
          <div class="profile-modal-status" id="profileStatus">Online</div>
        </div>
        <!-- Badges Row -->
        <div class="profile-modal-badges" id="profileBadges"></div>
        <!-- Body -->
        <div class="profile-modal-body">
          <div class="profile-modal-name-row" id="profileNameplate">
            <h2 class="profile-modal-displayname" id="profileDisplayName">Display Name</h2>
            <span class="profile-modal-username" id="profileUsername">@username</span>
          </div>
          <div class="profile-modal-divider"></div>
          <!-- About Me -->
          <div class="profile-modal-section">
            <div class="profile-modal-section-title">About Me</div>
            <p class="profile-modal-bio" id="profileAboutMe">No description set.</p>
          </div>
          <!-- Profile Widgets (Gaming) -->
          <div class="profile-modal-section" id="profileWidgetsSection">
            <div class="profile-modal-section-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21 6H3C1.9 6 1 6.9 1 8v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 10H3V8h18v8zM6 15h2v-2h2v-2H8V9H6v2H4v2h2v2z"/></svg>
              Profile Widgets
            </div>
            <div class="profile-widgets-list" id="profileWidgetsList">
              <div class="profile-widget-empty">No widgets set.</div>
            </div>
          </div>
          <!-- Role / Owner Crown for Group DMs -->
          <div class="profile-modal-section" id="profileRoleSection" style="display:none;">
            <div class="profile-modal-section-title">Role</div>
            <div class="profile-role-badge" id="profileRoleBadge">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#faa61a"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              <span>Group Owner</span>
            </div>
          </div>
          <!-- Actions -->
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

  /**
   * Bind modal events.
   */
  function bindEvents() {
    overlay.querySelector('.profile-modal-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('visible')) {
        close();
      }
    });
  }

  /**
   * Apply profile theme colors to the modal.
   * @param {object} theme - { primaryColor, accentColor }
   */
  function applyProfileTheme(theme) {
    const modal = overlay.querySelector('.profile-modal');
    if (!theme) return;
    modal.style.setProperty('--profile-primary', theme.primaryColor || '#5865f2');
    modal.style.setProperty('--profile-accent', theme.accentColor || '#3ba55d');
  }

  /**
   * Set profile banner.
   * @param {string|null} bannerUrl
   */
  function setBanner(bannerUrl) {
    const bannerEl = document.getElementById('profileBanner');
    if (!bannerEl) return;
    if (bannerUrl) {
      bannerEl.style.backgroundImage = `url(${bannerUrl})`;
      bannerEl.style.display = 'block';
    } else {
      bannerEl.style.backgroundImage = '';
      bannerEl.style.display = 'none';
    }
  }

  /**
   * Set avatar decoration.
   * @param {object|null} decoration - { type, color, url }
   */
  function setAvatarDecoration(decoration) {
    const decorEl = document.getElementById('profileAvatarDecoration');
    if (!decorEl) return;
    if (decoration && decoration.type === 'ring') {
      decorEl.style.border = `3px solid ${decoration.color || '#5865f2'}`;
      decorEl.style.width = '96px';
      decorEl.style.height = '96px';
      decorEl.style.borderRadius = '50%';
      decorEl.style.position = 'absolute';
      decorEl.style.top = '-4px';
      decorEl.style.left = '-4px';
      decorEl.style.background = 'transparent';
      decorEl.style.display = 'block';
      decorEl.style.boxShadow = `0 0 12px ${decoration.color || '#5865f2'}44`;
    } else if (decoration && decoration.url) {
      decorEl.style.backgroundImage = `url(${decoration.url})`;
      decorEl.style.backgroundSize = 'cover';
      decorEl.style.width = '100px';
      decorEl.style.height = '100px';
      decorEl.style.borderRadius = '50%';
      decorEl.style.position = 'absolute';
      decorEl.style.top = '-6px';
      decorEl.style.left = '-6px';
      decorEl.style.display = 'block';
    } else {
      decorEl.style.display = 'none';
    }
  }

  /**
   * Render badges.
   * @param {Array} badges - Array of badge objects
   */
  function renderBadges(badges) {
    const badgesEl = document.getElementById('profileBadges');
    if (!badgesEl) return;
    badgesEl.innerHTML = '';
    if (!badges || badges.length === 0) {
      badgesEl.style.display = 'none';
      return;
    }
    badgesEl.style.display = 'flex';
    badges.forEach(badge => {
      const badgeEl = document.createElement('div');
      badgeEl.className = 'profile-badge';
      badgeEl.title = badge.description || badge.name;
      // Use SVG if available, otherwise fallback to text
      const svg = getBadgeSVG(badge.icon);
      if (svg) {
        badgeEl.innerHTML = svg;
      } else {
        badgeEl.textContent = badge.name.charAt(0);
      }
      badgesEl.appendChild(badgeEl);
    });
  }

  /**
   * Render profile widgets (gaming preferences).
   * @param {Array} widgets - Array of widget objects
   */
  function renderWidgets(widgets) {
    const listEl = document.getElementById('profileWidgetsList');
    const sectionEl = document.getElementById('profileWidgetsSection');
    if (!listEl || !sectionEl) return;
    listEl.innerHTML = '';
    if (!widgets || widgets.length === 0) {
      listEl.innerHTML = '<div class="profile-widget-empty">No widgets set.</div>';
      return;
    }
    widgets.forEach(widget => {
      const widgetEl = document.createElement('div');
      widgetEl.className = 'profile-widget-item';
      widgetEl.innerHTML = `
        <div class="profile-widget-icon">
          ${widget.icon 
            ? `<img src="${widget.icon}" alt="${widget.title}" />` 
            : `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M21 6H3C1.9 6 1 6.9 1 8v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 10H3V8h18v8z"/></svg>`
          }
        </div>
        <div class="profile-widget-info">
          <div class="profile-widget-title">${widget.title}</div>
          <div class="profile-widget-description">${widget.description || ''}</div>
        </div>
        ${widget.url ? `<a href="${widget.url}" class="profile-widget-link" target="_blank">${widget.type === 'game' ? 'Play' : 'Visit'}</a>` : ''}
      `;
      listEl.appendChild(widgetEl);
    });
  }

  /**
   * Apply nameplate style to display name.
   * @param {object} nameplate - { style, color }
   */
  function applyNameplate(nameplate) {
    const nameRow = document.getElementById('profileNameplate');
    if (!nameRow || !nameplate) return;
    nameRow.style.borderLeft = nameplate.color ? `3px solid ${nameplate.color}` : 'none';
    nameRow.style.paddingLeft = nameplate.color ? '12px' : '';
  }

  /**
   * Open profile for a given user.
   * @param {number|string} userId
   * @param {object} userData - Extended profile data
   */
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

    // Set avatar
    const avatarLetter = (user.displayName || user.username || 'U').charAt(0).toUpperCase();
    avatarEl.textContent = user.avatar && user.avatar.startsWith('http') ? '' : avatarLetter;
    if (user.avatar && user.avatar.startsWith('http')) {
      avatarEl.style.backgroundImage = `url(${user.avatar})`;
      avatarEl.style.backgroundSize = 'cover';
      avatarEl.style.backgroundPosition = 'center';
      avatarEl.style.color = 'transparent';
    } else {
      avatarEl.style.backgroundImage = '';
      avatarEl.style.color = '';
    }

    // Status
    statusEl.textContent = user.status || 'Offline';
    statusEl.className = 'profile-modal-status ' + (user.status === 'Online' ? 'status-online' : user.status === 'Idle' ? 'status-idle' : user.status === 'DND' ? 'status-dnd' : 'status-offline');

    // Display name and username
    displayNameEl.textContent = user.displayName || user.username;
    usernameEl.textContent = '@' + user.username;

    // About Me
    aboutMeEl.textContent = user.aboutMe || 'No description set.';

    // ---- NEW PROFILE FEATURES ----

    // 1. Banner
    setBanner(user.profileBanner || deps.appState.profileBanner || null);

    // 2. Avatar Decoration
    setAvatarDecoration(user.avatarDecoration || deps.appState.avatarDecoration || null);

    // 3. Profile Theme
    applyProfileTheme(user.profileTheme || deps.appState.profileTheme || null);

    // 4. Nameplate
    applyNameplate(user.nameplate || deps.appState.nameplate || null);

    // 5. Badges - merge system badges with user's earned badges
    const allBadges = [];
    if (deps.appState.badges) {
      // Show some badges as demo if user has none
      const earnedBadgeIds = (user.userBadges || deps.appState.userBadges || []).map(b => b.badgeId || b.id);
      deps.appState.badges.forEach(b => {
        if (earnedBadgeIds.includes(b.id)) {
          allBadges.push(b);
        }
      });
      // Always show developer badge for current user for demo
      if (String(user.id) === String(deps.appState.user?.id) && !allBadges.find(b => b.id === 'developer')) {
        const devBadge = deps.appState.badges.find(b => b.id === 'developer');
        if (devBadge) allBadges.push(devBadge);
      }
    }
    // If no badges earned, show first two as "sample"
    if (allBadges.length === 0 && deps.appState.badges) {
      allBadges.push(deps.appState.badges[0]); // Nitro
      allBadges.push(deps.appState.badges[2]); // Booster
    }
    renderBadges(allBadges);

    // 6. Profile Widgets
    const userWidgets = user.profileWidgets || deps.appState.profileWidgets || [];
    renderWidgets(userWidgets);

    // 7. Role section for group DMs
    if (user.isGroupOwner) {
      roleSection.style.display = 'block';
      roleSection.querySelector('#profileRoleBadge span').textContent = user.roleLabel || 'Group Owner';
    } else {
      roleSection.style.display = 'none';
    }

    // Actions visibility
    const isOwnProfile = deps.appState.user && String(deps.appState.user.id) === String(userId);
    editBtn.style.display = isOwnProfile ? 'flex' : 'none';

    if (!isOwnProfile) {
      const isFriend = deps.appState.friends.some(f => String(f.id) === String(userId));
      addFriendBtn.style.display = isFriend ? 'none' : 'flex';
      removeFriendBtn.style.display = isFriend ? 'flex' : 'none';
      messageBtn.style.display = 'flex';
    } else {
      addFriendBtn.style.display = 'none';
      removeFriendBtn.style.display = 'none';
      messageBtn.style.display = 'none';
    }

    // Bind actions
    editBtn.onclick = () => {
      close();
      if (typeof SettingsModule !== 'undefined' && SettingsModule.open) {
        SettingsModule.open();
      }
    };

    addFriendBtn.onclick = async () => {
      try {
        await deps.fetchWithError('/api/friends/request', {
          method: 'POST',
          body: JSON.stringify({ friendId: userId })
        });
        addFriendBtn.textContent = 'Request Sent!';
        addFriendBtn.disabled = true;
        setTimeout(() => { addFriendBtn.disabled = false; }, 2000);
      } catch (error) {
        console.error('[Profile] Add friend error:', error);
      }
    };

    removeFriendBtn.onclick = async () => {
      if (!confirm('Remove this friend?')) return;
      try {
        await deps.fetchWithError(`/api/friends/${userId}`, {
          method: 'DELETE'
        });
        close();
        if (typeof loadFriends === 'function') {
          loadFriends();
        }
      } catch (error) {
        console.error('[Profile] Remove friend error:', error);
      }
    };

    messageBtn.onclick = () => {
      close();
      if (typeof startDM === 'function') {
        startDM(userId, user.username);
      }
    };

    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
  }

  /**
   * Close profile modal.
   */
  function close() {
    if (!overlay) return;
    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');
    currentProfileUserId = null;
    // Reset theme variables
    const modal = overlay.querySelector('.profile-modal');
    if (modal) {
      modal.style.removeProperty('--profile-primary');
      modal.style.removeProperty('--profile-accent');
    }
  }

  return { init, open, close };
})();
