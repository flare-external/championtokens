// ============================================================
//  CHAMPION TOKENS — Shared Navigation + UI Helpers
// ============================================================



/**
 * Inject the top navigation bar into the page.
 * Call after DOMContentLoaded.
 * @param {string} activePage  'dashboard' | 'matches' | 'leaderboard' | 'shop' | 'profile'
 */
function injectNav(activePage = '') {
  let isOwner = false;
  try {
    const cached = localStorage.getItem('ct_cached_discord_user');
    const parsed = cached ? JSON.parse(cached) : null;
    const curUser = (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser : null;
    const curData = (typeof currentUserData !== 'undefined') ? currentUserData : null;
    if (typeof isOwnerUser === 'function') {
      isOwner = isOwnerUser(curUser, curData) || parsed?.discordId === '1121188319410278420';
    } else {
      isOwner = parsed?.discordId === '1121188319410278420';
    }
  } catch (e) {}

  const now = new Date();
  const todayKey = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
  if (activePage === 'shop') {
    try { localStorage.setItem('ct_last_shop_viewed_day', todayKey); } catch(e) {}
  }
  let hasNewShopItems = false;
  try {
    const lastViewed = localStorage.getItem('ct_last_shop_viewed_day');
    hasNewShopItems = (activePage !== 'shop') && (lastViewed !== todayKey);
  } catch(e) {}

  const links = [
    { href: 'dashboard',   key: 'dashboard',   icon: 'layout-dashboard', label: 'Dashboard'   },
    { href: 'matches',     key: 'matches',     icon: 'swords',           label: 'Matches'     },
    { href: 'tournaments', key: 'tournaments', icon: 'crown',            label: 'Tournaments' },
    { href: 'leaderboard', key: 'leaderboard', icon: 'trophy',           label: 'Leaderboard' },
    { href: 'shop',        key: 'shop',        icon: 'shopping-bag',     label: 'Shop', hasBadge: hasNewShopItems },
  ];

  const navLinksHTML = links.map(l => `
    <a href="${l.href}" class="nav-link${activePage === l.key ? ' active' : ''}" ${l.onClick ? `onclick="${l.onClick}"` : ''}>
      <i data-lucide="${l.icon}"></i>
      <span>${l.label}</span>
      ${l.badge ? `<span class="nav-soon-badge">${l.badge}</span>` : ''}
      ${l.hasBadge ? `<span class="nav-shop-red-badge" style="background:#ef4444;color:#fff;font-size:0.66rem;font-weight:900;width:17px;height:17px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-left:4px;box-shadow:0 0 10px rgba(239,68,68,0.75);line-height:1;">1</span>` : ''}
    </a>`).join('');

  const navHTML = `
    <a href="#main-content" class="skip-to-content">Skip to main content</a>

    <!-- Top Navigation Bar (Kick.com Dark Style) -->
    <header class="top-nav" id="ct-nav">
      <div class="nav-left">
        <button class="sidebar-toggle-btn" id="btn-toggle-sidebar" onclick="toggleSidebar()" title="Toggle Sidebar">
          <i data-lucide="menu" style="width:20px;height:20px;"></i>
        </button>

        <a href="dashboard" class="brand-logo" title="Champion Tokens">
          <span class="brand-logo-champion">CHAMPION</span> <span class="brand-logo-tokens">TOKENS</span>
        </a>
      </div>

      <div class="nav-center">
        <div class="search-box" id="nav-search-box">
          <div class="search-icon">
            <i data-lucide="search" style="width:16px;height:16px;"></i>
          </div>
          <input type="text" class="search-input" id="search-input" placeholder="Search players, matches, modes..." autocomplete="off"/>
          <button class="search-clear-btn" id="search-clear-btn" style="display:none;" title="Clear search">
            <i data-lucide="x" style="width:14px;height:14px;"></i>
          </button>
          <span class="search-shortcut" id="search-shortcut-key">/</span>
          <div class="search-results-popover" id="search-results-popover">
            <div id="search-popover-content"></div>
          </div>
        </div>
      </div>

      <div class="nav-right">
        <!-- Notification Bell -->
        <div class="nav-notif-container" id="nav-notif-container">
          <button class="nav-notif-btn" aria-label="Notifications" id="nav-notif-btn" onclick="toggleNotifDropdown(event)" title="Notifications">
            <i data-lucide="bell"></i>
            <span class="nav-notif-badge" id="nav-notif-badge" style="display:none;">0</span>
          </button>
          <div class="nav-notif-dropdown" id="nav-notif-dropdown">
            <div class="nav-notif-header">
              <span style="font-weight:800;font-size:0.9rem;color:#fff;">Notifications</span>
              <button class="nav-notif-mark-read" onclick="handleMarkAllRead()">Mark all read</button>
            </div>
            <div id="nav-notif-list">
              <div class="nav-notif-empty">
                <i data-lucide="bell-off" style="width:28px;height:28px;color:var(--text-faint);margin-bottom:8px;"></i>
                <div>No notifications yet</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Profile Avatar with Dropdown Menu -->
        <div class="nav-profile-menu-container">
          <div class="nav-profile-btn" aria-label="Open User Account Menu" role="button" tabindex="0" id="nav-profile-btn" onclick="toggleNavProfileDropdown(event)" title="Account Menu">
            <div class="nav-avatar-wrap">
              <img id="nav-avatar-img" src="" alt="" style="display:none"/>
              <i data-lucide="user" id="nav-avatar-icon"></i>
            </div>
          </div>

          <div class="nav-dropdown-menu" id="nav-profile-dropdown">
            <div class="nav-dropdown-header">
              <div style="font-weight:800;font-size:0.92rem;color:#fff;" id="nav-menu-username">Player</div>
              <div style="font-size:0.75rem;color:var(--text-muted);" id="nav-menu-handle">@user</div>
            </div>
            <a href="profile?tab=overview" class="nav-dropdown-item">
              <i data-lucide="user"></i> My Profile
            </a>
            <a href="matches" class="nav-dropdown-item">
              <i data-lucide="swords"></i> Matches
            </a>
            <a href="profile?tab=connections" class="nav-dropdown-item">
              <i data-lucide="link-2"></i> Connections
            </a>
            <div class="nav-dropdown-divider"></div>
            <a href="admin" class="nav-dropdown-item" id="nav-admin-link" style="display:none;color:var(--red);">
              <i data-lucide="shield-check" style="color:var(--red);"></i> Admin Panel
            </a>
            <div class="nav-dropdown-item danger-highlight" onclick="handleSignOut()">
              <i data-lucide="log-out" style="color:#ef4444;"></i> Sign Out
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- Left Sidebar (Kick Theme + Lucide Icons) -->
    <aside class="sidebar" id="app-sidebar">
      <div class="sidebar-nav-section">
        <!-- Dashboard -->
        <a href="dashboard" class="nav-link ${activePage === 'dashboard' ? 'active' : ''}" title="Dashboard">
          <i data-lucide="layout-dashboard"></i>
          <span class="nav-link-text">Dashboard</span>
        </a>

        <!-- Matches -->
        <a href="matches" class="nav-link ${activePage === 'matches' ? 'active' : ''}" title="Matches">
          <i data-lucide="swords"></i>
          <span class="nav-link-text">Matches</span>
        </a>

        <!-- Tournaments -->
        <a href="tournaments" class="nav-link ${activePage === 'tournaments' ? 'active' : ''}" title="Tournaments">
          <i data-lucide="crown"></i>
          <span class="nav-link-text">Tournaments</span>
        </a>

        <!-- Leaderboard -->
        <a href="leaderboard" class="nav-link ${activePage === 'leaderboard' ? 'active' : ''}" title="Leaderboard">
          <i data-lucide="trophy"></i>
          <span class="nav-link-text">Leaderboard</span>
        </a>

        <!-- Profile -->
        <a href="profile" class="nav-link ${activePage === 'profile' ? 'active' : ''}" title="Profile">
          <i data-lucide="user"></i>
          <span class="nav-link-text">Profile</span>
        </a>
      </div>
    </aside>

    <!-- Floating Active Match Indicator Widget -->
    <a href="#" id="nav-active-match-banner" class="active-match-floating-banner" style="display:none;" title="Active Match · Click to open room">
      <img id="nav-active-match-img" src="realistic.jpeg" class="active-match-banner-thumb" alt="Map" />
      <div class="active-match-banner-info">
        <div class="active-match-banner-top">
          <span class="active-match-banner-title" id="nav-active-match-title">Realistic · 1v1</span>
          <span class="active-match-banner-players" id="nav-active-match-players">1/2</span>
        </div>
        <div class="active-match-banner-status" id="nav-active-match-status">Waiting for player(s)...</div>
      </div>
      <div class="active-match-banner-action">
        <i data-lucide="arrow-up-right" style="width:16px;height:16px;"></i>
      </div>
    </a>`;

  document.body.insertAdjacentHTML('afterbegin', navHTML);

  // Restore sidebar state
  try {
    if (localStorage.getItem('ct_sidebar_collapsed') === '1' && window.innerWidth > 768) {
      document.getElementById('app-sidebar')?.classList.add('collapsed');
      document.body.classList.add('sidebar-collapsed');
    }
  } catch (e) {}

  // Setup search controller
  setupNavSearch();

  injectFloatingIcons();
  lucide.createIcons();

  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    const profileDropdown = document.getElementById('nav-profile-dropdown');
    const profileBtn = document.getElementById('nav-profile-btn');
    const notifDropdown = document.getElementById('nav-notif-dropdown');
    const notifBtn = document.getElementById('nav-notif-btn');

    if (profileDropdown && profileDropdown.classList.contains('open')) {
      if (!profileDropdown.contains(e.target) && !profileBtn.contains(e.target)) {
        profileDropdown.classList.remove('open');
      }
    }
    if (notifDropdown && notifDropdown.classList.contains('open')) {
      if (!notifDropdown.contains(e.target) && !notifBtn.contains(e.target)) {
        notifDropdown.classList.remove('open');
      }
    }
  });

  // Populate balance + avatar + admin link + notifications from Firestore in real-time
  auth.onAuthStateChanged(async (user) => {
    if (!user) return;
    db.collection('users').doc(user.uid).onSnapshot((snap) => {
      if (!snap.exists) return;
      const data = snap.data();

      // Real-time Ban Check
      if (data.banned) {
        showBannedScreen(data);
      } else {
        const bannedEl = document.getElementById('ct-banned-screen');
        if (bannedEl) bannedEl.remove();
      }

      // Balance (2 decimals)
      const balEl = document.getElementById('nav-balance');
      if (balEl) balEl.textContent = formatTokens(data.tokens);

      // Avatar
      const img  = document.getElementById('nav-avatar-img');
      const icon = document.getElementById('nav-avatar-icon');
      const pfp = data.photoURL || 'cosmetics/uncomon/uncomon.png';
      if (img && icon) {
        img.src = encodeURI(pfp);
        img.style.display = 'block';
        icon.style.display = 'none';
      }

      // Username in dropdown
      let displayName = data.displayName;
      if (!displayName || displayName === 'Champion' || displayName === 'Player') {
        displayName = data.discordUsername || user.displayName || 'Player';
      }
      const menuName = document.getElementById('nav-menu-username');
      const menuHandle = document.getElementById('nav-menu-handle');
      if (menuName) menuName.textContent = displayName;
      if (menuHandle) menuHandle.textContent = data.discordUsername ? `@${data.discordUsername}` : (data.email || `@${user.uid.slice(0, 8)}`);

      // Admin link — show if isAdmin flag OR hardcoded Discord ID OR staff tier
      const adminLink = document.getElementById('nav-admin-link');
      if (adminLink) {
        const discordId = data.discordId || snap.id.replace('discord:', '');
        const isStaff = data.isAdmin === true || ['1121188319410278420'].includes(discordId) || (typeof getStaffTier === 'function' && getStaffTier(user, data) !== 'none');
        if (isStaff) adminLink.style.display = 'flex';
      }
    });

    // Real-time notifications
    if (typeof subscribeNotifications === 'function') {
      subscribeNotifications(user.uid, (notifs) => {
        renderNavNotifications(user.uid, notifs);
      });
    }

    // Map Thumbnails map
    const mapThumbnails = {
      'Realistic': 'realistic.jpeg',
      'Zone Wars': 'zonewars.jpeg',
      'Box Fights': 'boxfights.jpeg'
    };

    // Live Active Match tracker (Floating Banner)
    db.collection('matches')
      .where('playerUids', 'array-contains', user.uid)
      .onSnapshot((querySnap) => {
        const banner    = document.getElementById('nav-active-match-banner');
        const imgEl     = document.getElementById('nav-active-match-img');
        const titleEl   = document.getElementById('nav-active-match-title');
        const playersEl = document.getElementById('nav-active-match-players');
        const statusEl  = document.getElementById('nav-active-match-status');
        if (!banner) return;

        const currentParams = new URLSearchParams(window.location.search);
        const currentMatchId = currentParams.get('id') || '';
        const isMatchRoomPage = window.location.pathname.endsWith('match') || window.location.pathname.endsWith('match.html');

        let activeMatch = null;
        querySnap.forEach((doc) => {
          const m = { id: doc.id, ...doc.data() };
          const isFinished = m.status === 'completed' || m.status === 'cancelled' || m.isExpired === true || !!m.winner;
          const isActive = (m.status === 'waiting' || m.status === 'in_progress') && !isFinished;
          
          if (isActive) {
            if (!activeMatch || (m.status === 'in_progress' && activeMatch.status !== 'in_progress')) {
              activeMatch = m;
            }
          }
        });

        // Hide floating banner if no active match OR if user is already inside that match room
        if (activeMatch && !(isMatchRoomPage && (currentMatchId === activeMatch.id || currentParams.get('code') === activeMatch.code))) {
          const mode = activeMatch.mode || 'Realistic';
          const size = activeMatch.size || '1v1';
          const maxPlayers = activeMatch.maxPlayers || (size === '1v1' ? 2 : size === '2v2' ? 4 : 6);
          const playersCount = activeMatch.players?.length || 1;
          const isInProgress = activeMatch.status === 'in_progress';
          const allReady = activeMatch.players && activeMatch.players.length === maxPlayers && activeMatch.players.every(p => p.ready);

          banner.href = `match?id=${activeMatch.id}`;
          banner.title = `Active Match: ${mode} · ${size} (${isInProgress ? 'In Progress' : 'Waiting in Lobby'}) · Click to open`;

          if (imgEl) {
            imgEl.src = mapThumbnails[mode] || 'realistic.jpeg';
            imgEl.alt = mode;
          }
          if (titleEl) {
            titleEl.textContent = `${mode} · ${size}`;
          }
          if (playersEl) {
            playersEl.textContent = `${playersCount}/${maxPlayers}`;
          }

          if (statusEl) {
            if (isInProgress) {
              statusEl.textContent = 'Match in progress · Playing';
            } else if (playersCount < maxPlayers) {
              statusEl.textContent = 'Waiting for player(s)...';
            } else if (!allReady) {
              statusEl.textContent = 'Waiting to ready up...';
            } else {
              statusEl.textContent = 'Starting match...';
            }
          }

          if (isInProgress) {
            banner.classList.add('in-progress');
          } else {
            banner.classList.remove('in-progress');
          }

          banner.style.display = 'flex';
          if (window.lucide) lucide.createIcons();
        } else {
          banner.style.display = 'none';
        }
      }, (err) => {
        console.warn('Active match listener error:', err);
      });
  });
}

