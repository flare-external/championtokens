// ============================================================
//  CHAMPION TOKENS — Unified Ranked Navigation Component
// ============================================================

(function () {
  'use strict';

  function getRankMeta(elo, isUnranked) {
    if (isUnranked || elo <= 0) {
      return { name: 'Unranked', icon: '/medal-ranks/svg/01-bronze.svg', eloDisplay: '0/5 Placements', isUnranked: true };
    }
    if (elo < 500) return { name: 'Bronze', icon: '/medal-ranks/svg/01-bronze.svg', eloDisplay: `${elo.toLocaleString()} ELO` };
    if (elo < 1000) return { name: 'Silver', icon: '/medal-ranks/svg/02-silver.svg', eloDisplay: `${elo.toLocaleString()} ELO` };
    if (elo < 1500) return { name: 'Gold', icon: '/medal-ranks/svg/03-gold.svg', eloDisplay: `${elo.toLocaleString()} ELO` };
    if (elo < 2000) return { name: 'Platinum', icon: '/medal-ranks/svg/04-platinum.svg', eloDisplay: `${elo.toLocaleString()} ELO` };
    if (elo < 2400) return { name: 'Diamond', icon: '/medal-ranks/svg/05-diamond.svg', eloDisplay: `${elo.toLocaleString()} ELO` };
    if (elo < 2700) return { name: 'Elite', icon: '/medal-ranks/svg/06-elite.svg', eloDisplay: `${elo.toLocaleString()} ELO` };
    if (elo < 3000) return { name: 'Champion', icon: '/medal-ranks/svg/07-champion.svg', eloDisplay: `${elo.toLocaleString()} ELO` };
    return { name: 'Unreal', icon: '/medal-ranks/svg/10-star.svg', eloDisplay: `${elo.toLocaleString()} ELO` };
  }

  function get12DigitContenderId(rawId) {
    if (rawId && typeof rawId === 'string') {
      const digits = rawId.replace(/\D/g, '');
      if (digits.length >= 12) {
        const cid = digits.slice(0, 12);
        localStorage.setItem('ct_contender_id', cid);
        return cid;
      }
    }
    let cid = localStorage.getItem('ct_contender_id');
    if (cid && /^\d{12}$/.test(cid)) return cid;
    cid = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    localStorage.setItem('ct_contender_id', cid);
    return cid;
  }

  function getActiveUser() {
    const raw = localStorage.getItem('ct_user');
    let cid = get12DigitContenderId();

    let user = {
      id: cid,
      name: 'Zenox',
      customName: '',
      tag: '#1337',
      isLoggedIn: true,
      avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=120&auto=format&fit=crop&q=80',
      isVip: false
    };

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        user = Object.assign(user, parsed);
        user.id = get12DigitContenderId(user.id || user.uid);
      } catch (e) {}
    } else {
      localStorage.setItem('ct_user', JSON.stringify(user));
    }
    return user;
  }

  function renderSharedNav(activeTab = '') {
    const existingHeader = document.querySelector('header.landing-nav');
    const user = getActiveUser();

    const savedElo = localStorage.getItem('ct_user_elo');
    const isUnranked = localStorage.getItem('ct_is_unranked') === 'true';
    const elo = savedElo !== null ? parseInt(savedElo, 10) : 2450;
    const meta = getRankMeta(elo, isUnranked);

    const displayName = user.customName || user.name || 'Contender';
    const profileHref = `/profile/${user.id}`;

    const navHTML = `
      <div class="ct-nav-left">
        <a href="/main" class="brand-logo" style="text-decoration:none;">
          <span class="brand-logo-champion">CHAMPION</span> <span class="brand-logo-tokens">TOKENS</span>
        </a>
        <a href="/main" class="ct-nav-back-btn" title="Back to Arena">
          <i data-lucide="arrow-left" style="width:14px;height:14px;"></i>
          <span>Back</span>
        </a>
        <div class="ct-header-rank-pill" id="ct-header-rank-pill" title="Ranked Arena" onclick="window.location.href='/main'">
          <img src="${meta.icon}" class="ct-header-rank-icon" alt="${meta.name}"/>
          <div class="ct-header-rank-info">
            <span class="ct-header-rank-name">${meta.name}</span>
            <span class="ct-header-rank-elo">${meta.eloDisplay}</span>
          </div>
        </div>
        <button type="button" class="ct-set-elo-btn" id="btn-nav-set-elo" title="Test tool to set your ELO">
          Set ELO
        </button>
      </div>

      <!-- Top Middle Navigation Links -->
      <nav class="ct-nav-center">
        <a href="/main" class="ct-nav-link ${activeTab === 'main' ? 'active' : ''}">Main</a>
        <a href="/leaderboard" class="ct-nav-link ${activeTab === 'leaderboard' ? 'active' : ''}">Leaderboard</a>
        <a href="/season-pass" class="ct-nav-link ${activeTab === 'shop' || activeTab === 'pass' || activeTab === 'season-pass' ? 'active' : ''}">Season Pass</a>
      </nav>

      <div class="ct-nav-right">
        <!-- User Island -->
        <div class="ct-user-island" id="ct-user-island" title="User Menu">
          <img src="${user.avatar}" class="ct-island-avatar" id="island-user-avatar" alt="Avatar"/>
          <span class="ct-island-name" id="island-user-name">${displayName}</span>
          <i data-lucide="chevron-down" style="width:14px;height:14px;color:#94a3b8;"></i>
        </div>

        <!-- Solid Hamburger Menu -->
        <div class="ct-island-dropdown" id="ct-island-dropdown">
          <a href="${profileHref}" class="ct-island-profile-header">
            <img src="${user.avatar}" class="ct-island-dropdown-avatar" id="dropdown-user-avatar" alt="Avatar"/>
            <div class="ct-island-dropdown-meta">
              <span class="ct-island-dropdown-name" id="dropdown-user-name">${displayName}${user.tag || ''}</span>
              <span class="ct-island-dropdown-view">View your profile →</span>
            </div>
          </a>
          <div class="ct-island-divider"></div>
          <a href="/bonuses" class="ct-island-menu-item">
            <i data-lucide="gift" style="width:16px;height:16px;color:#fbbf24;"></i>
            <span>Referees</span>
          </a>
          <a href="/settings" class="ct-island-menu-item">
            <i data-lucide="settings" style="width:16px;height:16px;color:#94a3b8;"></i>
            <span>Settings</span>
          </a>
          <div class="ct-island-divider"></div>
          <button type="button" class="ct-island-menu-item" id="btn-user-signout" style="color:#ef4444;">
            <i data-lucide="log-out" style="width:16px;height:16px;color:#ef4444;"></i>
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    `;

    if (existingHeader) {
      existingHeader.innerHTML = navHTML;
    } else {
      const header = document.createElement('header');
      header.className = 'landing-nav';
      header.setAttribute('role', 'banner');
      header.style.cssText = 'background:#000000;border-bottom:1px solid rgba(255,255,255,0.08);padding:14px 28px;position:relative;z-index:100;';
      header.innerHTML = navHTML;
      document.body.prepend(header);
    }

    // Toggle Dropdown
    const island = document.getElementById('ct-user-island');
    const dropdown = document.getElementById('ct-island-dropdown');
    if (island && dropdown) {
      island.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
      });
      document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && !island.contains(e.target)) {
          dropdown.classList.remove('open');
        }
      });
    }

    // Sign out button
    const signOutBtn = document.getElementById('btn-user-signout');
    if (signOutBtn) {
      signOutBtn.addEventListener('click', () => {
        if (typeof signOut === 'function') {
          try { signOut(); } catch (e) {}
        }
        localStorage.removeItem('ct_user');
        window.location.href = '/main';
      });
    }

    // Set ELO Test Button
    const navSetEloBtn = document.getElementById('btn-nav-set-elo');
    if (navSetEloBtn) {
      navSetEloBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentVal = localStorage.getItem('ct_user_elo') || '9999';
        const input = prompt('Enter test ELO (e.g. 2450 for Elite, 3000 for Unreal, 9999, or 0 for Unranked):', currentVal);
        if (input === null) return;
        const val = parseInt(input.trim(), 10);
        if (isNaN(val) || val < 0) {
          alert('Please enter a valid non-negative number for ELO.');
          return;
        }
        if (val === 0) {
          localStorage.setItem('ct_is_unranked', 'true');
          localStorage.setItem('ct_user_elo', '0');
        } else {
          localStorage.setItem('ct_is_unranked', 'false');
          localStorage.setItem('ct_user_elo', val.toString());
        }
        window.location.reload();
      });
    }

    if (window.lucide) window.lucide.createIcons();
  }

  window.renderSharedRankedNav = renderSharedNav;
  window.get12DigitContenderId = get12DigitContenderId;

  // Auto initialize if data-page attribute is on body
  document.addEventListener('DOMContentLoaded', () => {
    const pageAttr = document.body.getAttribute('data-ct-page');
    if (pageAttr && pageAttr !== 'hub') {
      renderSharedNav(pageAttr);
    }
  });

})();
