// ============================================================
//  CHAMPION TOKENS — Ranked Arena Controller (v3.0)
// ============================================================

(function () {
  'use strict';

  const state = {
    teamSize: '1v1', // '1v1' | '2v2' | '3v3'
    gameMode: 'realistic', // 'realistic' | 'boxfight' | 'buildfight' | 'zonewars'
    modeType: 'ranked', // 'ranked' | 'friendly'
    isQueueing: false,
    queueTimer: null,
    queueSeconds: 0,
    userRank: 'Elite Tier',
    userElo: 2450,
    userPlacements: { played: 5, required: 5 },
    referrals: {
      code: 'CHAMP-8821',
      link: 'https://championtokens.fun/?ref=CHAMP-8821',
      totalInvited: 0,
      bonusEarned: '+0 XP'
    },
    friends: [
      { id: 'f1', name: 'Viper_FN', elo: 2510, status: 'in-match', activity: 'In 1v1 Realistic (Round 4/9)', avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=120&auto=format&fit=crop&q=80' },
      { id: 'f2', name: 'GhostClutch', elo: 2380, status: 'in-queue', activity: 'Queueing Ranked 1v1 (0:45)', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80' },
      { id: 'f3', name: 'AeroSniper', elo: 2790, status: 'in-lobby', activity: 'In Lobby • Ready', avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&auto=format&fit=crop&q=80' }
    ]
  };

  document.addEventListener('DOMContentLoaded', () => {
    initHamburgerMenu();
    initReferralsModal();
    initQueueModal();
    initFriendsDrawer();
    initLiveTicker();
    if (window.lucide) window.lucide.createIcons();
  });

  // ── Hamburger Dropdown Menu ─────────────────────────────────
  function initHamburgerMenu() {
    const btn = document.getElementById('btn-hamburger');
    const menu = document.getElementById('ct-dropdown-menu');

    if (!btn || !menu) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('open');
    });

    document.addEventListener('click', () => {
      menu.classList.remove('open');
    });

    menu.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  // ── Referrals Modal ──────────────────────────────────────────
  function initReferralsModal() {
    const modal = document.getElementById('referrals-modal');
    const triggers = document.querySelectorAll('.trigger-referrals');
    const closeBtn = document.getElementById('btn-close-referrals');
    const copyBtn = document.getElementById('btn-copy-ref-link');
    const input = document.getElementById('referral-link-input');

    function openModal() {
      if (modal) modal.classList.add('open');
      const menu = document.getElementById('ct-dropdown-menu');
      if (menu) menu.classList.remove('open');
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

  // ── Queue Selection Modal & Logic ────────────────────────────
  function initQueueModal() {
    const openBtn = document.getElementById('btn-open-queue-modal');
    const modal = document.getElementById('queue-select-modal');
    const closeBtn = document.getElementById('btn-close-queue-modal');
    const startQueueBtn = document.getElementById('btn-start-queue-modal');
    const banner = document.getElementById('queue-status-banner');
    const cancelBtn = document.getElementById('btn-cancel-queue');
    const timerText = document.getElementById('queue-timer-text');
    const statusMsg = document.getElementById('queue-status-msg');

    // Open Modal
    if (openBtn) {
      openBtn.addEventListener('click', () => {
        if (state.isQueueing) {
          cancelQueue();
        } else if (modal) {
          modal.classList.add('open');
        }
      });
    }

    // Close Modal
    function closeModal() {
      if (modal) modal.classList.remove('open');
    }
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }

    // Step 1: Team Size selection (1v1, 2v2, 3v3)
    const sizeBtns = document.querySelectorAll('.ct-size-btn');
    sizeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        sizeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.teamSize = btn.getAttribute('data-size') || '1v1';
        updateModalQueueBtn();
      });
    });

    // Step 2: Gamemode selection (Realistic, Boxfight, Buildfight, Zonewars)
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

    // Start Queue from modal
    if (startQueueBtn) {
      startQueueBtn.addEventListener('click', () => {
        closeModal();
        startQueue();
      });
    }

    // Cancel Queue
    if (cancelBtn) {
      cancelBtn.addEventListener('click', cancelQueue);
    }

    function startQueue() {
      state.isQueueing = true;
      state.queueSeconds = 0;
      if (banner) banner.classList.add('active');
      if (openBtn) {
        openBtn.classList.add('queueing');
        openBtn.innerHTML = `<i data-lucide="x-circle" style="width:18px;height:18px;"></i> Cancel Queue`;
      }
      if (window.lucide) window.lucide.createIcons();

      const minElo = Math.max(0, state.userElo - 300);
      const maxElo = Math.min(3000, state.userElo + 300);
      const modeName = getGamemodeDisplayName(state.gameMode);

      if (statusMsg) {
        statusMsg.textContent = `Searching ${state.teamSize} ${modeName} opponents (±300 ELO: ${minElo} - ${maxElo})...`;
      }

      state.queueTimer = setInterval(() => {
        state.queueSeconds++;
        const mins = Math.floor(state.queueSeconds / 60);
        const secs = state.queueSeconds % 60;
        const fmt = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        if (timerText) timerText.textContent = fmt;

        // Simulate Match Found after 10 seconds
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
        openBtn.innerHTML = `<i data-lucide="play" style="width:18px;height:18px;fill:currentColor;"></i> Queue Match`;
      }
      if (window.lucide) window.lucide.createIcons();
    }

    function matchFoundSimulation() {
      clearInterval(state.queueTimer);
      if (banner) banner.classList.remove('active');
      if (openBtn) {
        openBtn.classList.remove('queueing');
        openBtn.innerHTML = `<i data-lucide="check" style="width:18px;height:18px;"></i> Match Found!`;
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

  // ── Match Ready Modal ───────────────────────────────────────
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
    if (openBtn) openBtn.innerHTML = `<i data-lucide="play" style="width:18px;height:18px;fill:currentColor;"></i> Queue Match`;
    if (window.lucide) window.lucide.createIcons();
  };

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
    }, 2500);
  };

})();