/**
 * Functional Searchbar Controller for Kick.com Theme Navigation
 */
function setupNavSearch() {
  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear-btn');
  const popover = document.getElementById('search-results-popover');
  const popoverContent = document.getElementById('search-popover-content');
  if (!searchInput || !popover || !popoverContent) return;

  const NAV_SEARCH_ITEMS = [
    { category: 'Quick Navigation', label: 'Player Dashboard', sub: 'Stats & Overview', href: 'dashboard', icon: 'layout-dashboard' },
    { category: 'Quick Navigation', label: 'Live Matches & Arenas', sub: 'Open Lobbies', href: 'matches', icon: 'swords' },
    { category: 'Quick Navigation', label: 'Competitive Leaderboard', sub: 'Global Rankings', href: 'leaderboard', icon: 'trophy' },
    { category: 'Quick Navigation', label: 'Tournaments & Cups', sub: 'Championships', href: 'tournaments', icon: 'crown' },
    { category: 'Quick Navigation', label: 'My Profile & Connections', sub: 'Account Settings', href: 'profile', icon: 'user' },
    { category: 'Quick Navigation', label: 'Competitive Rules', sub: 'Regulations', href: 'rules', icon: 'shield-check' },
    { category: 'Popular Modes', label: 'Realistic 1v1', sub: 'Finest Map', href: 'matches?filter=realistic', icon: 'target' },
    { category: 'Popular Modes', label: 'Box Fights', sub: 'Speed Arena', href: 'matches?filter=box', icon: 'box' },
    { category: 'Popular Modes', label: 'Zone Wars', sub: 'Endgame 2v2', href: 'matches?filter=zonewars', icon: 'flame' },
    { category: 'Regions', label: 'Europe (EU)', sub: 'Server Region', href: 'matches?filter=EU', icon: 'globe' },
    { category: 'Regions', label: 'North America (NA)', sub: 'Server Region', href: 'matches?filter=NA', icon: 'globe' }
  ];

  let selectedIndex = -1;
  let playerSearchDebounce = null;
  const cachedPlayersMap = new Map();

  function escapeNavText(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function fetchPlayersForQuery(qStr) {
    const clean = (qStr || '').trim();
    if (clean.length < 2) return [];
    const low = clean.toLowerCase();
    if (cachedPlayersMap.has(low)) return cachedPlayersMap.get(low);

    let list = [];
    if (typeof searchUsers === 'function') {
      try {
        const res = await searchUsers(clean);
        if (Array.isArray(res) && res.length > 0) list = res;
      } catch (e) {}
    }

    if (list.length === 0 && typeof db !== 'undefined' && db && typeof db.collection === 'function') {
      try {
        const prefixes = [clean, clean.charAt(0).toUpperCase() + clean.slice(1), clean.toLowerCase()];
        const res = [];
        const seen = new Set();
        for (const p of prefixes) {
          const snap = await db.collection('users')
            .where('displayName', '>=', p)
            .where('displayName', '<=', p + '\uf8ff')
            .limit(6).get();
          snap.docs.forEach(doc => {
            if (!seen.has(doc.id)) {
              seen.add(doc.id);
              res.push({ id: doc.id, ...doc.data() });
            }
          });
          if (res.length >= 6) break;
        }
        list = res;
      } catch (e) {}
    }

    cachedPlayersMap.set(low, list.slice(0, 6));
    return list.slice(0, 6);
  }

  function renderSearch(query, foundPlayers = null) {
    const q = (query || '').trim().toLowerCase();
    let html = '';

    if (!q) {
      html += '<div class="search-group-title"><i data-lucide="compass" style="width:12px;height:12px;"></i> Quick Navigation</div>';
      NAV_SEARCH_ITEMS.slice(0, 6).forEach((item, idx) => {
        html += `
          <a href="${item.href}" class="search-result-item" data-index="${idx}">
            <span class="search-result-icon"><i data-lucide="${item.icon}"></i></span>
            <span>${item.label}</span>
            <span class="search-result-sub">${item.sub}</span>
          </a>`;
      });
      html += '<div class="search-group-title" style="margin-top:6px;"><i data-lucide="gamepad-2" style="width:12px;height:12px;"></i> Popular Gamemodes</div>';
      NAV_SEARCH_ITEMS.slice(6, 9).forEach((item, idx) => {
        html += `
          <a href="${item.href}" class="search-result-item" data-index="${idx + 6}">
            <span class="search-result-icon"><i data-lucide="${item.icon}"></i></span>
            <span>${item.label}</span>
            <span class="search-result-sub">${item.sub}</span>
          </a>`;
      });
    } else {
      const pageMatches = NAV_SEARCH_ITEMS.filter(it => 
        it.label.toLowerCase().includes(q) || 
        it.sub.toLowerCase().includes(q) ||
        it.category.toLowerCase().includes(q)
      );

      const isOnMatches = window.location.pathname.includes('matches');
      if (isOnMatches && typeof allMatches !== 'undefined' && Array.isArray(allMatches)) {
        const count = allMatches.filter(m => {
          const title = (m.title || '').toLowerCase();
          const host = (m.hostName || '').toLowerCase();
          const code = (m.code || '').toLowerCase();
          const mode = (m.mode || '').toLowerCase();
          return title.includes(q) || host.includes(q) || code.includes(q) || mode.includes(q);
        }).length;
        html += `
          <div class="search-group-title"><i data-lucide="swords" style="width:12px;height:12px;"></i> Matches on page (${count})</div>
          <div style="padding:6px 12px 10px;font-size:0.8rem;color:var(--kick-green);font-weight:700;">
            Filtering active lobbies live on screen...
          </div>`;
      } else {
        html += `
          <a href="matches?q=${encodeURIComponent(q)}" class="search-result-item" data-index="0" style="border:1px solid rgba(83,252,24,0.3);background:rgba(83,252,24,0.06);">
            <span class="search-result-icon" style="color:var(--kick-green);"><i data-lucide="search"></i></span>
            <span>Search live matches for "<strong>${escapeNavText(q)}</strong>"</span>
            <span class="search-result-sub">Open Lobbies &rarr;</span>
          </a>`;
      }

      // ── Players Section ──
      const players = foundPlayers !== null ? foundPlayers : (cachedPlayersMap.get(q) || null);
      if (players && players.length > 0) {
        html += `<div class="search-group-title" style="margin-top:6px;"><i data-lucide="users" style="width:12px;height:12px;"></i> Players (${players.length})</div>`;
        players.forEach((p, idx) => {
          const name = escapeNavText(p.displayName || p.discordUsername || 'Player');
          const epic = escapeNavText(p.epicUsername || '');
          const avatar = p.photoURL ? `<img src="${escapeNavText(p.photoURL)}" class="player-result-avatar" onerror="this.onerror=null;this.parentElement.innerHTML='<div class=\\'player-result-avatar-fallback\\'>${name.charAt(0).toUpperCase()}</div>';"/>` : `<div class="player-result-avatar-fallback">${name.charAt(0).toUpperCase()}</div>`;
          html += `
            <a href="profile?uid=${encodeURIComponent(p.id)}" class="search-result-item player-result-item" data-index="${idx + 10}">
              <span class="search-result-icon">${avatar}</span>
              <div class="player-result-details">
                <div class="player-result-name">${name}</div>
                <div class="player-result-meta">
                  ${epic ? `<span><i data-lucide="gamepad-2" style="width:11px;height:11px;"></i> ${epic}</span>` : ''}
                  <span><i data-lucide="trophy" style="width:11px;height:11px;color:var(--kick-green);"></i> ${p.matchesWon || 0} Wins</span>
                </div>
              </div>
              <span class="search-result-sub" style="color:var(--kick-green);font-weight:700;">Profile &rarr;</span>
            </a>`;
        });
      } else if (q.length >= 2 && foundPlayers === null && !cachedPlayersMap.has(q)) {
        html += `
          <div id="search-players-loading-slot" style="padding:6px 12px 10px;font-size:0.75rem;color:var(--text-faint);display:flex;align-items:center;gap:8px;">
            <div class="spinner" style="width:12px;height:12px;border-width:2px;border-top-color:var(--kick-green);margin:0;"></div>
            <span>Searching players...</span>
          </div>`;
      }

      // ── Direct Page Navigation ──
      if (pageMatches.length > 0) {
        html += '<div class="search-group-title" style="margin-top:6px;"><i data-lucide="layers" style="width:12px;height:12px;"></i> Direct Navigation</div>';
        pageMatches.forEach((item, idx) => {
          html += `
            <a href="${item.href}" class="search-result-item" data-index="${idx + 20}">
              <span class="search-result-icon"><i data-lucide="${item.icon}"></i></span>
              <span>${item.label}</span>
              <span class="search-result-sub">${item.sub}</span>
            </a>`;
        });
      } else if (!isOnMatches && (!players || players.length === 0) && foundPlayers !== null) {
        html += `
          <div class="search-empty-state">
            <i data-lucide="help-circle"></i>
            <div>No players or pages found for "${escapeNavText(q)}"</div>
            <div style="font-size:0.75rem;margin-top:4px;color:var(--text-faint);">Try searching player names, "Realistic", "1v1", or "Leaderboard"</div>
          </div>`;
      }
    }

    popoverContent.innerHTML = html;
    if (window.lucide) lucide.createIcons();
    selectedIndex = -1;

    // Trigger async player lookup if not yet loaded
    if (q.length >= 2 && foundPlayers === null && !cachedPlayersMap.has(q)) {
      clearTimeout(playerSearchDebounce);
      playerSearchDebounce = setTimeout(async () => {
        const playersFound = await fetchPlayersForQuery(q);
        if (searchInput.value.trim().toLowerCase() === q) {
          renderSearch(q, playersFound);
        }
      }, 220);
    }
  }

  function openSearch() {
    renderSearch(searchInput.value);
    popover.classList.add('open');
  }

  function closeSearch() {
    popover.classList.remove('open');
    selectedIndex = -1;
  }

  searchInput.addEventListener('focus', openSearch);
  searchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    if (clearBtn) clearBtn.style.display = val.length > 0 ? 'inline-flex' : 'none';
    renderSearch(val);
    popover.classList.add('open');
    if (typeof handleMatchSearch === 'function') {
      handleMatchSearch(val);
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.preventDefault();
      searchInput.value = '';
      clearBtn.style.display = 'none';
      if (typeof handleMatchSearch === 'function') {
        handleMatchSearch('');
      }
      renderSearch('');
      searchInput.focus();
    });
  }

  // Keyboard shortcut '/'
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
  });

  searchInput.addEventListener('keydown', (e) => {
    const items = popoverContent.querySelectorAll('.search-result-item');
    if (e.key === 'Escape') {
      closeSearch();
      searchInput.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (items.length === 0) return;
      selectedIndex = (selectedIndex + 1) % items.length;
      items.forEach((it, i) => it.classList.toggle('selected', i === selectedIndex));
      items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length === 0) return;
      selectedIndex = (selectedIndex - 1 + items.length) % items.length;
      items.forEach((it, i) => it.classList.toggle('selected', i === selectedIndex));
      items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && items[selectedIndex]) {
        e.preventDefault();
        items[selectedIndex].click();
      } else if (searchInput.value.trim()) {
        e.preventDefault();
        window.location.href = `matches?q=${encodeURIComponent(searchInput.value.trim())}`;
      }
    }
  });

  document.addEventListener('click', (e) => {
    const box = document.getElementById('nav-search-box');
    if (box && !box.contains(e.target)) {
      closeSearch();
    }
  });
}

