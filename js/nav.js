// ============================================================
//  CHAMPION TOKENS — Shared Navigation + UI Helpers
// ============================================================

/**
 * Inject the top navigation bar into the page.
 * Call after DOMContentLoaded.
 * @param {string} activePage  'dashboard' | 'matches' | 'leaderboard' | 'shop' | 'profile'
 */
function injectNav(activePage = '') {
  const links = [
    { href: 'dashboard',   key: 'dashboard',   icon: 'layout-grid',   label: 'Dashboard'   },
    { href: 'matches',     key: 'matches',      icon: 'swords',        label: 'Matches'     },
    { href: 'tournaments', key: 'tournaments',  icon: 'trophy',        label: 'Tournaments' },
    { href: 'leaderboard', key: 'leaderboard',  icon: 'award',         label: 'Leaderboard' },
    { href: 'shop',        key: 'shop',         icon: 'shopping-bag',  label: 'Shop'        },
  ];

  const navLinksHTML = links.map(l => `
    <a href="${l.href}" class="nav-link${activePage === l.key ? ' active' : ''}" ${l.onClick ? `onclick="${l.onClick}"` : ''}>
      <i data-lucide="${l.icon}"></i>
      <span>${l.label}</span>
      ${l.badge ? `<span class="nav-soon-badge">${l.badge}</span>` : ''}
    </a>`).join('');

  const navHTML = `
    <nav class="ct-nav" id="ct-nav">
      <div class="ct-nav__inner">
        <a href="dashboard" class="ct-nav__brand">
          <img src="champion_tokens_CT_v4.png" alt="Champion Tokens" class="brand-logo-img" width="32" height="32" />
          <span class="brand-text">Champion <span class="brand-accent">Tokens</span></span>
        </a>

        <div class="ct-nav__links">${navLinksHTML}</div>

        <div class="ct-nav__user">
          <button class="nav-token-btn" onclick="openTokenWalletModal('purchase')" title="Add Tokens / View Wallet">
            <img src="champion_token_coin.png" alt="CT" class="nav-token-coin" width="20" height="20" />
            <span id="nav-balance">10.00</span>
            <span class="nav-token-plus">+</span>
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

    <!-- Universal Token Wallet Modal (Purchase & Withdraw) -->
    <div class="modal-overlay" id="token-wallet-modal" onclick="if(event.target===this)closeTokenWalletModal()">
      <div class="modal" style="max-width:520px;">
        <div class="modal-header">
          <div class="modal-title" style="display:flex;align-items:center;gap:10px;">
            <img src="champion_token_coin.png" alt="CT" style="width:26px;height:26px;object-fit:contain;filter:drop-shadow(0 0 6px rgba(245,158,11,0.6));" />
            <span>Token Wallet</span>
          </div>
          <button class="modal-close" onclick="closeTokenWalletModal()"><i data-lucide="x"></i></button>
        </div>

        <!-- Tabs -->
        <div class="wallet-tabs">
          <button class="wallet-tab-btn active" id="tab-btn-wallet-purchase" onclick="switchWalletTab('purchase')">
            <i data-lucide="shopping-cart"></i> Purchase Tokens
          </button>
          <button class="wallet-tab-btn" id="tab-btn-wallet-withdraw" onclick="switchWalletTab('withdraw')">
            <i data-lucide="arrow-up-right"></i> Withdraw
          </button>
        </div>

        <!-- Purchase Tab -->
        <div id="wallet-tab-purchase-view">
          <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:14px;">
            Select a token pack to add balance to your account:
          </div>
          <div class="wallet-packs-grid">
            <div class="wallet-pack-card">
              <img src="champion_token_coin.png" alt="5" style="width:36px;height:36px;object-fit:contain;" />
              <div style="font-weight:900;font-size:1.4rem;color:var(--gold-bright);">5.00</div>
              <div style="font-size:0.75rem;color:var(--text-muted);">Starter Pack</div>
              <button class="btn btn-outline btn-full btn-sm" onclick="handleWalletBuy('Starter', '5.00', '5.00')">
                Get for $5.00
              </button>
            </div>

            <div class="wallet-pack-card popular">
              <span class="equipped-badge-indicator" style="top:6px;right:6px;">Popular</span>
              <img src="champion_token_coin.png" alt="10" style="width:36px;height:36px;object-fit:contain;" />
              <div style="font-weight:900;font-size:1.4rem;color:var(--gold-bright);">10.00</div>
              <div style="font-size:0.75rem;color:var(--text-muted);">Standard Pack</div>
              <button class="btn btn-primary btn-full btn-sm" onclick="handleWalletBuy('Standard', '10.00', '10.00')">
                Get for $10.00
              </button>
            </div>

            <div class="wallet-pack-card">
              <img src="champion_token_coin.png" alt="25" style="width:36px;height:36px;object-fit:contain;" />
              <div style="font-weight:900;font-size:1.4rem;color:var(--gold-bright);">25.00</div>
              <div style="font-size:0.75rem;color:var(--text-muted);">Pro Pack</div>
              <button class="btn btn-outline btn-full btn-sm" onclick="handleWalletBuy('Pro', '25.00', '25.00')">
                Get for $25.00
              </button>
            </div>

            <div class="wallet-pack-card">
              <img src="champion_token_coin.png" alt="50" style="width:36px;height:36px;object-fit:contain;" />
              <div style="font-weight:900;font-size:1.4rem;color:var(--gold-bright);">50.00</div>
              <div style="font-size:0.75rem;color:var(--text-muted);">Champion Pack</div>
              <button class="btn btn-outline btn-full btn-sm" onclick="handleWalletBuy('Champion', '50.00', '50.00')">
                Get for $50.00
              </button>
            </div>
          </div>
        </div>

        <!-- Withdraw Tab -->
        <div id="wallet-tab-withdraw-view" style="display:none;">
          <div class="withdraw-coming-soon-box">
            <div style="width:54px;height:54px;border-radius:50%;background:rgba(245,158,11,0.15);border:1px solid var(--gold-bright);display:flex;align-items:center;justify-content:center;color:var(--gold-bright);font-size:1.6rem;box-shadow:0 0 20px rgba(245,158,11,0.35);">
              <i data-lucide="lock"></i>
            </div>
            <div style="font-size:1.25rem;font-weight:900;color:#fff;">Withdrawals Coming Soon</div>
            <p style="font-size:0.85rem;color:var(--text-muted);line-height:1.5;max-width:360px;">
              Our automated withdrawal gateway for instant <strong>Crypto (USDT / SOL / LTC)</strong> & <strong>PayPal</strong> payouts is currently undergoing security audits.
            </p>
            <span class="chip chip-gold" style="font-size:0.75rem;padding:4px 14px;font-weight:800;">
              ⚡ Launching In Next Update
            </span>
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

      // Balance (2 decimals)
      const balEl = document.getElementById('nav-balance');
      if (balEl) balEl.textContent = formatTokens(data.tokens);

      // Avatar
      const img  = document.getElementById('nav-avatar-img');
      const icon = document.getElementById('nav-avatar-icon');
      if (img && icon && data.photoURL) {
        img.src = data.photoURL;
        img.style.display = 'block';
        icon.style.display = 'none';
      }

      // Username in dropdown
      const menuName = document.getElementById('nav-menu-username');
      const menuHandle = document.getElementById('nav-menu-handle');
      if (menuName) menuName.textContent = data.displayName || 'Champion';
      if (menuHandle) menuHandle.textContent = data.discordUsername ? `@${data.discordUsername}` : (data.email || `@${user.uid.slice(0, 8)}`);

      // Admin link — show if isAdmin flag OR hardcoded Discord ID
      const adminLink = document.getElementById('nav-admin-link');
      if (adminLink) {
        const discordId = data.discordId || snap.id.replace('discord:', '');
        const isAdmin = data.isAdmin === true || ['1121188319410278420'].includes(discordId);
        if (isAdmin) adminLink.style.display = 'flex';
      }
    });

    // Real-time notifications
    if (typeof subscribeNotifications === 'function') {
      subscribeNotifications(user.uid, (notifs) => {
        renderNavNotifications(user.uid, notifs);
      });
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
    match_win: '🏆',
    match_join: '🎮',
    team_invite: '🤝',
    income: '💰',
    system: '📢',
    admin: '⚡',
  };

  list.innerHTML = notifs.map(n => {
    const icon = iconMap[n.type] || '🔔';
    const timeStr = n.createdAt ? formatTime(n.createdAt) : '';
    const isTeamInvite = n.type === 'team_invite' && !n.read && !n.accepted && !n.declined;

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
          ${timeStr ? `<div style="font-size:0.72rem;color:var(--text-faint);margin-top:4px;">${timeStr}</div>` : ''}
        </div>
        ${!n.read && !isTeamInvite ? `<div class="nav-notif-dot"></div>` : ''}
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
  const btnWithdraw = document.getElementById('tab-btn-wallet-withdraw');
  const viewPurchase = document.getElementById('wallet-tab-purchase-view');
  const viewWithdraw = document.getElementById('wallet-tab-withdraw-view');

  if (tab === 'purchase') {
    if (btnPurchase) btnPurchase.classList.add('active');
    if (btnWithdraw) btnWithdraw.classList.remove('active');
    if (viewPurchase) viewPurchase.style.display = 'block';
    if (viewWithdraw) viewWithdraw.style.display = 'none';
  } else {
    if (btnPurchase) btnPurchase.classList.remove('active');
    if (btnWithdraw) btnWithdraw.classList.add('active');
    if (viewPurchase) viewPurchase.style.display = 'none';
    if (viewWithdraw) viewWithdraw.style.display = 'block';
  }
}

async function handleWalletBuy(packName, tokenAmount, usdPrice) {
  const user = auth.currentUser;
  if (!user) {
    showToast('Please log in to purchase tokens', 'error');
    return;
  }
  const amount = parseFloat(tokenAmount);
  try {
    await updateTokens(user.uid, amount, 'purchase', `💳 Purchased ${packName} Pack (${formatTokens(amount)} Tokens)`);
    showToast(`Successfully added ${formatTokens(amount)} Tokens to your balance!`, 'success');
    closeTokenWalletModal();
  } catch (err) {
    showToast(err.message, 'error');
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
    bonus:       '🎉 Welcome Bonus',
    match_wager: '🎮 Match Wager',
    match_win:   '🏆 Match Win',
    purchase:    '💳 Token Purchase',
    admin:       '⚡ Admin Grant',
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
