/**
 * Ranked Navigation & Universal Utilities
 * Handles navigation bar, rank medal display, coin collectible,
 * daily login rewards, terms of service modal, and universal footer.
 */

(function () {
  'use strict';

  function get12DigitContenderId() {
    let id = localStorage.getItem('ct_contender_id');
    if (!id || id.length !== 12 || !/^\d{12}$/.test(id)) {
      id = '';
      for (let i = 0; i < 12; i++) {
        id += Math.floor(Math.random() * 10).toString();
      }
      localStorage.setItem('ct_contender_id', id);
    }
    return id;
  }

  function getActiveUser() {
    const raw = localStorage.getItem('ct_user');
    let user = null;
    if (raw) {
      try {
        user = JSON.parse(raw);
      } catch (e) {}
    }
    const cid = get12DigitContenderId();

    if (!user) {
      user = {
        id: cid,
        name: 'adrian',
        customName: 'adrian',
        avatar: '/adrian-avatar.png',
        tag: ''
      };
      localStorage.setItem('ct_user', JSON.stringify(user));
    } else {
      if (!user.id || user.id.length !== 12 || !/^\d{12}$/.test(user.id)) {
        user.id = cid;
        localStorage.setItem('ct_user', JSON.stringify(user));
      }
      if (!user.avatar || user.avatar.includes('unsplash') || user.avatar.includes('discordapp')) {
        user.avatar = '/adrian-avatar.png';
        localStorage.setItem('ct_user', JSON.stringify(user));
      }
    }
    return user;
  }

  function getRankMeta(elo, isUnranked) {
    if (isUnranked || elo <= 0) {
      return { name: 'Unranked', icon: '/medal-ranks/svg/01-bronze.svg', eloDisplay: '0/5 Placements', isUnranked: true, tierIndex: -1, place: '#--' };
    }
    if (elo < 500) {
      return { name: 'Bronze', icon: '/medal-ranks/svg/01-bronze.svg', eloDisplay: `${elo.toLocaleString()} ELO`, isUnranked: false, tierIndex: 0, place: '#8,421' };
    } else if (elo < 1000) {
      return { name: 'Silver', icon: '/medal-ranks/svg/02-silver.svg', eloDisplay: `${elo.toLocaleString()} ELO`, isUnranked: false, tierIndex: 1, place: '#5,120' };
    } else if (elo < 1500) {
      return { name: 'Gold', icon: '/medal-ranks/svg/03-gold.svg', eloDisplay: `${elo.toLocaleString()} ELO`, isUnranked: false, tierIndex: 2, place: '#3,204' };
    } else if (elo < 2000) {
      return { name: 'Platinum', icon: '/medal-ranks/svg/04-platinum.svg', eloDisplay: `${elo.toLocaleString()} ELO`, isUnranked: false, tierIndex: 3, place: '#1,450' };
    } else if (elo < 2400) {
      return { name: 'Diamond', icon: '/medal-ranks/svg/05-diamond.svg', eloDisplay: `${elo.toLocaleString()} ELO`, isUnranked: false, tierIndex: 4, place: '#620' };
    } else if (elo < 2700) {
      return { name: 'Elite', icon: '/medal-ranks/svg/06-elite.svg', eloDisplay: `${elo.toLocaleString()} ELO`, isUnranked: false, tierIndex: 5, place: '#120' };
    } else if (elo < 3000) {
      return { name: 'Champion', icon: '/medal-ranks/svg/07-champion.svg', eloDisplay: `${elo.toLocaleString()} ELO`, isUnranked: false, tierIndex: 6, place: '#42' };
    } else {
      return { name: 'Unreal', icon: '/medal-ranks/svg/10-star.svg', eloDisplay: `${elo.toLocaleString()} ELO`, isUnranked: false, tierIndex: 7, place: '#1' };
    }
  }

  function getUserCoins() {
    const val = localStorage.getItem('ct_user_coins');
    return val !== null ? parseInt(val, 10) : 100;
  }

  function setUserCoins(val) {
    localStorage.setItem('ct_user_coins', val.toString());
    const countEls = document.querySelectorAll('#nav-coin-count, #header-coin-count');
    countEls.forEach(el => el.textContent = val.toLocaleString());
  }

  function getDailyState() {
    const lastClaim = localStorage.getItem('ct_daily_last_claim');
    const streak = parseInt(localStorage.getItem('ct_daily_streak') || '0', 10);
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    let canClaim = true;
    let currentStreak = streak;

    if (lastClaim) {
      const diff = now - parseInt(lastClaim, 10);
      if (diff < oneDay) {
        canClaim = false;
      } else if (diff > oneDay * 2) {
        currentStreak = 0;
      }
    }
    return { canClaim, streak: currentStreak };
  }

  function promptSetElo() {
    const current = localStorage.getItem('ct_user_elo') || '3500';
    const input = prompt(
      'Set your ELO rating for live testing:\n• Enter "0" for Unranked (0/5 Placements)\n• Or enter a rating number (e.g. 450, 1200, 2450, 3100):',
      current
    );
    if (input === null) return;
    const trimmed = input.trim();
    const val = parseInt(trimmed, 10);
    if (trimmed === '0' || isNaN(val) || val <= 0) {
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

  function ensureFloatingBackground() {
    if (document.getElementById('floating-icons-container')) return;

    const icons = [
      { svg: '<circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/>', top: '12%', left: '8%', size: 32, dur: '18s', delay: '0s' },
      { svg: '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" x2="9" y1="14" y2="18"/><line x1="7" x2="4" y1="17" y2="20"/><line x1="3" x2="5" y1="21" y2="19"/>', top: '42%', left: '84%', size: 36, dur: '22s', delay: '2s' },
      { svg: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', top: '65%', left: '6%', size: 30, dur: '20s', delay: '4s' },
      { svg: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.45 1-1 1H7c-.55 0-1 .45-1 1v1h12v-1c0-.55-.45-1-1-1h-2c-.55 0-1-.45-1-1v-2.34"/><path d="M6 4h12v5a6 6 0 0 1-12 0Z"/>', top: '78%', left: '92%', size: 34, dur: '25s', delay: '1s' },
      { svg: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>', top: '45%', left: '95%', size: 28, dur: '17s', delay: '5s' },
      { svg: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>', top: '85%', left: '18%', size: 30, dur: '24s', delay: '3s' },
      { svg: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>', top: '38%', left: '3%', size: 26, dur: '19s', delay: '6s' },
      { svg: '<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/>', top: '15%', left: '75%', size: 32, dur: '21s', delay: '2.5s' }
    ];

    const container = document.createElement('div');
    container.id = 'floating-icons-container';
    container.className = 'floating-icons-layer';
    container.innerHTML = icons.map(ic => `
      <div class="floating-icon-item" style="top:${ic.top};left:${ic.left};animation-duration:${ic.dur};animation-delay:${ic.delay};">
        <svg width="${ic.size}" height="${ic.size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ic.svg}</svg>
      </div>
    `).join('');

    document.body.prepend(container);
  }

  function ensureRanksModal(meta) {
    if (document.getElementById('ranks-modal')) return;

    const ranks = [
      { name: 'Bronze', icon: '/medal-ranks/svg/01-bronze.svg', elo: '0 - 499 ELO', color: '#cd7f32', tierIndex: 0 },
      { name: 'Silver', icon: '/medal-ranks/svg/02-silver.svg', elo: '500 - 999 ELO', color: '#c0c0c0', tierIndex: 1 },
      { name: 'Gold', icon: '/medal-ranks/svg/03-gold.svg', elo: '1,000 - 1,499 ELO', color: '#f59e0b', tierIndex: 2 },
      { name: 'Platinum', icon: '/medal-ranks/svg/04-platinum.svg', elo: '1,500 - 1,999 ELO', color: '#38bdf8', tierIndex: 3 },
      { name: 'Diamond', icon: '/medal-ranks/svg/05-diamond.svg', elo: '2,000 - 2,399 ELO', color: '#a855f7', tierIndex: 4 },
      { name: 'Elite', icon: '/medal-ranks/svg/06-elite.svg', elo: '2,400 - 2,699 ELO', color: '#ef4444', tierIndex: 5 },
      { name: 'Champion', icon: '/medal-ranks/svg/07-champion.svg', elo: '2,700 - 2,999 ELO', color: '#f97316', tierIndex: 6 },
      { name: 'Unreal', icon: '/medal-ranks/svg/10-star.svg', elo: '3,000+ ELO', color: '#53fc18', tierIndex: 7 }
    ];

    const modal = document.createElement('div');
    modal.className = 'ct-modal-overlay';
    modal.id = 'ranks-modal';

    const rowsHTML = ranks.map((r) => {
      const isCurrent = !meta.isUnranked && meta.tierIndex === r.tierIndex;
      return `
        <div class="ct-rank-row-item ${isCurrent ? 'current-rank' : ''}" data-tier-index="${r.tierIndex}">
          <div class="ct-rank-row-left">
            <img src="${r.icon}" class="ct-rank-row-img" alt="${r.name}"/>
            <div class="ct-rank-row-name">${r.name}</div>
          </div>
          <div class="ct-rank-row-elo" style="color:${r.color};">
            ${r.elo}
            ${isCurrent ? '<span class="ct-current-rank-badge">YOU</span>' : ''}
          </div>
        </div>
      `;
    }).join('');

    modal.innerHTML = `
      <div class="ct-ranks-modal-card">
        <button type="button" class="ct-modal-close-btn" id="btn-close-ranks-modal">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>

        <div class="ct-modal-title" style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#53fc18" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span style="font-family:'Outfit',sans-serif;font-weight:700;font-size:1.15rem;color:#ffffff;">Rank & ELO System</span>
        </div>

        <!-- List of Ranks -->
        <div class="ct-ranks-list-scroll">
          ${rowsHTML}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('#btn-close-ranks-modal');
    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('open'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });
  }

  function ensureDailyRewardModal() {
    if (document.getElementById('daily-reward-modal')) return;

    const dailyRewards = [50, 75, 100, 125, 150, 200, 300];
    const { canClaim, streak } = getDailyState();
    const activeDayIdx = Math.min(streak, 6);

    const modal = document.createElement('div');
    modal.className = 'ct-modal-overlay';
    modal.id = 'daily-reward-modal';

    const cardsHTML = dailyRewards.map((coins, idx) => {
      const isClaimed = idx < activeDayIdx || (idx === activeDayIdx && !canClaim);
      const isActive = idx === activeDayIdx && canClaim;
      return `
        <div class="ct-daily-card ${isClaimed ? 'claimed' : ''} ${isActive ? 'active' : ''}">
          <div class="ct-daily-card-day">Day ${idx + 1}</div>
          <div class="ct-daily-card-val">+${coins}</div>
          <div class="ct-daily-card-tag">${isClaimed ? 'Claimed' : (isActive ? 'Ready' : 'Locked')}</div>
        </div>
      `;
    }).join('');

    modal.innerHTML = `
      <div class="ct-ranks-modal-card" style="max-width:540px;">
        <button type="button" class="ct-modal-close-btn" id="btn-close-daily-modal">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>

        <div class="ct-modal-title" style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          <span style="font-family:'Outfit',sans-serif;font-weight:700;font-size:1.15rem;color:#ffffff;">Daily Login Reward</span>
        </div>
        <div style="font-size:0.78rem;color:#94a3b8;margin-bottom:12px;">
          Log in daily to claim free Champion Coins and build your claim streak!
        </div>

        <div class="ct-daily-grid">
          ${cardsHTML}
        </div>

        <div style="margin-top:16px;">
          <button type="button" id="btn-claim-daily" style="width:100%;font-weight:800;font-size:0.92rem;padding:12px;border:none;border-radius:10px;transition:all 0.15s ease;${canClaim ? 'background:#fbbf24;color:#000;cursor:pointer;' : 'background:rgba(255,255,255,0.06);color:#64748b;cursor:default;'}" ${!canClaim ? 'disabled' : ''}>
            ${canClaim ? `Claim Day ${activeDayIdx + 1} (+${dailyRewards[activeDayIdx]} Coins)` : 'Claimed Today • Next Reward Tomorrow'}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#btn-close-daily-modal')?.addEventListener('click', () => modal.classList.remove('open'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });

    const claimBtn = modal.querySelector('#btn-claim-daily');
    if (claimBtn && canClaim) {
      claimBtn.addEventListener('click', () => {
        const reward = dailyRewards[activeDayIdx];
        const newTotal = getUserCoins() + reward;
        setUserCoins(newTotal);
        localStorage.setItem('ct_daily_last_claim', Date.now().toString());
        localStorage.setItem('ct_daily_streak', (activeDayIdx + 1).toString());
        claimBtn.disabled = true;
        claimBtn.style.background = 'rgba(255,255,255,0.06)';
        claimBtn.style.color = '#64748b';
        claimBtn.style.cursor = 'default';
        claimBtn.textContent = 'Claimed Today • Next Reward Tomorrow';
        modal.classList.remove('open');
        alert(`Claimed +${reward} Coins! Total: ${newTotal.toLocaleString()} Coins`);
      });
    }
  }

  // ── Clean & Simple Terms of Service Modal (No Outline) ────────
  function ensureTosModal() {
    if (document.getElementById('tos-modal')) return;

    const isAccepted = localStorage.getItem('ct_tos_accepted_v3') === 'true';

    const modal = document.createElement('div');
    modal.className = 'ct-modal-overlay';
    modal.id = 'tos-modal';
    modal.style.zIndex = '3500';

    modal.innerHTML = `
      <div class="ct-tos-card">
        <button type="button" class="ct-modal-close-btn" id="btn-close-tos-modal" style="${!isAccepted ? 'display:none;' : ''}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>

        <div class="ct-tos-header">
          <h2 class="ct-tos-title">Terms of Service & Rules</h2>
          <p class="ct-tos-subtitle">Please review and agree to the rules before entering matchmaking.</p>
        </div>

        <div class="ct-tos-body">
          <div class="ct-tos-item">
            <span class="ct-tos-item-dot"></span>
            <div class="ct-tos-item-content">
              <div class="ct-tos-item-title">Anti-Cheat & Integrity</div>
              <p class="ct-tos-item-desc">Zero tolerance for cheats, macros, memory injectors, or hardware exploits. Permanent hardware and IP blacklist on violation.</p>
            </div>
          </div>

          <div class="ct-tos-item">
            <span class="ct-tos-item-dot"></span>
            <div class="ct-tos-item-content">
              <div class="ct-tos-item-title">Fair Matchmaking & ELO</div>
              <p class="ct-tos-item-desc">No win-trading, match dodging, griefing, or intentional throwing. Violators face rating reset and competitive suspension.</p>
            </div>
          </div>

          <div class="ct-tos-item">
            <span class="ct-tos-item-dot"></span>
            <div class="ct-tos-item-content">
              <div class="ct-tos-item-title">Single Account Rule</div>
              <p class="ct-tos-item-desc">One 12-digit Contender ID per player. Secondary accounts, smurfing, and starter bonus abuse lead to permanent closure.</p>
            </div>
          </div>

          <div class="ct-tos-item">
            <span class="ct-tos-item-dot"></span>
            <div class="ct-tos-item-content">
              <div class="ct-tos-item-title">Referee Disputes</div>
              <p class="ct-tos-item-desc">Match issues must be reported to official platform Referees within 15 minutes with replay proof. Referee decisions are final.</p>
            </div>
          </div>

          <div class="ct-tos-item">
            <span class="ct-tos-item-dot"></span>
            <div class="ct-tos-item-content">
              <div class="ct-tos-item-title">Community Conduct</div>
              <p class="ct-tos-item-desc">Respect all players. Toxicity, harassment, or unauthorized access attempts result in immediate termination.</p>
            </div>
          </div>
        </div>

        <div class="ct-tos-footer">
          <label class="ct-tos-agree-row">
            <input type="checkbox" id="tos-agree-checkbox" class="ct-tos-checkbox" ${isAccepted ? 'checked disabled' : ''}/>
            <span class="ct-tos-agree-text">I have read and agree to the <strong>Terms of Service & Rules</strong></span>
          </label>

          <button type="button" id="btn-accept-tos" class="btn-tos-accept" ${!isAccepted ? 'disabled' : ''}>
            ${isAccepted ? 'Close Agreement' : 'Accept & Continue'}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('#btn-close-tos-modal');
    const checkbox = modal.querySelector('#tos-agree-checkbox');
    const acceptBtn = modal.querySelector('#btn-accept-tos');

    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('open'));

    if (checkbox && acceptBtn) {
      checkbox.addEventListener('change', () => {
        acceptBtn.disabled = !checkbox.checked;
      });

      acceptBtn.addEventListener('click', () => {
        localStorage.setItem('ct_tos_accepted_v3', 'true');
        modal.classList.remove('open');
        if (closeBtn) closeBtn.style.display = 'block';
        checkbox.checked = true;
        checkbox.disabled = true;
        acceptBtn.textContent = 'Close Agreement';
        if (window.showToast) window.showToast('Terms & Rules accepted.');
      });
    }

    modal.addEventListener('click', (e) => {
      const acceptedNow = localStorage.getItem('ct_tos_accepted_v3') === 'true';
      if (acceptedNow && e.target === modal) modal.classList.remove('open');
    });
  }

  // ── Modern Chromium Dark Cookie Consent Controller ─────────
  function ensureCookieBanner() {
    if (document.getElementById('ct-cookie-banner')) return;

    const isAccepted = localStorage.getItem('ct_cookies_accepted_v3') === 'true';

    const banner = document.createElement('aside');
    banner.className = 'ct-cookie-banner';
    banner.id = 'ct-cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-labelledby', 'ct-cookie-title');

    banner.innerHTML = `
      <div class="ct-cookie-header">
        <span style="font-size:1.25rem;line-height:1;" aria-hidden="true">🍪</span>
        <h3 class="ct-cookie-title" id="ct-cookie-title">Cookies & Competitive Privacy</h3>
      </div>
      <p class="ct-cookie-text">
        We use essential cookies and encrypted local storage to preserve your contender authentication, prevent smurfing, and synchronize live matchmaking ratings across the competitive network.
      </p>
      <div class="ct-cookie-actions">
        <button type="button" class="btn-cookie-reject" id="btn-cookie-reject">Reject Non-Essential</button>
        <button type="button" class="btn-cookie-accept" id="btn-cookie-accept">Accept All</button>
      </div>
    `;

    document.body.appendChild(banner);

    if (!isAccepted) {
      setTimeout(() => {
        banner.classList.add('show');
      }, 600);
    }

    const dismiss = () => {
      localStorage.setItem('ct_cookies_accepted_v3', 'true');
      banner.classList.remove('show');
      setTimeout(() => { banner.style.display = 'none'; }, 400);
    };

    banner.querySelector('#btn-cookie-accept')?.addEventListener('click', dismiss);
    banner.querySelector('#btn-cookie-reject')?.addEventListener('click', dismiss);
  }

  function ensureUniversalFooter() {
    let footer = document.querySelector('.ct-footer');
    if (!footer) {
      footer = document.createElement('footer');
      footer.className = 'ct-footer';
      document.body.appendChild(footer);
    }

    footer.style.cssText = 'border-top:1px solid rgba(255,255,255,0.08);padding:28px 20px 36px;background:#000000;text-align:center;position:relative;z-index:20;';
    footer.innerHTML = `
      <div style="max-width:960px;margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:14px;">
        <div class="ct-footer-links" style="display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;font-size:0.78rem;">
          <a href="javascript:void(0)" class="ct-footer-link" id="footer-btn-tos">Terms & Rules</a>
          <span style="color:rgba(255,255,255,0.15);">&bull;</span>
          <a href="javascript:void(0)" class="ct-footer-link" id="footer-btn-privacy">Privacy Policy</a>
          <span style="color:rgba(255,255,255,0.15);">&bull;</span>
          <a href="javascript:void(0)" class="ct-footer-link" id="footer-btn-fairplay">Fair Play & Anti-Cheat</a>
          <span style="color:rgba(255,255,255,0.15);">&bull;</span>
          <a href="https://discord.gg/35xqcMTEbH" target="_blank" rel="noopener noreferrer" class="ct-footer-link">Support Discord</a>
          <span style="color:rgba(255,255,255,0.15);">&bull;</span>
          <a href="https://discord.gg/35xqcMTEbH" target="_blank" rel="noopener noreferrer" class="ct-footer-link">Bug Reports</a>
          <span style="color:rgba(255,255,255,0.15);">&bull;</span>
          <span style="color:#94a3b8;font-size:0.75rem;display:inline-flex;align-items:center;">
            <span class="ct-live-pulse-dot"></span> Operational
          </span>
          <span style="color:rgba(255,255,255,0.15);">&bull;</span>
          <a href="javascript:void(0)" class="ct-footer-link" id="footer-btn-reset-exp" style="color:#64748b;" title="Simulate fresh first-time user visit">Reset Experience</a>
        </div>
        <div style="font-size:0.74rem;color:#475569;">
          © 2026 Champion Tokens • Protected by Cloudflare
        </div>
      </div>
    `;

    footer.querySelector('#footer-btn-tos')?.addEventListener('click', () => {
      ensureTosModal();
      document.getElementById('tos-modal')?.classList.add('open');
    });
    footer.querySelector('#footer-btn-privacy')?.addEventListener('click', () => {
      alert('Privacy Policy: Champion Tokens encrypts contender session tokens and never shares personal identifiers, IP logs, or Discord credentials with external parties.');
    });
    footer.querySelector('#footer-btn-fairplay')?.addEventListener('click', () => {
      ensureTosModal();
      document.getElementById('tos-modal')?.classList.add('open');
    });
    footer.querySelector('#footer-btn-reset-exp')?.addEventListener('click', () => {
      localStorage.removeItem('ct_tos_accepted_v3');
      localStorage.removeItem('ct_cookies_accepted_v3');
      localStorage.removeItem('ct_tos_accepted');
      localStorage.removeItem('ct_cookies_accepted');
      location.reload();
    });
  }

  function renderSharedNav(activeTab = '') {
    ensureFloatingBackground();
    const existingHeader = document.querySelector('header.landing-nav');
    const user = getActiveUser();

    const savedElo = localStorage.getItem('ct_user_elo');
    const isUnranked = localStorage.getItem('ct_is_unranked') === 'true';
    const elo = savedElo !== null ? parseInt(savedElo, 10) : 3500;
    const meta = getRankMeta(elo, isUnranked);
    const coins = getUserCoins();

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
        <button type="button" class="ct-set-elo-btn" id="btn-nav-set-elo">
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
        <!-- Collectible Coin Balance (Left of Rank, No Icon) -->
        <div class="ct-nav-coin-collectible" id="ct-nav-coin-pill">
          <span class="ct-nav-coin-num" id="nav-coin-count">${coins.toLocaleString()}</span>
          <span class="ct-nav-coin-label">COINS</span>
        </div>

        <!-- Rank & ELO Typography -->
        <div class="ct-nav-rank-badge ${isTop2 ? 'rank-shine-top2' : ''} ${isUnreal ? 'rank-unreal' : ''}" id="ct-nav-rank-badge">
          <img src="${meta.icon}" class="ct-nav-rank-icon" alt="${meta.name}"/>
          <div class="ct-nav-rank-text-col">
            <div class="ct-nav-rank-name">${meta.name}</div>
            <div class="ct-nav-rank-elo">${meta.eloDisplay}</div>
          </div>
        </div>

        <!-- User Island -->
        <div class="ct-user-island" id="ct-user-island">
          <img src="${user.avatar}" class="ct-island-avatar" id="island-user-avatar" alt="Avatar"/>
          <span class="ct-island-name" id="island-user-name">${displayName}</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="6 9 12 15 18 9"/></svg>
        </div>

        <!-- Solid Hamburger Menu -->
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

    // Initialize modals
    ensureRanksModal(meta);
    ensureDailyRewardModal();
    ensureTosModal();

    // Coin Collectible Click -> Opens Daily Login Reward Modal
    const coinPill = document.getElementById('ct-nav-coin-pill');
    if (coinPill) {
      coinPill.addEventListener('click', (e) => {
        e.stopPropagation();
        const modal = document.getElementById('daily-reward-modal');
        if (modal) modal.classList.add('open');
      });
    }

    // Rank & ELO Badge Click -> Opens Rank & ELO Menu System Modal (Without Live ELO Testing box)
    const navRankBadge = document.getElementById('ct-nav-rank-badge');
    if (navRankBadge) {
      navRankBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        const modal = document.getElementById('ranks-modal');
        if (modal) modal.classList.add('open');
      });
    }

    // Set ELO Test Button in Top Left -> Prompts ELO rating directly
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
  window.ensureTosModal = ensureTosModal;
  window.ensureDailyRewardModal = ensureDailyRewardModal;
  window.ensureCookieBanner = ensureCookieBanner;

  // Auto initialize if data-page attribute is on body
  document.addEventListener('DOMContentLoaded', () => {
    ensureFloatingBackground();
    ensureCookieBanner();
    const pageAttr = document.body.getAttribute('data-ct-page');
    if (pageAttr && pageAttr !== 'hub') {
      renderSharedNav(pageAttr);
    }
  });

})();