function toggleNavProfileDropdown(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('nav-profile-dropdown');
  const notifDropdown = document.getElementById('nav-notif-dropdown');
  if (notifDropdown) notifDropdown.classList.remove('open');
  if (dropdown) dropdown.classList.toggle('open');
}

function toggleNotifDropdown(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('nav-profile-dropdown');
  const dd = document.getElementById('nav-notif-dropdown');
  if (dropdown) dropdown.classList.remove('open');
  if (dd) dd.classList.toggle('open');
}

let _notifCurrentUid = null;

function renderNavNotifications(uid, notifs) {
  _notifCurrentUid = uid;
  const list = document.getElementById('nav-notif-list');
  const badge = document.getElementById('nav-notif-badge');
  if (!list) return;

  const unread = notifs.filter(n => !n.read).length;
  if (badge) {
    if (unread > 0) {
      badge.textContent = unread > 9 ? '9+' : unread;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  if (!notifs.length) {
    list.innerHTML = `<div class="nav-notif-empty"><i data-lucide="bell-off" style="width:28px;height:28px;color:var(--text-faint);margin-bottom:8px;"></i><div>No notifications yet</div></div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const iconMap = {
    match_win: '<i data-lucide="trophy" style="width:18px;height:18px;color:var(--gold-bright);"></i>',
    match_join: '<i data-lucide="swords" style="width:18px;height:18px;color:#60a5fa;"></i>',
    match_team_invite: '<i data-lucide="shield" style="width:18px;height:18px;color:#a855f7;"></i>',
    team_invite: '<i data-lucide="users" style="width:18px;height:18px;color:#a855f7;"></i>',
    income: '<i data-lucide="coins" style="width:18px;height:18px;color:var(--gold-bright);"></i>',
    system: '<i data-lucide="megaphone" style="width:18px;height:18px;color:var(--gold-bright);"></i>',
    admin: '<i data-lucide="shield-check" style="width:18px;height:18px;color:var(--gold-bright);"></i>',
  };

  list.innerHTML = notifs.map(n => {
    const icon = iconMap[n.type] || '<i data-lucide="bell" style="width:18px;height:18px;color:var(--text-muted);"></i>';
    const timeStr = n.createdAt ? formatTime(n.createdAt) : '';
    const isTeamInvite = n.type === 'team_invite' && !n.read && !n.accepted && !n.declined;
    const isMatchTeamInvite = n.type === 'match_team_invite' && !n.read && !n.accepted && !n.declined;

    return `
      <div class="nav-notif-item${n.read ? '' : ' unread'}" data-id="${n.id}">
        <div class="nav-notif-icon">${icon}</div>
        <div style="flex:1;min-width:0;">
          <div class="nav-notif-title">${n.title || 'Notification'}</div>
          <div class="nav-notif-body">${n.body || ''}</div>
          ${isTeamInvite ? `
            <div style="display:flex;gap:6px;margin-top:8px;">
              <button class="btn btn-primary btn-sm" style="font-size:0.75rem;padding:4px 10px;" onclick="handleAcceptTeamInvite('${n.id}','${n.teamId}',event)">
                Accept
              </button>
              <button class="btn btn-outline btn-sm" style="font-size:0.75rem;padding:4px 10px;" onclick="handleDeclineTeamInvite('${n.id}',event)">
                Decline
              </button>
            </div>` : ''}
          ${isMatchTeamInvite ? `
            <div style="display:flex;gap:6px;margin-top:8px;">
              <button class="btn btn-primary btn-sm" style="font-size:0.75rem;padding:4px 12px;gap:4px;" onclick="handleAcceptMatchTeamInvite('${n.id}','${n.matchId}','${n.matchCode || ''}',${n.wager || 0},${!!n.isCovered},event)">
                <i data-lucide="play" style="width:12px;height:12px;"></i> Accept & Join ${n.isCovered ? '(Free)' : ''}
              </button>
              <button class="btn btn-outline btn-sm" style="font-size:0.75rem;padding:4px 10px;gap:4px;" onclick="handleDeclineMatchTeamInvite('${n.id}','${n.matchId}',event)">
                <i data-lucide="x" style="width:12px;height:12px;"></i> Decline
              </button>
            </div>` : ''}
          ${timeStr ? `<div style="font-size:0.72rem;color:var(--text-faint);margin-top:4px;">${timeStr}</div>` : ''}
        </div>
        ${!n.read && !isTeamInvite && !isMatchTeamInvite ? `<div class="nav-notif-dot"></div>` : ''}
      </div>`;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

async function handleMarkAllRead() {
  if (!_notifCurrentUid) return;
  if (typeof markNotificationsRead === 'function') {
    await markNotificationsRead(_notifCurrentUid);
  }
}

async function handleAcceptMatchTeamInvite(notifId, matchId, matchCode, wager, isCovered, e) {
  if (e) e.stopPropagation();
  const user = auth.currentUser;
  if (!user || !_notifCurrentUid) return;

  try {
    const uData = await getUser(user.uid);
    if (!uData?.epicUsername) {
      showToast('Please link your Epic Games username in Profile before entering matches', 'error');
      setTimeout(() => window.location.href = 'profile?tab=connections', 1000);
      return;
    }
    if (!isCovered && Number(uData.tokens || 0) < Number(wager)) {
      showToast(`Insufficient tokens (Requires ${formatTokens(wager)} Tokens entry fee)`, 'error');
      return;
    }

    showToast('Joining team match…', 'info');
    await acceptMatchTeamInvite(matchId, uData, notifId);
    showToast('Accepted! Opening match arena…', 'success');

    const dd = document.getElementById('nav-notif-dropdown');
    if (dd) dd.classList.remove('open');

    setTimeout(() => {
      window.location.href = `match?id=${matchId}`;
    }, 400);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleDeclineMatchTeamInvite(notifId, matchId, e) {
  if (e) e.stopPropagation();
  if (!_notifCurrentUid) return;
  try {
    await declineMatchTeamInvite(matchId, _notifCurrentUid, notifId);
    showToast('Match invitation declined.', 'info');
    const dd = document.getElementById('nav-notif-dropdown');
    if (dd) dd.classList.remove('open');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleAcceptTeamInvite(notifId, teamId, e) {
  if (e) e.stopPropagation();
  if (!_notifCurrentUid || !teamId) return;
  try {
    await acceptTeamInvite(notifId, _notifCurrentUid, teamId);
    showToast('Team invite accepted! You joined the team.', 'success');
    const dd = document.getElementById('nav-notif-dropdown');
    if (dd) dd.classList.remove('open');
    if (window.location.pathname.includes('profile')) window.location.reload();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleDeclineTeamInvite(notifId, e) {
  if (e) e.stopPropagation();
  if (!_notifCurrentUid) return;
  try {
    await declineTeamInvite(notifId, _notifCurrentUid);
    showToast('Team invite declined.', 'info');
  } catch (err) {
    showToast(err.message, 'error');
  }
}


function openTokenWalletModal(tab = 'purchase') {
  const modal = document.getElementById('token-wallet-modal');
  if (modal) {
    modal.classList.add('open');
    modal.classList.add('active');
  }
  switchWalletTab(tab);
  
  // Populate available balance in withdraw tab
  if (auth.currentUser) {
    getUser(auth.currentUser.uid).then(u => {
      const availEl = document.getElementById('withdraw-available-tokens');
      if (availEl) availEl.textContent = formatTokens(u?.tokens ?? 0.00);
    }).catch(console.warn);
  }

  if (window.lucide) lucide.createIcons();
}

function closeTokenWalletModal() {
  const modal = document.getElementById('token-wallet-modal');
  if (modal) {
    modal.classList.remove('open');
    modal.classList.remove('active');
  }
}

function switchWalletTab(tab) {
  const btnPurchase = document.getElementById('tab-btn-wallet-purchase');
  const btnRedeem = document.getElementById('tab-btn-wallet-redeem');

  const viewPurchase = document.getElementById('wallet-tab-purchase-view');
  const viewRedeem = document.getElementById('wallet-tab-redeem-view');

  if (btnPurchase) btnPurchase.classList.remove('active');
  if (btnRedeem) btnRedeem.classList.remove('active');

  if (viewPurchase) viewPurchase.style.display = 'none';
  if (viewRedeem) viewRedeem.style.display = 'none';

  if (tab === 'purchase') {
    if (btnPurchase) btnPurchase.classList.add('active');
    if (viewPurchase) viewPurchase.style.display = 'block';
  } else if (tab === 'redeem') {
    if (btnRedeem) btnRedeem.classList.add('active');
    if (viewRedeem) viewRedeem.style.display = 'block';
  }

  if (window.lucide) lucide.createIcons();
}

async function handleWalletBuy(packName, tokenAmount, usdPrice) {
  const user = auth.currentUser;
  if (!user) {
    showToast('Please log in to deposit tokens', 'error');
    return;
  }
  const amount = parseFloat(tokenAmount);
  try {
    await updateTokens(user.uid, amount, 'purchase', `Deposited ${packName} Pack (${formatTokens(amount)} Tokens)`);
    closeTokenWalletModal();
    if (typeof showGiftClaimedModal === 'function') {
      showGiftClaimedModal({
        type: 'tokens',
        amount: amount,
        subtext: `Thank you for your purchase! ${formatTokens(amount)} Tokens have been deposited into your wallet.`
      });
    } else {
      showToast(`Successfully added ${formatTokens(amount)} Tokens to your balance!`, 'success');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleCustomWalletBuy() {
  const user = auth.currentUser;
  if (!user) {
    showToast('Please log in to deposit tokens', 'error');
    return;
  }
  const input = document.getElementById('custom-token-deposit-input');
  const val = parseFloat(input?.value || '0');
  if (!val || val < 1) {
    showToast('Please enter a valid deposit amount (min 1.00)', 'error');
    return;
  }
  try {
    await updateTokens(user.uid, val, 'purchase', `Custom Deposit (${formatTokens(val)} Tokens)`);
    if (input) input.value = '';
    closeTokenWalletModal();
    if (typeof showGiftClaimedModal === 'function') {
      showGiftClaimedModal({
        type: 'tokens',
        amount: val,
        subtext: `Thank you for your purchase! ${formatTokens(val)} Tokens have been deposited into your wallet.`
      });
    } else {
      showToast(`Successfully added ${formatTokens(val)} Tokens to your balance!`, 'success');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function setWalletWithdrawMax() {
  if (!auth.currentUser) return;
  try {
    const u = await getUser(auth.currentUser.uid);
    const bal = Math.floor((Number(u?.tokens || 0)) * 100) / 100;
    const input = document.getElementById('wallet-withdraw-amount');
    if (input) input.value = bal;
  } catch (e) {
    console.warn(e);
  }
}

async function handleWalletWithdraw() {
  const user = auth.currentUser;
  if (!user) {
    showToast('Please log in to withdraw', 'error');
    return;
  }

  const methodEl = document.getElementById('wallet-withdraw-method');
  const addrEl = document.getElementById('wallet-withdraw-address');
  const amtEl = document.getElementById('wallet-withdraw-amount');
  const btn = document.getElementById('wallet-withdraw-submit-btn');

  const method = methodEl?.value || 'paypal';
  const address = addrEl?.value?.trim();
  const amount = parseFloat(amtEl?.value || '0');

  if (!address) {
    showToast('Please enter your payout address or email', 'error');
    return;
  }
  if (!amount || amount < 5.00) {
    showToast('Minimum withdrawal is 5.00 Tokens', 'error');
    return;
  }

  if (btn) btn.disabled = true;

  try {
    const userData = await getUser(user.uid);
    const curBal = Number(userData?.tokens || 0);
    if (curBal < amount) {
      throw new Error(`Insufficient balance (Available: ${formatTokens(curBal)} Tokens)`);
    }

    // Deduct tokens
    await updateTokens(user.uid, -amount, 'withdrawal', `Withdrawal Request to ${method.toUpperCase()} (${address})`);

    // Create withdrawal request doc
    await db.collection('withdrawals').add({
      userId: user.uid,
      username: userData?.displayName || user.displayName || 'Player',
      discordUsername: userData?.discordUsername || '',
      amount: amount,
      method: method,
      destination: address,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showToast(`Withdrawal request for ${formatTokens(amount)} Tokens submitted successfully!`, 'success');
    if (addrEl) addrEl.value = '';
    if (amtEl) amtEl.value = '';
    closeTokenWalletModal();
  } catch (err) {
    showToast(err.message || 'Failed to submit withdrawal request', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}



/* ── Gift Received Celebration Modal ────────────────────────────── */
function showGiftClaimedModal(info) {
  let overlay = document.getElementById('ct-gift-received-modal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'ct-gift-received-modal';
    document.body.appendChild(overlay);
  }

  overlay.className = 'modal-overlay open active';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);z-index:99999999;display:flex;align-items:center;justify-content:center;padding:20px;opacity:1;pointer-events:all;visibility:visible;';

  let mediaHtml = '';

  if (info.type === 'tokens') {
    mediaHtml = `
      <div style="position:relative;width:100px;height:100px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;inset:-10px;background:radial-gradient(circle, rgba(245,158,11,0.4) 0%, transparent 70%);border-radius:50%;"></div>
        <img src="new_token.png" alt="CT" style="width:76px;height:76px;object-fit:contain;position:relative;z-index:2;filter:drop-shadow(0 10px 25px rgba(245,158,11,0.5));" />
      </div>
      <div style="font-size:2.2rem;font-weight:900;color:var(--gold-bright);letter-spacing:-0.02em;margin-bottom:6px;">
        +${formatTokens(info.amount)} Tokens
      </div>
    `;
  } else if (info.type === 'pfp') {
    mediaHtml = `
      <div style="position:relative;width:100px;height:100px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;inset:-10px;background:radial-gradient(circle, rgba(245,158,11,0.35) 0%, transparent 70%);border-radius:50%;"></div>
        <div style="width:86px;height:86px;border-radius:50%;overflow:hidden;background:#000;border:2.5px solid ${info.color || 'var(--gold-bright)'};position:relative;z-index:2;box-shadow:0 8px 24px rgba(0,0,0,0.8);">
          <img src="${info.image || 'cosmetics/uncomon/uncomon.png'}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;" />
        </div>
      </div>
      <div style="font-size:1.4rem;font-weight:900;color:#fff;margin-bottom:6px;">
        ${escapeHtml(info.name || 'Exclusive Avatar')}
      </div>
      <div style="margin-bottom:8px;">
        <span class="badge" style="background:rgba(255,255,255,0.06);color:${info.color || 'var(--gold-bright)'};border:1px solid ${info.color || 'var(--gold-bright)'};font-size:0.75rem;padding:3px 10px;">
          ${(info.rarity || 'EXCLUSIVE').toUpperCase()}
        </span>
      </div>
    `;
  } else if (info.type === 'title') {
    const cleanTitle = (info.name || 'No signal').replace(/["']/g, '').replace(/\([^)]*\)/g, '').trim();
    mediaHtml = `
      <div style="position:relative;width:90px;height:90px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;">
        <div style="width:72px;height:72px;border-radius:18px;background:rgba(239, 68, 68, 0.15);border:1.5px solid rgba(239, 68, 68, 0.45);display:flex;align-items:center;justify-content:center;color:#ef4444;font-size:2rem;box-shadow:0 0 30px rgba(239,68,68,0.3);">
          <i data-lucide="${info.icon || 'globe-off'}" style="width:36px;height:36px;"></i>
        </div>
      </div>
      <div style="margin-bottom:12px;">
        <span class="badge" style="background:rgba(239,68,68,0.15);color:#ef4444;border:1.5px solid rgba(239,68,68,0.45);font-size:1.2rem;font-weight:900;padding:6px 20px;border-radius:12px;">
          ${escapeHtml(cleanTitle)}
        </span>
      </div>
    `;
  } else if (info.type === 'gearup') {
    const gearupKey = info.gearupKey || info.key || 'GU-PENDING-KEY';
    const duration = info.duration || '1 Month PC VIP';
    mediaHtml = `
      <div style="position:relative;width:96px;height:96px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;inset:-8px;background:radial-gradient(circle, rgba(56,189,248,0.35) 0%, transparent 70%);border-radius:50%;"></div>
        <div style="width:82px;height:82px;border-radius:20px;overflow:hidden;background:#000;border:2px solid #38bdf8;position:relative;z-index:2;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(0,0,0,0.8);">
          <img src="gearup.png" alt="GearUP Booster" style="width:82%;height:82%;object-fit:contain;" />
        </div>
      </div>
      <div style="font-size:1.4rem;font-weight:900;color:#fff;margin-bottom:16px;">
        GearUP Booster (PC)
      </div>
      <!-- Clean Simple Key Box -->
      <div style="background:#060608;border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:10px 14px;margin:0 auto 16px;display:flex;align-items:center;justify-content:space-between;gap:8px;max-width:340px;">
        <div style="font-family:monospace;font-size:1.05rem;font-weight:900;color:#38bdf8;letter-spacing:0.04em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" id="claimed-gearup-key-text">
          ${escapeHtml(gearupKey)}
        </div>
        <button type="button" class="btn btn-outline btn-sm" onclick="copyGearupKey('${escapeHtml(gearupKey)}')" id="btn-copy-gearup-key" style="border-color:rgba(56,189,248,0.4);color:#38bdf8;padding:5px 12px;font-size:0.75rem;border-radius:8px;gap:4px;background:#000;">
          <i data-lucide="copy" style="width:12px;height:12px;"></i> Copy
        </button>
      </div>
    `;
  } else if (info.type === 'premium') {
    mediaHtml = `
      <div style="position:relative;width:90px;height:90px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;">
        <div style="width:72px;height:72px;border-radius:20px;background:rgba(245,158,11,0.18);border:1.5px solid var(--gold-bright);display:flex;align-items:center;justify-content:center;color:var(--gold-bright);font-size:2.2rem;box-shadow:0 0 35px rgba(245,158,11,0.3);">
          <i data-lucide="crown" style="width:38px;height:38px;"></i>
        </div>
      </div>
      <div style="font-size:1.45rem;font-weight:900;color:var(--gold-bright);margin-bottom:6px;">
        Champion Premium
      </div>
    `;
  }

  overlay.innerHTML = `
    <div style="max-width:440px;width:100%;text-align:center;padding:32px 28px;background:#000000;border:1px solid rgba(255,255,255,0.12);border-radius:24px;box-shadow:0 24px 60px rgba(0,0,0,0.95);position:relative;overflow:hidden;animation:celebrationPopIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);">
      <div style="position:absolute;top:-40px;left:50%;transform:translateX(-50%);width:220px;height:220px;background:radial-gradient(circle, rgba(245,158,11,0.2) 0%, transparent 70%);pointer-events:none;border-radius:50%;"></div>
      
      <h2 style="font-size:1.5rem;font-weight:900;color:#fff;margin-bottom:16px;letter-spacing:-0.02em;position:relative;z-index:2;">
        You Received a Gift!
      </h2>

      <div style="position:relative;z-index:2;">
        ${mediaHtml}

        <div style="font-size:0.88rem;color:var(--text-muted);line-height:1.5;margin-bottom:22px;">
          ${escapeHtml(info.subtext || 'The reward has been added to your account.')}
        </div>

        <button type="button" class="btn btn-gold btn-full" id="gift-modal-close-btn" style="border-radius:12px;padding:12px;font-size:0.92rem;font-weight:800;gap:6px;">
          <i data-lucide="check" style="width:16px;height:16px;"></i> <span>Awesome!</span>
        </button>
      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();

  document.getElementById('gift-modal-close-btn').onclick = () => {
    overlay.style.display = 'none';
    overlay.classList.remove('open');
    overlay.classList.remove('active');
  };
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      overlay.style.display = 'none';
      overlay.classList.remove('open');
      overlay.classList.remove('active');
    }
  };
}

/* ── Universal Redeem Code Handler ─────────────────────────────── */
async function handleRedeemCode() {
  const user = auth.currentUser;
  if (!user) {
    showToast('Please log in to redeem codes', 'error');
    return;
  }

  const input = document.getElementById('wallet-redeem-code-input');
  const btn = document.getElementById('wallet-redeem-submit-btn');
  const rawCode = input?.value?.trim()?.toUpperCase();

  if (!rawCode) {
    showToast('Please enter a redeem code', 'error');
    return;
  }

  const oldBtnHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;display:inline-block;margin-right:6px;"></span> Checking code...';
  }

  try {
    let snap = await db.collection('redeem_codes').where('code', '==', rawCode).limit(1).get();
    
    // If not found, try finding with sanitized code (no spaces/hyphens mismatch)
    if (snap.empty) {
      const cleanInput = rawCode.replace(/[^A-Z0-9]/g, '');
      const allCodesSnap = await db.collection('redeem_codes').where('isActive', '==', true).get();
      for (const d of allCodesSnap.docs) {
        const cVal = (d.data().code || '').replace(/[^A-Z0-9]/g, '').toUpperCase();
        if (cVal === cleanInput) {
          snap = { empty: false, docs: [d] };
          break;
        }
      }
    }

    if (snap.empty) {
      throw new Error('Code already redeemed or does not exist.');
    }

    const codeDoc = snap.docs[0];
    const codeData = codeDoc.data();

    if (codeData.isActive === false) {
      throw new Error('Code already redeemed or does not exist.');
    }

    const maxUses = Number(codeData.maxUses || 1);
    const usedCount = Number(codeData.usedCount || 0);
    if (usedCount >= maxUses) {
      throw new Error('Code already redeemed or does not exist.');
    }

    const usedBy = codeData.usedBy || [];
    if (usedBy.some(u => u.uid === user.uid)) {
      throw new Error('Code already redeemed or does not exist.');
    }

    const userData = await getUser(user.uid);

    let giftInfo = {
      type: codeData.rewardType || 'tokens',
      subtext: 'Your reward has been credited to your account balance.'
    };

    const rewardType = codeData.rewardType || 'tokens';

    if (rewardType === 'tokens') {
      const amt = Number(codeData.rewardValue || 0);
      if (amt <= 0) throw new Error('Code already redeemed or does not exist.');
      await updateTokens(user.uid, amt, 'redeem_code', `Redeemed Code: ${rawCode}`);
      giftInfo.amount = amt;
      giftInfo.subtext = `${formatTokens(amt)} Tokens have been credited to your wallet balance.`;
    } else if (rewardType === 'pfp') {
      const pfpId = codeData.rewardValue;
      await db.collection('users').doc(user.uid).update({
        unlockedPfps: firebase.firestore.FieldValue.arrayUnion(pfpId)
      });
      const pfpItem = (typeof SHOP_PFPS !== 'undefined' && SHOP_PFPS[pfpId]) ? SHOP_PFPS[pfpId] : { name: codeData.rewardLabel || 'Avatar', file: codeData.rewardImage || 'cosmetics/uncomon/uncomon.png', rarity: 'Exclusive', color: 'var(--gold-bright)' };
      giftInfo.name = pfpItem.name.startsWith('#') ? 'Avatar ' + pfpItem.name : pfpItem.name;
      giftInfo.image = pfpItem.file;
      giftInfo.rarity = pfpItem.rarity;
      giftInfo.color = pfpItem.color;
      giftInfo.subtext = 'New avatar added to your wardrobe! You can equip it in your Profile.';
    } else if (rewardType === 'title') {
      const titleId = codeData.rewardValue;
      await db.collection('users').doc(user.uid).update({
        unlockedTitles: firebase.firestore.FieldValue.arrayUnion(titleId)
      });
      const titleItem = (typeof SHOP_TITLES !== 'undefined' && SHOP_TITLES[titleId]) ? SHOP_TITLES[titleId] : { name: 'No signal', icon: 'globe-off' };
      giftInfo.name = titleItem.name || 'No signal';
      giftInfo.icon = titleItem.icon || 'globe-off';
      giftInfo.subtext = 'New title unlocked! You can equip it in your Profile customization.';
    } else if (rewardType === 'gearup') {
      const gearupKey = codeData.gearupKey || codeData.rewardValue || 'GU-PENDING-KEY';
      const duration = codeData.gearupDuration || '1 Month PC VIP';

      // Store in user profile claimedGifts collection
      await db.collection('users').doc(user.uid).update({
        claimedGifts: firebase.firestore.FieldValue.arrayUnion({
          type: 'gearup',
          title: 'GearUP Booster (PC)',
          key: gearupKey,
          duration: duration,
          image: 'gearup.png',
          claimedAt: new Date().toISOString()
        })
      });

      giftInfo.type = 'gearup';
      giftInfo.gearupKey = gearupKey;
      giftInfo.duration = duration;
      giftInfo.subtext = 'Your GearUP Booster (PC) key is ready to activate! Copy it below or view it anytime in your Profile.';
    } else if (rewardType === 'premium') {
      const daysToAdd = Number(codeData.rewardValue) || 30;
      let baseTime = Date.now();
      if (userData?.isPremium && userData?.premiumExpiresAt) {
        try {
          const curExp = typeof userData.premiumExpiresAt.toDate === 'function' ? userData.premiumExpiresAt.toDate() : new Date(userData.premiumExpiresAt);
          if (curExp.getTime() > baseTime) {
            baseTime = curExp.getTime();
          }
        } catch (e) {}
      }
      const newExpDate = new Date(baseTime + (daysToAdd * 24 * 60 * 60 * 1000));
      const totalDaysLeft = Math.ceil((newExpDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      await db.collection('users').doc(user.uid).update({
        isPremium: true,
        premiumExpiresAt: firebase.firestore.Timestamp.fromDate(newExpDate)
      });
      giftInfo.subtext = `+${daysToAdd} Days of Champion Premium activated! You now have ${totalDaysLeft} Days active on your account.`;
    } else {
      throw new Error('Code already redeemed or does not exist.');
    }

    const newUsedCount = usedCount + 1;
    const isNowExpired = (newUsedCount >= maxUses);

    await db.collection('redeem_codes').doc(codeDoc.id).update({
      usedCount: firebase.firestore.FieldValue.increment(1),
      isActive: !isNowExpired,
      usedBy: firebase.firestore.FieldValue.arrayUnion({
        uid: user.uid,
        username: userData?.displayName || user.displayName || 'Player',
        discordUsername: userData?.discordUsername || '',
        redeemedAt: new Date().toISOString()
      })
    });

    closeTokenWalletModal();
    if (input) input.value = '';

    showGiftClaimedModal(giftInfo);
  } catch (err) {
    console.error('Redeem error:', err);
    showToast(err.message || 'Code already redeemed or does not exist.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = oldBtnHtml;
    }
  }
}



function handleSignOut() {
  signOut().then(() => { window.location.href = '/'; });
}

function toggleSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  if (sidebar) {
    if (window.innerWidth <= 768) {
      sidebar.classList.toggle('mobile-open');
    } else {
      sidebar.classList.toggle('collapsed');
      document.body.classList.toggle('sidebar-collapsed');
      try {
        localStorage.setItem('ct_sidebar_collapsed', sidebar.classList.contains('collapsed') ? '1' : '0');
      } catch (e) {}
    }
  }
}

function toggleMobileNav() {
  toggleSidebar();
}

/**
 * Injects animated floating Fortnite & gaming icons into the background
 */
function injectFloatingIcons() {
  if (document.getElementById('floating-icons-container')) return;

  const icons = [
    { name: 'crosshair', top: '12%', left: '8%',  size: 32, dur: '18s', delay: '0s' },
    { name: 'swords',    top: '25%', left: '88%', size: 36, dur: '22s', delay: '2s' },
    { name: 'shield',    top: '65%', left: '6%',  size: 30, dur: '20s', delay: '4s' },
    { name: 'trophy',    top: '78%', left: '92%', size: 34, dur: '25s', delay: '1s' },
    { name: 'zap',       top: '45%', left: '95%', size: 28, dur: '17s', delay: '5s' },
    { name: 'flame',     top: '85%', left: '18%', size: 30, dur: '24s', delay: '3s' },
    { name: 'target',    top: '38%', left: '3%',  size: 26, dur: '19s', delay: '6s' },
    { name: 'crown',     top: '15%', left: '75%', size: 32, dur: '21s', delay: '2.5s' },
  ];

  const container = document.createElement('div');
  container.id = 'floating-icons-container';
  container.className = 'floating-icons-layer';

  container.innerHTML = icons.map(ic => `
    <div class="floating-icon-item" style="top:${ic.top};left:${ic.left};animation-duration:${ic.dur};animation-delay:${ic.delay};">
      <i data-lucide="${ic.name}" style="width:${ic.size}px;height:${ic.size}px;"></i>
    </div>
  `).join('');

  document.body.appendChild(container);
}

// ── Toast Notifications ───────────────────────────────────────

/**
 * Show a sleek pure black pill toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'|'warning'} type
 */
function showToast(message, type = 'success') {
  const iconMap = {
    success: 'check-circle-2',
    error:   'alert-circle',
    info:    'info',
    warning: 'alert-triangle',
  };

  const toast = document.createElement('div');
  toast.className = `ct-toast ct-toast--${type}`;
  toast.innerHTML = `<i data-lucide="${iconMap[type] || 'check-circle-2'}"></i><span>${message}</span>`;

  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();

  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 3000);
}

