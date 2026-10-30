// ============================================================
//  CHAMPION TOKENS — Ranked Arena Controller (v4.0)
// ============================================================

(function () {
  'use strict';

  // Read saved ELO or default to 2,450 (Elite)
  const savedElo = localStorage.getItem('ct_user_elo');
  const savedUnranked = localStorage.getItem('ct_is_unranked');

  const state = {
    teamSize: '1v1',
    gameMode: 'realistic',
    isQueueing: false,
    queueTimer: null,
    queueSeconds: 0,
    userRank: 'Elite',
    userElo: savedElo !== null ? parseInt(savedElo, 10) : 2450,
    isUnranked: savedUnranked === 'true',
    placementsPlayed: 0,
    placementsRequired: 5,
    carouselIndex: 0,
    carouselTimer: null,
    currentUser: null,
    friends: [
      { id: 'f1', name: 'Viper_FN', elo: 2985, status: 'in-match', activity: 'In 1v1 Realistic (Round 4/9)', avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=120&auto=format&fit=crop&q=80' },
      { id: 'f2', name: 'GhostClutch', elo: 2940, status: 'in-queue', activity: 'Queueing Ranked 1v1 (0:45)', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80' },
      { id: 'f3', name: 'AeroSniper', elo: 2910, status: 'in-lobby', activity: 'In Lobby • Ready', avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&auto=format&fit=crop&q=80' }
    ]
  };

  document.addEventListener('DOMContentLoaded', () => {
    injectFloatingIcons();
    init10sCarousel();
    initUpperLeftRank();
    initSetEloBtn();
    initTopAuth();
    initQueueModal();
    initReferralsModal();
    initFriendsDrawer();
    initLiveTicker();
    updateRankUI();
    if (window.lucide) window.lucide.createIcons();
  });

  // ── Animated Floating Background Layer ───────────────────────
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
      { name: 'crown',     top: '15%', left: '75%', size: 32, dur: '21s', delay: '2.5s' }
    ];

    const container = document.createElement('div');
    container.id = 'floating-icons-container';
    container.className = 'floating-icons-layer';

    container.innerHTML = icons.map(ic => `
      <div class="floating-icon-item" style="top:${ic.top};left:${ic.left};animation-duration:${ic.dur};animation-delay:${ic.delay};">
        <i data-lucide="${ic.name}" style="width:${ic.size}px;height:${ic.size}px;"></i>
      </div>
    `).join('');

    document.body.prepend(container);
  }

  // ── Rank Tier Calculation ────────────────────────────────────
  function getRankMeta(elo, isUnranked) {
    if (isUnranked || elo <= 0) {
      return {
        name: 'Unranked',
        icon: 'medal-ranks/svg/01-bronze.svg',
        eloDisplay: '0/5 Placements',
        isUnranked: true,
        tierIndex: -1
      };
    }
    if (elo < 500) {
      return { name: 'Bronze', icon: 'medal-ranks/svg/01-bronze.svg', eloDisplay: `${elo.toLocaleString()} ELO`, isUnranked: false, tierIndex: 0 };
    } else if (elo < 1000) {
      return { name: 'Silver', icon: 'medal-ranks/svg/02-silver.svg', eloDisplay: `${elo.toLocaleString()} ELO`, isUnranked: false, tierIndex: 1 };
    } else if (elo < 1500) {
      return { name: 'Gold', icon: 'medal-ranks/svg/03-gold.svg', eloDisplay: `${elo.toLocaleString()} ELO`, isUnranked: false, tierIndex: 2 };
    } else if (elo < 2000) {
      return { name: 'Platinum', icon: 'medal-ranks/svg/04-platinum.svg', eloDisplay: `${elo.toLocaleString()} ELO`, isUnranked: false, tierIndex: 3 };
    } else if (elo < 2400) {
      return { name: 'Diamond', icon: 'medal-ranks/svg/05-diamond.svg', eloDisplay: `${elo.toLocaleString()} ELO`, isUnranked: false, tierIndex: 4 };
    } else if (elo < 2700) {
      return { name: 'Elite', icon: 'medal-ranks/svg/06-elite.svg', eloDisplay: `${elo.toLocaleString()} ELO`, isUnranked: false, tierIndex: 5 };
    } else if (elo < 3000) {
      return { name: 'Champion', icon: 'medal-ranks/svg/07-champion.svg', eloDisplay: `${elo.toLocaleString()} ELO`, isUnranked: false, tierIndex: 6 };
    } else {
      return { name: 'Unreal', icon: 'medal-ranks/svg/10-star.svg', eloDisplay: `${elo.toLocaleString()} ELO`, isUnranked: false, tierIndex: 7 };
    }
  }

  function updateRankUI() {
    const meta = getRankMeta(state.userElo, state.isUnranked);
    state.userRank = meta.name;

    const rankIcon = document.getElementById('header-rank-icon');
    const rankName = document.getElementById('header-rank-name');
    const rankElo = document.getElementById('header-rank-elo');

    if (rankIcon) {
      rankIcon.src = meta.icon;
      rankIcon.alt = meta.name;
      rankIcon.classList.toggle('unranked', meta.isUnranked);
    }

    if (rankName) {
      rankName.textContent = meta.name;
    }

    if (rankElo) {
      rankElo.textContent = meta.eloDisplay;
      rankElo.classList.toggle('unranked', meta.isUnranked);
    }

    // Update modal outlines
    const rows = document.querySelectorAll('#ranks-modal .ct-rank-row-item');
    rows.forEach((row, idx) => {
      // Remove any prior badge
      const existingBadge = row.querySelector('.ct-current-rank-badge');
      if (existingBadge) existingBadge.remove();

      if (!meta.isUnranked && meta.tierIndex === idx) {
        row.classList.add('current-rank');
        const eloBox = row.querySelector('.ct-rank-row-elo');
        if (eloBox) {
          const badge = document.createElement('span');
          badge.className = 'ct-current-rank-badge';
          badge.textContent = 'YOU';
          eloBox.appendChild(badge);
        }
      } else {
        row.classList.remove('current-rank');
      }
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // ── Upper Left Clickable Rank & Modal ────────────────────────
  function initUpperLeftRank() {
    const rankPill = document.getElementById('ct-header-rank-pill');
    const modal = document.getElementById('ranks-modal');
    const closeBtn = document.getElementById('btn-close-ranks-modal');
    const infoBtn = document.getElementById('btn-placements-info');

    // Click rank pill -> open Ranked Info modal
    if (rankPill) {
      rankPill.addEventListener('click', () => {
        updateRankUI();
        if (modal) modal.classList.add('open');
      });
    }

    function closeModal() {
      if (modal) modal.classList.remove('open');
    }
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }

    // Info button for placement matches
    if (infoBtn) {
      infoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showToast('Play 5 placement games to calibrate your rank (boosted +100 to +250 ELO during placements).');
      });
    }
  }

  // ── Temporary Set ELO Test Tool ──────────────────────────────
  function initSetEloBtn() {
    const btn = document.getElementById('btn-set-elo');
    if (!btn) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const currentVal = state.isUnranked ? '0' : state.userElo.toString();
      const input = prompt(
        'Set your ELO rating for live testing:\n• Enter "0" for Unranked (0/5 Placements)\n• Or enter a rating number (e.g. 450, 1200, 2450, 3100):',
        currentVal
      );

      if (input === null) return; // User cancelled

      const trimmed = input.trim();
      const parsed = parseInt(trimmed, 10);

      if (trimmed === '0' || isNaN(parsed) || parsed <= 0) {
        state.isUnranked = true;
        state.userElo = 0;
        localStorage.setItem('ct_is_unranked', 'true');
        localStorage.setItem('ct_user_elo', '0');
        showToast('Rank set to: Unranked (0/5 Placements)');
      } else {
        state.isUnranked = false;
        state.userElo = parsed;
        localStorage.setItem('ct_is_unranked', 'false');
        localStorage.setItem('ct_user_elo', parsed.toString());
        const meta = getRankMeta(parsed, false);
        showToast(`Rank set to: ${meta.name} (${parsed.toLocaleString()} ELO)`);
      }

      updateRankUI();
    });
  }

  // ── Top Bar Auth & Profile Island ────────────────────────────
  function initTopAuth() {
    const signInBtn = document.getElementById('header-signin-btn');
    const userIsland = document.getElementById('ct-user-island');
    const islandDropdown = document.getElementById('ct-island-dropdown');
    const islandAvatar = document.getElementById('island-user-avatar');
    const islandName = document.getElementById('island-user-name');
    const dropdownAvatar = document.getElementById('dropdown-user-avatar');
    const dropdownName = document.getElementById('dropdown-user-name');
    const signOutBtn = document.getElementById('btn-user-signout');

    // Check stored user
    const storedUserJson = localStorage.getItem('ct_user');
    if (storedUserJson) {
      try {
        state.currentUser = JSON.parse(storedUserJson);
      } catch (err) {
        state.currentUser = null;
      }
    }

    function renderAuthState() {
      if (state.currentUser) {
        if (signInBtn) signInBtn.style.display = 'none';
        if (userIsland) userIsland.style.display = 'inline-flex';
        if (islandAvatar) islandAvatar.src = state.currentUser.avatar;
        if (islandName) islandName.textContent = state.currentUser.name;
        if (dropdownAvatar) dropdownAvatar.src = state.currentUser.avatar;
        if (dropdownName) dropdownName.textContent = `${state.currentUser.name}${state.currentUser.tag || ''}`;
      } else {
        if (signInBtn) signInBtn.style.display = 'inline-flex';
        if (userIsland) userIsland.style.display = 'none';
        if (islandDropdown) islandDropdown.classList.remove('open');
      }
      if (window.lucide) window.lucide.createIcons();
    }

    // Sign in click -> log in with Discord profile
    if (signInBtn) {
      signInBtn.addEventListener('click', () => {
        // Mock Discord profile for testing
        const mockUser = {
          name: 'Zenox',
          tag: '#1337',
          avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=120&auto=format&fit=crop&q=80'
        };
        state.currentUser = mockUser;
        localStorage.setItem('ct_user', JSON.stringify(mockUser));
        renderAuthState();
        showToast('Signed in as ' + mockUser.name);
      });
    }

    // Toggle Island dropdown
    if (userIsland) {
      userIsland.addEventListener('click', (e) => {
        e.stopPropagation();
        if (islandDropdown) islandDropdown.classList.toggle('open');
      });
    }

    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
      if (islandDropdown && !islandDropdown.contains(e.target) && !userIsland?.contains(e.target)) {
        islandDropdown.classList.remove('open');
      }
    });

    // Sign out click
    if (signOutBtn) {
      signOutBtn.addEventListener('click', () => {
        state.currentUser = null;
        localStorage.removeItem('ct_user');
        renderAuthState();
        showToast('Signed out successfully');
      });
    }

    renderAuthState();
  }

  // ── Auto-Switching 10s Carousel ──────────────────────────────
  function init10sCarousel() {
    const slides = document.querySelectorAll('.ct-carousel-slide');
    const dots = document.querySelectorAll('.ct-carousel-dot');
    const counter = document.getElementById('carousel-counter-text');
    if (!slides.length) return;

    function goToSlide(idx) {
      state.carouselIndex = (idx + slides.length) % slides.length;
      slides.forEach((s, i) => {
        s.classList.toggle('active', i === state.carouselIndex);
      });
      dots.forEach((d, i) => {
        d.classList.toggle('active', i === state.carouselIndex);
      });
      if (counter) {
        counter.textContent = `${state.carouselIndex + 1} / ${slides.length}`;
      }
    }

    dots.forEach((dot, idx) => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        resetTimer();
        goToSlide(idx);
      });
    });

    function startTimer() {
      state.carouselTimer = setInterval(() => {
        goToSlide(state.carouselIndex + 1);
      }, 10000); // Exactly 10 seconds
    }

    function resetTimer() {
      clearInterval(state.carouselTimer);
      startTimer();
    }

    startTimer();
  }

  // ── Queue Selection Modal ────────────────────────────────────
  function initQueueModal() {
    const openBtn = document.getElementById('btn-open-queue-modal');
    const modal = document.getElementById('queue-select-modal');
    const closeBtn = document.getElementById('btn-close-queue-modal');
    const startQueueBtn = document.getElementById('btn-start-queue-modal');
    const banner = document.getElementById('queue-status-banner');
    const cancelBtn = document.getElementById('btn-cancel-queue');
    const timerText = document.getElementById('queue-timer-text');
    const statusMsg = document.getElementById('queue-status-msg');

    if (openBtn) {
      openBtn.addEventListener('click', () => {
        if (state.isQueueing) {
          cancelQueue();
        } else if (modal) {
          modal.classList.add('open');
        }
      });
    }

    function closeModal() {
      if (modal) modal.classList.remove('open');
    }
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }

    // Step 1: 1v1, 2v2, 3v3
    const sizeBtns = document.querySelectorAll('.ct-size-btn');
    sizeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        sizeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.teamSize = btn.getAttribute('data-size') || '1v1';
        updateModalQueueBtn();
      });
    });

    // Step 2: Realistic, Box Fights, Build Fights, Zone Wars
    const modeCards = document.querySelectorAll('.ct-mode-card');
    modeCards.forEach(card => {
      card.addEventListener('click', () => {
        modeCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        state.gameMode = card.getAttribute('data-gamemode') || 'realistic';
        updateModalQueueBtn();
      });
    });

    function updateModalQueueBtn() {
      if (!startQueueBtn) return;
      const modeName = getGamemodeDisplayName(state.gameMode);
      startQueueBtn.textContent = `Queue ${state.teamSize} ${modeName}`;
    }

    if (startQueueBtn) {
      startQueueBtn.addEventListener('click', () => {
        closeModal();
        startQueue();
      });
    }

    if (cancelBtn) cancelBtn.addEventListener('click', cancelQueue);

    function startQueue() {
      state.isQueueing = true;
      state.queueSeconds = 0;
      if (banner) banner.classList.add('active');
      if (openBtn) {
        openBtn.classList.add('queueing');
        openBtn.innerHTML = `<i data-lucide="x-circle" style="width:20px;height:20px;"></i> Cancel Queue`;
      }
      if (window.lucide) window.lucide.createIcons();

      const modeName = getGamemodeDisplayName(state.gameMode);
      if (statusMsg) {
        statusMsg.textContent = `Searching ${state.teamSize} ${modeName} opponents (±300 ELO range)...`;
      }

      state.queueTimer = setInterval(() => {
        state.queueSeconds++;
        const mins = Math.floor(state.queueSeconds / 60);
        const secs = state.queueSeconds % 60;
        const fmt = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        if (timerText) timerText.textContent = fmt;

        // Match found simulation after 10 seconds
        if (state.queueSeconds === 10) {
          matchFoundSimulation();
        }
      }, 1000);
    }

    function cancelQueue() {
      state.isQueueing = false;
      clearInterval(state.queueTimer);
      if (banner) banner.classList.remove('active');
      if (openBtn) {
        openBtn.classList.remove('queueing');
        openBtn.innerHTML = `<i data-lucide="play" style="width:20px;height:20px;fill:currentColor;"></i> Queue Match`;
      }
      if (window.lucide) window.lucide.createIcons();
    }

    function matchFoundSimulation() {
      clearInterval(state.queueTimer);
      if (banner) banner.classList.remove('active');
      if (openBtn) {
        openBtn.classList.remove('queueing');
        openBtn.innerHTML = `<i data-lucide="check" style="width:20px;height:20px;"></i> Match Found!`;
      }
      if (window.lucide) window.lucide.createIcons();
      showMatchModal();
    }
  }

  function getGamemodeDisplayName(key) {
    switch (key) {
      case 'realistic': return 'Realistic';
      case 'boxfight': return 'Box Fights';
      case 'buildfight': return 'Build Fights';
      case 'zonewars': return 'Zone Wars';
      default: return 'Match';
    }
  }

  function showMatchModal() {
    let modal = document.getElementById('match-ready-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'match-ready-modal';
      modal.className = 'ct-modal-overlay open';
      document.body.appendChild(modal);
    }

    const modeName = getGamemodeDisplayName(state.gameMode);

    modal.innerHTML = `
      <div class="ct-queue-modal-card" style="text-align:center;border-color:#53fc18;">
        <div style="width:48px;height:48px;border-radius:12px;background:rgba(83,252,24,0.15);color:#53fc18;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;">
          <i data-lucide="swords" style="width:24px;height:24px;"></i>
        </div>
        <h3 style="font-family:'Outfit',sans-serif;font-size:1.4rem;font-weight:900;color:#fff;margin-bottom:4px;">Match Found!</h3>
        <p style="color:#94a3b8;font-size:0.8rem;margin-bottom:16px;">
          Opponent matched within ±300 ELO range.
        </p>
        <div style="background:#000;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;margin-bottom:16px;text-align:left;font-size:0.82rem;">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="color:#64748b;font-weight:800;">Playlist:</span>
            <span style="color:#fff;font-weight:900;">${state.teamSize} ${modeName}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="color:#64748b;font-weight:800;">Opponent ELO:</span>
            <span style="color:#53fc18;font-weight:900;">2,480 ELO (Elite)</span>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span style="color:#64748b;font-weight:800;">Island Code:</span>
            <span style="color:#fbbf24;font-weight:900;">2355-0939-8965</span>
          </div>
        </div>
        <div style="display:flex;gap:10px;">
          <button type="button" class="btn-modal-start-queue" style="margin-top:0;" onclick="window.location.href='matches'">Accept & Play</button>
          <button type="button" class="btn btn-outline" style="border-radius:10px;padding:10px 18px;" onclick="closeMatchModal()">Decline</button>
        </div>
      </div>
    `;

    modal.classList.add('open');
    if (window.lucide) window.lucide.createIcons();
  }

  window.closeMatchModal = function () {
    const modal = document.getElementById('match-ready-modal');
    if (modal) modal.remove();
    const openBtn = document.getElementById('btn-open-queue-modal');
    if (openBtn) openBtn.innerHTML = `<i data-lucide="play" style="width:20px;height:20px;fill:currentColor;"></i> Queue Match`;
    if (window.lucide) window.lucide.createIcons();
  };

  // ── Referrals Modal ──────────────────────────────────────────
  function initReferralsModal() {
    const modal = document.getElementById('referrals-modal');
    const triggers = document.querySelectorAll('.trigger-referrals');
    const closeBtn = document.getElementById('btn-close-referrals');
    const copyBtn = document.getElementById('btn-copy-ref-link');
    const input = document.getElementById('referral-link-input');
    const islandDropdown = document.getElementById('ct-island-dropdown');

    function openModal() {
      if (modal) modal.classList.add('open');
      if (islandDropdown) islandDropdown.classList.remove('open');
    }

    function closeModal() {
      if (modal) modal.classList.remove('open');
    }

    triggers.forEach(t => t.addEventListener('click', openModal));
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }

    if (copyBtn && input) {
      copyBtn.addEventListener('click', () => {
        input.select();
        navigator.clipboard.writeText(input.value).then(() => {
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
          showToast('Referral link copied to clipboard!');
        });
      });
    }
  }

  // ── Social & Friends Drawer ─────────────────────────────────
  function initFriendsDrawer() {
    const overlay = document.getElementById('friends-drawer-overlay');
    const drawer = document.getElementById('friends-drawer');
    const trigger = document.getElementById('btn-open-friends');
    const closeBtn = document.getElementById('btn-close-friends');

    function openFriends() {
      if (overlay) overlay.classList.add('open');
      if (drawer) drawer.classList.add('open');
      renderFriendsList();
    }

    function closeFriends() {
      if (overlay) overlay.classList.remove('open');
      if (drawer) drawer.classList.remove('open');
    }

    if (trigger) trigger.addEventListener('click', openFriends);
    if (closeBtn) closeBtn.addEventListener('click', closeFriends);
    if (overlay) overlay.addEventListener('click', closeFriends);
  }

  function renderFriendsList() {
    const container = document.getElementById('friends-list-container');
    if (!container) return;

    container.innerHTML = state.friends.map(f => `
      <div style="background:#000;border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:10px;display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <img src="${f.avatar}" style="width:34px;height:34px;border-radius:8px;object-fit:cover;" alt="${f.name}"/>
          <div>
            <div style="font-size:0.84rem;font-weight:800;color:#fff;">${f.name} <span style="color:#53fc18;font-size:0.7rem;">${f.elo} ELO</span></div>
            <div style="font-size:0.7rem;color:#64748b;">${f.activity}</div>
          </div>
        </div>
        <button type="button" style="background:#14171a;border:1px solid rgba(255,255,255,0.1);color:#53fc18;padding:5px 10px;border-radius:6px;font-size:0.72rem;font-weight:800;cursor:pointer;" onclick="showToast('Invited ${f.name} to Party!')">
          Invite
        </button>
      </div>
    `).join('');
  }

  // ── Online Ticker Fluctuator ─────────────────────────────────
  function initLiveTicker() {
    const onlineEl = document.getElementById('ticker-online-count');
    const matchesEl = document.getElementById('ticker-matches-count');
    let online = 1482;
    let matches = 219;

    setInterval(() => {
      const change = Math.floor(Math.random() * 5) - 2;
      online = Math.max(1400, online + change);
      if (onlineEl) onlineEl.textContent = online.toLocaleString();

      if (Math.random() > 0.6) {
        matches = Math.max(180, matches + (Math.floor(Math.random() * 3) - 1));
        if (matchesEl) matchesEl.textContent = matches.toLocaleString();
      }
    }, 4000);
  }

  // ── Toast Helper ─────────────────────────────────────────────
  window.showToast = function (msg) {
    let toast = document.getElementById('ct-ranked-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'ct-ranked-toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: #08090c;
        border: 1px solid #53fc18;
        color: #ffffff;
        padding: 9px 20px;
        border-radius: 99px;
        font-size: 0.8rem;
        font-weight: 800;
        z-index: 9999;
        pointer-events: none;
        transition: opacity 0.2s ease;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    setTimeout(() => {
      toast.style.opacity = '0';
    }, 2800);
  };

})();
