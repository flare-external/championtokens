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
    { href: 'dashboard.html',   key: 'dashboard',   icon: 'layout-dashboard', label: 'Dashboard'   },
    { href: 'matches.html',     key: 'matches',      icon: 'swords',           label: 'Matches'     },
    { href: 'leaderboard.html', key: 'leaderboard',  icon: 'trophy',           label: 'Leaderboard' },
    { href: 'shop.html',        key: 'shop',         icon: 'shopping-cart',    label: 'Shop'        },
  ];

  const navLinksHTML = links.map(l => `
    <a href="${l.href}" class="nav-link${activePage === l.key ? ' active' : ''}">
      <i data-lucide="${l.icon}"></i>
      <span>${l.label}</span>
    </a>`).join('');

  const navHTML = `
    <nav class="ct-nav" id="ct-nav">
      <div class="ct-nav__inner">
        <a href="dashboard.html" class="ct-nav__brand">
          <i data-lucide="shield" class="brand-icon"></i>
          <span class="brand-text">Champion <span class="brand-accent">Tokens</span></span>
        </a>

        <div class="ct-nav__links">${navLinksHTML}</div>

        <div class="ct-nav__user">
          <div class="token-pill">
            <i data-lucide="coins"></i>
            <span id="nav-balance">--</span>
          </div>
          <a href="profile.html" class="nav-avatar-wrap" id="nav-avatar-wrap" title="Profile">
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
  lucide.createIcons();

  // Populate balance + avatar from Firestore in real-time
  auth.onAuthStateChanged((user) => {
    if (!user) return;
    db.collection('users').doc(user.uid).onSnapshot((snap) => {
      if (!snap.exists) return;
      const data = snap.data();

      // Balance
      const balEl = document.getElementById('nav-balance');
      if (balEl) balEl.textContent = (data.tokens ?? 0).toLocaleString();

      // Avatar
      const img  = document.getElementById('nav-avatar-img');
      const icon = document.getElementById('nav-avatar-icon');
      if (img && icon && data.photoURL) {
        img.src = data.photoURL;
        img.style.display = 'block';
        icon.style.display = 'none';
      }
    });
  });
}

function handleSignOut() {
  signOut().then(() => { window.location.href = 'index.html'; });
}

function toggleMobileNav() {
  const drawer = document.getElementById('nav-mobile');
  if (drawer) drawer.classList.toggle('open');
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

function formatTokens(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString();
}

function txTypeLabel(type) {
  const labels = {
    bonus:       '🎉 Welcome Bonus',
    daily:       '🎁 Daily Claim',
    match_wager: '🎮 Match Wager',
    match_win:   '🏆 Match Win',
    purchase:    '💳 Purchase',
    admin:       '⚡ Admin Grant',
  };
  return labels[type] || type;
}

function modeColor(mode) {
  const map = { Solo: 'mode-solo', Duos: 'mode-duos', Squads: 'mode-squads' };
  return map[mode] || 'mode-solo';
}