// ── Formatting Helpers ────────────────────────────────────────

function formatTime(timestamp) {
  if (!timestamp) return 'Just now';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diff  = Date.now() - date.getTime();
  if (diff < 60_000)     return 'Just now';
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Format tokens to 2 decimal places (e.g. 10.00, 0.50) */
function formatTokens(n) {
  if (n == null || isNaN(n)) return '0.00';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function txTypeLabel(type) {
  const labels = {
    bonus:       'Welcome Bonus',
    match_wager: 'Match Wager',
    match_win:   'Match Win',
    purchase:    'Token Purchase',
    admin:       'Admin Grant',
  };
  return labels[type] || type;
}

function modeColor(mode) {
  const map = {
    'Realistic':  'badge-mode-realistic',
    'Zone Wars':  'badge-mode-zonewars',
    'Box Fights': 'badge-mode-boxfights',
    'Solo':       'badge-mode-realistic',
    'Duos':       'badge-mode-zonewars',
    'Squads':     'badge-mode-boxfights',
  };
  return map[mode] || 'badge-mode-realistic';
}

function sizeColor(size) {
  const map = {
    '1v1': 'badge-size-1v1',
    '2v2': 'badge-size-2v2',
    '3v3': 'badge-size-3v3',
  };
  return map[size] || 'badge-size-1v1';
}

/**
 * Modern Custom Confirmation Modal dialog (Replaces native browser window.confirm).
 * @param {Object|string} options
 * @returns {Promise<boolean>}
 */
function showConfirm(options = {}) {
  const config = typeof options === 'string' ? { message: options } : options;
  const {
    title = 'Are you sure?',
    message = '',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    type = 'warning',
    icon = type === 'danger' ? 'alert-triangle' : (type === 'success' ? 'check-circle' : 'help-circle'),
  } = config;

  return new Promise((resolve) => {
    let overlay = document.getElementById('ct-custom-confirm-modal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'ct-custom-confirm-modal';
      overlay.className = 'modal-overlay';
      overlay.style.zIndex = '999999';
      document.body.appendChild(overlay);
    }

    const iconColor = type === 'danger' ? 'var(--red)' : (type === 'success' ? 'var(--green)' : 'var(--gold-bright)');
    const btnClass = type === 'danger' ? 'btn-danger' : 'btn-primary';

    overlay.innerHTML = `
      <div class="modal" style="max-width:440px;text-align:center;padding:28px 24px;border:1px solid rgba(255,255,255,0.1);box-shadow:0 24px 60px rgba(0,0,0,0.85);backdrop-filter:blur(24px);">
        <div style="width:54px;height:54px;border-radius:50%;background:rgba(255,255,255,0.05);border:1px solid ${iconColor};display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:${iconColor};box-shadow:0 0 20px rgba(0,0,0,0.4);">
          <i data-lucide="${icon}" style="width:26px;height:26px;"></i>
        </div>
        <h3 style="font-size:1.25rem;font-weight:900;color:#fff;margin-bottom:8px;">${title}</h3>
        <div style="font-size:0.88rem;color:var(--text-muted);line-height:1.5;margin-bottom:24px;">${message}</div>
        <div style="display:flex;gap:10px;justify-content:center;">
          <button type="button" class="btn btn-outline" id="ct-confirm-cancel-btn" style="flex:1;">${cancelText}</button>
          <button type="button" class="btn ${btnClass}" id="ct-confirm-accept-btn" style="flex:1;">${confirmText}</button>
        </div>
      </div>
    `;

    overlay.classList.add('open');
    overlay.classList.add('active');
    if (window.lucide) lucide.createIcons();

    const cleanup = (res) => {
      overlay.classList.remove('open');
      overlay.classList.remove('active');
      resolve(res);
    };

    document.getElementById('ct-confirm-cancel-btn').onclick = () => cleanup(false);
    document.getElementById('ct-confirm-accept-btn').onclick = () => cleanup(true);
    overlay.onclick = (e) => {
      if (e.target === overlay) cleanup(false);
    };
  });
}

/**
 * Show clean, borderless dark Suspension/Banned Screen
 */
function showBannedScreen(userData) {
  const reason = userData?.banReason || 'Violation of community guidelines or platform terms';
  const username = userData?.displayName || userData?.discordUsername || 'Player';
  const uid = userData?.uid || (auth.currentUser ? auth.currentUser.uid : '');
  let bannedDate = '';
  if (userData?.bannedAt) {
    try {
      const d = typeof userData.bannedAt.toDate === 'function' ? userData.bannedAt.toDate() : new Date(userData.bannedAt);
      if (!isNaN(d.getTime())) bannedDate = d.toLocaleString();
    } catch(e) {}
  }

  let existing = document.getElementById('ct-banned-screen');
  if (!existing) {
    existing = document.createElement('div');
    existing.id = 'ct-banned-screen';
    document.body.appendChild(existing);
  }

  window.toggleBanReasonView = function() {
    const card = document.getElementById('ban-reason-card');
    const chevron = document.getElementById('ban-reason-chevron');
    const btnText = document.getElementById('ban-reason-btn-text');
    if (!card) return;
    const isHidden = card.style.display === 'none';
    card.style.display = isHidden ? 'block' : 'none';
    if (chevron) chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    if (btnText) btnText.textContent = isHidden ? 'Hide Reason' : 'View Reason';
  };

  existing.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.92);backdrop-filter:blur(16px);z-index:99999999;display:flex;align-items:center;justify-content:center;padding:24px;overflow-y:auto;">
      <div style="max-width:460px;width:100%;background:#0b0b0d;box-shadow:0 12px 48px rgba(0,0,0,0.85), 0 0 24px rgba(0,0,0,0.6);border-radius:20px;padding:36px 28px;text-align:center;border:none;">
        
        <div style="width:58px;height:58px;border-radius:50%;background:rgba(239,68,68,0.12);display:flex;align-items:center;justify-content:center;margin:0 auto 18px;color:#ef4444;border:none;">
          <i data-lucide="shield-alert" style="width:28px;height:28px;"></i>
        </div>

        <h2 style="color:#ffffff;font-weight:900;font-size:1.45rem;margin:0 0 10px;line-height:1.35;border:none;">
          Your account has been banned for breaking our rules.
        </h2>

        <!-- Blue View Reason Text Button -->
        <div style="margin:12px 0 22px;">
          <span onclick="toggleBanReasonView()" style="color:#3b82f6;font-weight:700;font-size:0.9rem;cursor:pointer;display:inline-flex;align-items:center;gap:5px;user-select:none;transition:color 0.15s ease;">
            <span id="ban-reason-btn-text">View Reason</span>
            <i data-lucide="chevron-down" id="ban-reason-chevron" style="width:15px;height:15px;transition:transform 0.2s ease;"></i>
          </span>
        </div>
        
        <!-- Collapsible Reason Details -->
        <div id="ban-reason-card" style="display:none;background:#131317;border-radius:12px;padding:16px 18px;text-align:left;margin-bottom:24px;border:none;">
          <div style="font-size:0.75rem;color:#3b82f6;text-transform:uppercase;font-weight:800;letter-spacing:0.04em;">Reason</div>
          <div style="font-size:0.95rem;font-weight:700;color:#ffffff;margin:6px 0 10px;line-height:1.4;">
            ${escapeHtml(reason)}
          </div>
          <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:10px;display:flex;flex-direction:column;gap:4px;font-size:0.75rem;color:#71717a;">
            <div>Account: <strong style="color:#d4d4d8;">${escapeHtml(username)}</strong> ${uid ? `· <span style="font-family:monospace;font-size:0.7rem;">${uid}</span>` : ''}</div>
            ${bannedDate ? `<div>Date: <strong style="color:#a1a1aa;">${bannedDate}</strong></div>` : ''}
          </div>
        </div>

        <!-- Action Buttons (No outlines, Discord icon on the right) -->
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
          <a href="https://discord.gg/championtokens" target="_blank" style="flex:1;min-width:140px;background:#5865F2;color:#ffffff;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 20px;font-weight:800;font-size:0.9rem;border-radius:12px;text-decoration:none;border:none;box-shadow:0 4px 14px rgba(88,101,242,0.35);transition:opacity 0.16s ease;">
            <span>Appeal</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0;">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
          </a>
          <button onclick="handleSignOut()" style="flex:1;min-width:120px;background:#18181b;color:#a1a1aa;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 18px;font-weight:800;font-size:0.9rem;border-radius:12px;cursor:pointer;border:none;transition:background 0.16s ease;">
            <span>Sign Out</span>
            <i data-lucide="log-out" style="width:16px;height:16px;"></i>
          </button>
        </div>
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}





function copyGearupKey(key) {
  if (!key) return;
  navigator.clipboard.writeText(key).then(() => {
    const btn = document.getElementById('btn-copy-gearup-key');
    if (btn) {
      btn.innerHTML = '<i data-lucide="check" style="width:13px;height:13px;"></i> <span>Copied!</span>';
      if (window.lucide) lucide.createIcons();
      setTimeout(() => {
        btn.innerHTML = '<i data-lucide="copy" style="width:13px;height:13px;"></i> <span>Copy</span>';
        if (window.lucide) lucide.createIcons();
      }, 2500);
    }
    showToast('GearUP Booster key copied to clipboard!', 'success');
  }).catch(() => {
    prompt('Copy your GearUP Booster key:', key);
  });
}


  // Accessibility: Keyboard 'Escape' key closes open modals and dropdowns
  if (!window._hasA11yEscListener) {
    window._hasA11yEscListener = true;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const notifDropdown = document.getElementById('nav-notif-dropdown');
        if (notifDropdown && notifDropdown.classList.contains('active')) {
          notifDropdown.classList.remove('active');
        }
        const profileDropdown = document.getElementById('nav-profile-dropdown');
        if (profileDropdown && profileDropdown.classList.contains('active')) {
          profileDropdown.classList.remove('active');
        }
        const activeModal = document.querySelector('.modal-overlay:not([style*="display: none"]):not(.hidden)');
        if (activeModal && activeModal.id) {
          const closeBtn = activeModal.querySelector('.modal-close');
          if (closeBtn) closeBtn.click();
        }
      }
    });
  }


  // Live Ban Realtime Watcher
  if (typeof auth !== 'undefined' && typeof db !== 'undefined') {
    auth.onAuthStateChanged(user => {
      if (user) {
        db.collection('users').doc(user.uid).onSnapshot(docSnap => {
          if (!docSnap.exists) return;
          const uData = docSnap.data() || {};
          if (uData.isBanned === true || uData.banned === true) {
            if (typeof renderBannedScreen === 'function') {
              renderBannedScreen(uData);
            }
          }
        }, err => {
          console.warn('Realtime ban listener notice:', err);
        });
      }
    });
  }


