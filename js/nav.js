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
    { href: 'dashboard',   key: 'dashboard',   icon: 'layout-dashboard', label: 'Dashboard'   },
    { href: 'matches',     key: 'matches',      icon: 'swords',           label: 'Matches'     },
    { href: 'leaderboard', key: 'leaderboard',  icon: 'trophy',           label: 'Leaderboard' },
    { href: 'shop',        key: 'shop',         icon: 'shopping-cart',    label: 'Shop'        },
  ];

  const navLinksHTML = links.map(l => `
    <a href="${l.href}" class="nav-link${activePage === l.key ? ' active' : ''}">
      <i data-lucide="${l.icon}"></i>
      <span>${l.label}</span>
    </a>`).join('');

  const navHTML = `
    <nav class="ct-nav" id="ct-nav">
      <div class="ct-nav__inner">
        <a href="dashboard" class="ct-nav__brand">
          <img src="champion_tokens_CT_v4.png" alt="Champion Tokens" class="brand-logo-img" />
          <span class="brand-text">Champion <span class="brand-accent">Tokens</span></span>
        </a>

        <div class="ct-nav__links">${navLinksHTML}</div>

        <div class="ct-nav__user">
          <div class="ct-nav__token-group">
            <div class="token-pill" title="Champion Tokens Balance">
              <img src="champion_token_coin.png" alt="CT" class="token-pill-coin" />
              <span id="nav-balance">10.00</span>
            </div>
            <a href="shop" class="token-add-btn" title="Add / Buy Tokens">
              <i data-lucide="plus"></i>
            </a>
          </div>

          <a href="profile" class="nav-avatar-wrap" id="nav-avatar-wrap" title="Profile">
            <img id="nav-avatar-img" src="" alt="" style="display:none"/>
            <i data-lucide="user" id="nav-avatar-icon"></i>
          </a>
          <button
            class="nav-signout-btn"
            title="Sign out"
            onclick="handleSignOut()"
          ><i data-lucide="log-out"></i></button>
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
    <div class="ct-nav-spacer"></div>`;

  document.body.insertAdjacentHTML('afterbegin', navHTML);
  injectFloatingIcons();
  lucide.createIcons();

  // Populate balance + avatar + admin link from Firestore in real-time
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

      // Check Admin status and inject Admin link if admin
      if (typeof isAdminUser === 'function' && isAdminUser(user, data)) {
        if (!document.getElementById('nav-admin-link')) {
          const linksContainer = document.querySelector('.ct-nav__links');
          if (linksContainer) {
            const adminLink = document.createElement('a');
            adminLink.id = 'nav-admin-link';
            adminLink.href = 'admin';
            adminLink.className = `nav-link${activePage === 'admin' ? ' active' : ''}`;
            adminLink.style.color = 'var(--red)';
            adminLink.innerHTML = `<i data-lucide="shield-alert"></i><span>Admin Panel</span>`;
            linksContainer.appendChild(adminLink);
            lucide.createIcons();
          }
        }
      }
    });
  });
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
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'|'warning'} type
 */
function showToast(message, type = 'success') {
  const iconMap = {
    success: 'check-circle',
    error:   'x-circle',
    info:    'info',
    warning: 'alert-triangle',
  };

  const toast = document.createElement('div');
  toast.className = `ct-toast ct-toast--${type}`;
  toast.innerHTML = `<i data-lucide="${iconMap[type] || 'info'}"></i><span>${message}</span>`;

  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  container.appendChild(toast);
  lucide.createIcons();

  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 3200);
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
