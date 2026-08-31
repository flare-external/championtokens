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
    <nav class="ct-nav" id="ct-nav">
      <div class="ct-nav__inner">
        <a href="dashboard" class="ct-nav__brand">
          <img src="champion-tokens_new.png" alt="Champion Tokens" class="brand-logo-img" width="44" height="44" />
          <span class="brand-text">Champion <span class="brand-accent">Tokens</span></span>
        </a>

        <div class="ct-nav__links">${navLinksHTML}</div>

        <div class="ct-nav__user">
          <button class="nav-token-btn" onclick="openTokenWalletModal('purchase')" title="Add Tokens / View Wallet">
            <img src="new_token.png" alt="CT" class="nav-token-coin" width="28" height="28" />
            <span id="nav-balance">10.00</span>
            <span class="nav-token-plus">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="4" x2="12" y2="20"></line>
                <line x1="4" y1="12" x2="20" y2="12"></line>
              </svg>
            </span>
          </button>

          <!-- Notification Bell -->
          <div class="nav-notif-container" id="nav-notif-container">
            <button class="nav-notif-btn" id="nav-notif-btn" onclick="toggleNotifDropdown(event)" title="Notifications">
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
            <div class="nav-profile-btn" id="nav-profile-btn" onclick="toggleNavProfileDropdown(event)" title="Account Menu">
              <div class="nav-avatar-wrap">
                <img id="nav-avatar-img" src="" alt="" style="display:none"/>
                <i data-lucide="user" id="nav-avatar-icon"></i>
              </div>
            </div>

            <!-- Dropdown Menu -->
            <div class="nav-dropdown-menu" id="nav-profile-dropdown">
              <div class="nav-dropdown-header">
                <div style="font-weight:800;font-size:0.92rem;color:#fff;" id="nav-menu-username">Champion</div>
                <div style="font-size:0.75rem;color:var(--text-muted);" id="nav-menu-handle">@user</div>
              </div>
              <a href="profile?tab=overview" class="nav-dropdown-item">
                <i data-lucide="user"></i> My Profile
              </a>
              <a href="profile?tab=history" class="nav-dropdown-item">
                <i data-lucide="history"></i> History
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

        <button class="ct-nav__hamburger" id="nav-hamburger" onclick="toggleMobileNav()">
          <i data-lucide="menu"></i>
        </button>
      </div>

      <!-- Mobile drawer -->
      <div class="ct-nav__mobile" id="nav-mobile">
        ${navLinksHTML}
        <button class="nav-signout-btn mobile-signout" onclick="handleSignOut()">
          <i data-lucide="log-out"></i> Sign Out
        </button>
      </div>
    </nav>
    <div class="ct-nav-spacer"></div>

    <!-- Floating Active Match Indicator Widget (Top-Right under Navbar) -->
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
    </a>

            <!-- Universal Token Wallet Modal (Deposit & Redeem) -->
    <div class="modal-overlay" id="token-wallet-modal" onclick="if(event.target===this)closeTokenWalletModal()">
      <div class="modal" style="max-width:520px;">
        <div class="modal-header" style="padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,0.07);margin-bottom:18px;">
          <div class="modal-title" style="display:flex;align-items:center;gap:10px;">
            <img src="new_token.png" alt="CT" style="width:28px;height:28px;object-fit:contain;" />
            <span style="font-weight:900;font-size:1.15rem;color:#fff;">Token Wallet</span>
          </div>
          <button class="modal-close" onclick="closeTokenWalletModal()"><i data-lucide="x"></i></button>
        </div>

        <!-- 2 Segmented Tabs -->
        <div class="wallet-tabs">
          <button class="wallet-tab-btn active" id="tab-btn-wallet-purchase" onclick="switchWalletTab('purchase')">
            <i data-lucide="plus-circle"></i> <span>Deposit</span>
          </button>
          <button class="wallet-tab-btn" id="tab-btn-wallet-redeem" onclick="switchWalletTab('redeem')">
            <i data-lucide="gift"></i> <span>Redeem</span>
          </button>
        </div>

        <!-- Tab 1: Deposit Tokens -->
        <div id="wallet-tab-purchase-view">
          <div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:14px;">
            Select a token pack or deposit a custom amount:
          </div>
          <div class="wallet-packs-grid">
            <div class="wallet-pack-card">
              <img src="new_token.png" alt="5" style="width:40px;height:40px;object-fit:contain;margin-bottom:2px;" />
              <div style="font-weight:900;font-size:1.3rem;color:var(--gold-bright);">5.00</div>
              <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;">Starter Pack</div>
              <button class="btn btn-outline btn-full btn-sm" onclick="handleWalletBuy('Starter', '5.00', '5.00')" style="margin-top:4px;border-radius:10px;font-size:0.8rem;">
                Get for $5.00
              </button>
            </div>

            <div class="wallet-pack-card popular">
              <span class="badge" style="position:absolute;top:6px;right:6px;background:rgba(245,158,11,0.2);color:var(--gold-bright);border:1px solid rgba(245,158,11,0.4);font-size:0.65rem;padding:2px 7px;">Popular</span>
              <img src="new_token.png" alt="10" style="width:40px;height:40px;object-fit:contain;margin-bottom:2px;" />
              <div style="font-weight:900;font-size:1.3rem;color:var(--gold-bright);">10.00</div>
              <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;">Standard Pack</div>
              <button class="btn btn-primary btn-full btn-sm" onclick="handleWalletBuy('Standard', '10.00', '10.00')" style="margin-top:4px;border-radius:10px;font-size:0.8rem;">
                Get for $10.00
              </button>
            </div>

            <div class="wallet-pack-card">
              <img src="new_token.png" alt="25" style="width:40px;height:40px;object-fit:contain;margin-bottom:2px;" />
              <div style="font-weight:900;font-size:1.3rem;color:var(--gold-bright);">25.00</div>
              <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;">Pro Pack</div>
              <button class="btn btn-outline btn-full btn-sm" onclick="handleWalletBuy('Pro', '25.00', '25.00')" style="margin-top:4px;border-radius:10px;font-size:0.8rem;">
                Get for $25.00
              </button>
            </div>

            <div class="wallet-pack-card">
              <img src="new_token.png" alt="50" style="width:40px;height:40px;object-fit:contain;margin-bottom:2px;" />
              <div style="font-weight:900;font-size:1.3rem;color:var(--gold-bright);">50.00</div>
              <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;">Champion Pack</div>
              <button class="btn btn-outline btn-full btn-sm" onclick="handleWalletBuy('Champion', '50.00', '50.00')" style="margin-top:4px;border-radius:10px;font-size:0.8rem;">
                Get for $50.00
              </button>
            </div>
          </div>

          <!-- Custom Amount Form -->
          <div style="background:#060608;border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:14px 16px;margin-top:12px;">
            <div style="font-size:0.75rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">Custom Amount</div>
            <div style="display:flex;gap:8px;">
              <input type="number" id="custom-token-deposit-input" class="form-input" placeholder="Amount (min 1.00)" min="1" step="1" style="flex:1;background:#000;border-radius:10px;" />
              <button class="btn btn-primary btn-sm" onclick="handleCustomWalletBuy()" style="padding:0 18px;border-radius:10px;font-size:0.82rem;font-weight:800;">
                Deposit
              </button>
            </div>
          </div>
        </div>

        <!-- Tab 2: Redeem Code -->
        <div id="wallet-tab-redeem-view" style="display:none;">
          <div style="background:#060608;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:22px 20px;text-align:center;margin-bottom:12px;">
            <div style="width:48px;height:48px;border-radius:12px;background:rgba(245,158,11,0.12);display:flex;align-items:center;justify-content:center;color:var(--gold-bright);margin:0 auto 12px;">
              <i data-lucide="gift" style="width:24px;height:24px;"></i>
            </div>
            <div style="font-weight:900;font-size:1.2rem;color:#fff;margin-bottom:4px;">
              Redeem
            </div>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:16px;">
              Enter your code below to claim free tokens or exclusive cosmetics:
            </div>

            <div style="margin-bottom:14px;">
              <input
                type="text"
                id="wallet-redeem-code-input"
                class="form-input"
                placeholder="XXXX-XXXX-XXXX"
                style="text-align:center;font-weight:900;letter-spacing:0.08em;font-size:1.1rem;text-transform:uppercase;background:#000;border-radius:12px;padding:12px;"
                oninput="this.value = this.value.toUpperCase().trim()"
              />
            </div>

            <button class="btn btn-gold btn-full" id="wallet-redeem-submit-btn" onclick="handleRedeemCode()" style="border-radius:12px;padding:11px;font-size:0.88rem;gap:6px;">
              <i data-lucide="sparkles" style="width:15px;height:15px;"></i> <span>Redeem Reward</span>
            </button>
          </div>

          <div style="font-size:0.72rem;color:var(--text-faint);text-align:center;">
            Codes can only be redeemed once per account.
          </div>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('afterbegin', navHTML);
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

function toggleMobileNav() {
  const drawer = document.getElementById('nav-mobile');
  if (drawer) drawer.classList.toggle('open');
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