// ── Cookie Consent Banner ──────────────────────────────────
function initCookieConsent() {
  try {
    const consent = localStorage.getItem('ct_cookie_consent');
    if (consent) return; // Already accepted
  } catch (e) {}

  if (document.getElementById('ct-cookie-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'ct-cookie-banner';
  banner.className = 'ct-cookie-banner';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Cookie Consent Notice');
  banner.innerHTML = `
    <div class="ct-cookie-header">
      <i data-lucide="cookie"></i>
      <span>Cookie & Privacy Preferences</span>
    </div>
    <div class="ct-cookie-body">
      We use strictly essential cookies and secure local storage to authenticate your Discord account, ensure fair-play matchmaking, and secure your wallet transactions. Read our <a href="cookies">Cookie Policy</a>, <a href="privacy-policy">Privacy Policy</a>, and <a href="refunds">Refund Policy</a>.
    </div>
    <div class="ct-cookie-actions">
      <button type="button" class="btn btn-outline btn-sm" onclick="handleCookieChoice('essential')" style="font-size:0.8rem;padding:6px 14px;border-radius:10px;background:rgba(255,255,255,0.04);">
        Essential Only
      </button>
      <button type="button" class="btn btn-gold btn-sm" onclick="handleCookieChoice('all')" style="font-size:0.8rem;padding:6px 16px;border-radius:10px;">
        Accept All
      </button>
    </div>
  `;

  document.body.appendChild(banner);
  if (window.lucide) lucide.createIcons();
}

window.handleCookieChoice = function(choice) {
  try {
    localStorage.setItem('ct_cookie_consent', choice || 'accepted');
  } catch (e) {}
  const banner = document.getElementById('ct-cookie-banner');
  if (banner) {
    banner.style.opacity = '0';
    banner.style.transform = 'translateY(20px)';
    banner.style.transition = 'all 0.25s ease';
    setTimeout(() => banner.remove(), 250);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initCookieConsent, 600);
});
