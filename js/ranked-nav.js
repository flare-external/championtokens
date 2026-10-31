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
      name: 'adrian',
      customName: '',
      tag: '#1337',
      isLoggedIn: true,
      avatar: '/adrian-avatar.png',
      isVip: true
    };

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        user = Object.assign(user, parsed);
        user.id = get12DigitContenderId(user.id || user.uid);
        if (!user.avatar || user.avatar.includes('images.unsplash.com')) {
          user.avatar = '/adrian-avatar.png';
          localStorage.setItem('ct_user', JSON.stringify(user));
        }
      } catch (e) {}
    } else {
      localStorage.setItem('ct_user', JSON.stringify(user));
    }
    return user;
  }

  function promptSetElo() {
    const currentVal = localStorage.getItem('ct_user_elo') || '9999';
    const input = prompt('Enter test ELO (e.g. 2450 for Elite, 2800 for Champion, 3500 for Unreal, or 0 for Unranked):', currentVal);
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
  }

  function ensureFloatingBackButton(activeTab) {
    const path = window.location.pathname;
    const isMain = path === '/main' || path === '/' || path === '/index.html' || activeTab === 'main' || activeTab === 'hub';
    if (isMain) return;

    if (!document.getElementById('ct-page-back-floating')) {
      const backBtn = document.createElement('a');
      backBtn.href = '/main';
      backBtn.className = 'ct-page-back-floating';
      backBtn.id = 'ct-page-back-floating';
      backBtn.title = 'Back to Arena';
      backBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="m15 18-6-6 6-6"/></svg>
        <span>Back</span>
      `;
      backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.history.length > 1 && document.referrer && document.referrer.includes(window.location.host)) {
          window.history.back();
        } else {
          window.location.href = '/main';
        }
      });
      document.body.appendChild(backBtn);
    }
  }

  function ensureUniversalFooter() {
    if (!document.querySelector('.ct-footer')) {
      const footer = document.createElement('footer');
      footer.className = 'ct-footer';
      footer.innerHTML = `
        <div style="font-size:0.75rem;color:#475569;">
          © 2026 Champion Tokens • Protected by Cloudflare
        </div>
      `;
      document.body.appendChild(footer);
    }
  }

  function renderSharedNav(activeTab = '') {
    const existingHeader = document.querySelector('header.landing-nav');
    const user = getActiveUser();

    const savedElo = localStorage.getItem('ct_user_elo');
    const isUnranked = localStorage.getItem('ct_is_unranked') === 'true';
    const elo = savedElo !== null ? parseInt(savedElo, 10) : 3500;
    const meta = getRankMeta(elo, isUnranked);

    // Top 2 ranks: Champion and Unreal get periodic shine animation
    const isTop2 = meta.name === 'Champion' || meta.name === 'Unreal';
    const isUnreal = meta.name === 'Unreal';

    const displayName = user.customName || user.name || 'Contender';
    const profileHref = `/profile/${user.id}`;

    const navHTML = `
      <div class="ct-nav-left">
        <a href="/main" class="brand-logo" style="text-decoration:none;">
          <span class="brand-logo-champion">CHAMPION</span> <span class="brand-logo-tokens">TOKENS</span>
        </a>
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
        <!-- Rank & ELO Typography (Left of Profile, No Box, Simple, Clickable, Animated for Top 2) -->
        <div class="ct-nav-rank-badge ${isTop2 ? 'rank-shine-top2' : ''} ${isUnreal ? 'rank-unreal' : ''}" id="ct-nav-rank-badge" title="Rank: ${meta.name} • ${meta.eloDisplay} (Click to set ELO)">
          <div class="ct-nav-rank-name">${meta.name}</div>
          <div class="ct-nav-rank-elo">${meta.eloDisplay}</div>
        </div>

        <!-- User Island -->
        <div class="ct-user-island" id="ct-user-island" title="User Menu">
          <img src="${user.avatar}" class="ct-island-avatar" id="island-user-avatar" alt="Avatar"/>
          <span class="ct-island-name" id="island-user-name">${displayName}</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="6 9 12 15 18 9"/></svg>
        </div>

        <!-- Solid Hamburger Menu (Pure Inline SVGs for 100% Reliable Visibility) -->
        <div class="ct-island-dropdown" id="ct-island-dropdown">
          <a href="${profileHref}" class="ct-island-profile-header">
            <img src="${user.avatar}" class="ct-island-dropdown-avatar" id="dropdown-user-avatar" alt="Avatar"/>
            <div class="ct-island-dropdown-meta">
              <span class="ct-island-dropdown-name" id="dropdown-user-name">${displayName}${user.tag || ''}</span>
              <span class="ct-island-dropdown-view">View your profile <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#53fc18" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:2px;"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></span>
            </div>
          </a>
          <div class="ct-island-divider"></div>
          <a href="/bonuses" class="ct-island-menu-item">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/></svg>
            <span>Referees & Bonuses</span>
          </a>
          <a href="/settings" class="ct-island-menu-item">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <span>Settings</span>
          </a>
          <div class="ct-island-divider"></div>
          <button type="button" class="ct-island-menu-item" id="btn-user-signout" style="color:#ef4444;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
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

    // Rank & ELO Badge Click -> Set ELO
    const navRankBadge = document.getElementById('ct-nav-rank-badge');
    if (navRankBadge) {
      navRankBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        promptSetElo();
      });
    }

    // Set ELO Test Button
    const navSetEloBtn = document.getElementById('btn-nav-set-elo');
    if (navSetEloBtn) {
      navSetEloBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        promptSetElo();
      });
    }

    // Fixed Floating Back Button that follows you around on subpages
    ensureFloatingBackButton(activeTab);

    // Universal Pinned Bottom Label everywhere
    ensureUniversalFooter();
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
