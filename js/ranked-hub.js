// ============================================================
//  CHAMPION TOKENS / RANKED ARENA — Interactive Ranked Hub Controller
// ============================================================

(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────
  const state = {
    selectedMode: 'ranked', // 'ranked' | 'friendly'
    selectedPlaylist: 'realistic',
    isQueueing: false,
    queueTimer: null,
    queueSeconds: 0,
    userElo: 2450, // Default demo ELO (Elite Tier)
    userPlacements: { played: 5, required: 5 }, // 5 Placement matches rule
    party: [
      { id: 'self', name: 'You (Leader)', isLeader: true, avatar: 'champion-tokens_new.png' }
    ],
    friends: [
      { id: 'f1', name: 'Viper_FN', elo: 2510, status: 'in-match', activity: 'In 1v1 Realistic (Round 4/9)', avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=120&auto=format&fit=crop&q=80' },
      { id: 'f2', name: 'GhostClutch', elo: 2380, status: 'in-queue', activity: 'Queueing Ranked 1v1 (0:45)', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80' },
      { id: 'f3', name: 'AeroSniper', elo: 2790, status: 'in-lobby', activity: 'In Lobby • Ready', avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&auto=format&fit=crop&q=80' },
      { id: 'f4', name: 'FrostByte', elo: 1950, status: 'offline', activity: 'Offline (2h ago)', avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=120&auto=format&fit=crop&q=80' }
    ],
    friendRequests: [
      { id: 'r1', name: 'Pulse_Edits', elo: 2200 }
    ],
    friendlyStreakAgainstCurrentOpponent: 0 // Anti-abuse: disables XP after 2 wins in a row
  };

  // ── DOM Initialization ─────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    initModeSwitch();
    initPlaylistSelect();
    initQueueControls();
    initFriendsDrawer();
    initPartySlots();
    initLiveTicker();
    if (window.lucide) window.lucide.createIcons();
  });

  // ── Mode Switch: Ranked vs Friendlies ───────────────────────
  function initModeSwitch() {
    const tabRanked = document.getElementById('tab-mode-ranked');
    const tabFriendly = document.getElementById('tab-mode-friendly');
    const queueEloIndicator = document.getElementById('queue-elo-indicator');
    const friendlyAlert = document.getElementById('friendly-antiabuse-alert');

    if (!tabRanked || !tabFriendly) return;

    tabRanked.addEventListener('click', () => {
      state.selectedMode = 'ranked';
      tabRanked.classList.add('active');
      tabFriendly.classList.remove('active');
      if (queueEloIndicator) queueEloIndicator.style.display = 'flex';
      if (friendlyAlert) friendlyAlert.style.display = 'none';
      updateQueueButtonLabel();
    });

    tabFriendly.addEventListener('click', () => {
      state.selectedMode = 'friendly';
      tabFriendly.classList.add('active');
      tabRanked.classList.remove('active');
      if (queueEloIndicator) queueEloIndicator.style.display = 'none';
      if (friendlyAlert) friendlyAlert.style.display = 'flex';
      updateQueueButtonLabel();
    });
  }

  // ── Playlist Selection ──────────────────────────────────────
  function initPlaylistSelect() {
    const cards = document.querySelectorAll('.playlist-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        cards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        state.selectedPlaylist = card.getAttribute('data-playlist') || 'realistic';
        updateQueueButtonLabel();
      });
    });
  }

  function updateQueueButtonLabel() {
    const btn = document.getElementById('btn-enter-queue');
    if (!btn || state.isQueueing) return;
    const playlistName = getPlaylistDisplayName(state.selectedPlaylist);
    if (state.selectedMode === 'ranked') {
      btn.innerHTML = `<i data-lucide="swords" style="width:18px;height:18px;"></i> Find Ranked ${playlistName}`;
    } else {
      btn.innerHTML = `<i data-lucide="smile" style="width:18px;height:18px;"></i> Play Friendly ${playlistName}`;
    }
    if (window.lucide) window.lucide.createIcons();
  }

  function getPlaylistDisplayName(key) {
    switch (key) {
      case 'realistic': return '1v1 Realistic';
      case 'boxfight': return '1v1 Box Fight';
      case 'buildfight': return '1v1 Build Fight';
      case 'zonewars': return '1v1 Zone Wars';
      case 'duo-box': return '2v2 Box Fight';
      default: return '1v1 Match';
    }
  }

  // ── Queue & Matchmaking System ──────────────────────────────
  function initQueueControls() {
    const btnQueue = document.getElementById('btn-enter-queue');
    const banner = document.getElementById('queue-status-banner');
    const btnCancel = document.getElementById('btn-cancel-queue');
    const timerText = document.getElementById('queue-timer-text');
    const queueStatusMsg = document.getElementById('queue-status-msg');

    if (!btnQueue) return;

    btnQueue.addEventListener('click', () => {
      if (!state.isQueueing) {
        startQueue();
      } else {
        cancelQueue();
      }
    });

    if (btnCancel) {
      btnCancel.addEventListener('click', cancelQueue);
    }

    function startQueue() {
      state.isQueueing = true;
      state.queueSeconds = 0;
      if (banner) banner.classList.add('active');
      btnQueue.classList.add('queueing');
      btnQueue.innerHTML = `<i data-lucide="x-circle" style="width:18px;height:18px;"></i> Cancel Queue`;
      if (window.lucide) window.lucide.createIcons();

      const minElo = Math.max(0, state.userElo - 300);
      const maxElo = Math.min(3000, state.userElo + 300);

      if (queueStatusMsg) {
        queueStatusMsg.textContent = state.selectedMode === 'ranked'
          ? `Searching opponents within ±300 ELO (${minElo} - ${maxElo} ELO)...`
          : `Searching casual players for unranked friendly (Battle Pass XP active)...`;
      }

      state.queueTimer = setInterval(() => {
        state.queueSeconds++;
        const mins = Math.floor(state.queueSeconds / 60);
        const secs = state.queueSeconds % 60;
        const fmt = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        if (timerText) timerText.textContent = fmt;

        // Auto-expand search range if queue reaches 8 seconds
        if (state.queueSeconds === 8 && state.selectedMode === 'ranked' && queueStatusMsg) {
          queueStatusMsg.textContent = `Expanding search radius: Matching best available players across all regions...`;
        }

        // Match found simulation after 14 seconds
        if (state.queueSeconds === 14) {
          matchFoundSimulation();
        }
      }, 1000);
    }

    function cancelQueue() {
      state.isQueueing = false;
      clearInterval(state.queueTimer);
      if (banner) banner.classList.remove('active');
      btnQueue.classList.remove('queueing');
      updateQueueButtonLabel();
    }
  }

  function matchFoundSimulation() {
    clearInterval(state.queueTimer);
    const banner = document.getElementById('queue-status-banner');
    if (banner) banner.classList.remove('active');

    const btnQueue = document.getElementById('btn-enter-queue');
    if (btnQueue) {
      btnQueue.classList.remove('queueing');
      btnQueue.innerHTML = `<i data-lucide="check-circle-2" style="width:18px;height:18px;"></i> Match Found!`;
      if (window.lucide) window.lucide.createIcons();
    }

    showMatchFoundModal({
      opponentName: 'FaZe_Vortex',
      opponentElo: 2490,
      opponentRank: 'Elite Tier',
      mapName: 'Competitive Realistic 1v1 (Speed & Aim)',
      mapCode: '2355-0939-8965',
      rounds: 'Best of 9 Rounds',
      serverRegion: 'NA-East / EU Neutral'
    });
  }

  // ── Match Found Modal ───────────────────────────────────────
  function showMatchFoundModal(data) {
    let modal = document.getElementById('match-found-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'match-found-modal';
      modal.className = 'modal-overlay';
      modal.style.display = 'flex';
      modal.style.zIndex = '300';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="auth-modal-card" style="max-width:480px;text-align:center;border-color:var(--kick-green);box-shadow:0 0 40px rgba(83,252,24,0.35);">
        <div style="width:56px;height:56px;border-radius:16px;background:rgba(83,252,24,0.15);border:1px solid var(--kick-green);color:var(--kick-green);display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px;">
          <i data-lucide="swords" style="width:28px;height:28px;"></i>
        </div>
        <h2 style="font-family:'Outfit',sans-serif;font-size:1.6rem;font-weight:900;color:#fff;margin-bottom:6px;">Match Ready!</h2>
        <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:20px;">
          Opponent within ±300 ELO range accepted. Connect to Fortnite Creative lobby.
        </p>

        <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:20px;text-align:left;">
          <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
            <span style="font-size:0.75rem;color:var(--text-sub);text-transform:uppercase;font-weight:800;">Opponent</span>
            <span style="font-size:0.88rem;font-weight:900;color:#fff;">${data.opponentName}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
            <span style="font-size:0.75rem;color:var(--text-sub);text-transform:uppercase;font-weight:800;">Opponent ELO</span>
            <span style="font-size:0.88rem;font-weight:900;color:var(--kick-green);">${data.opponentElo} ELO (${data.opponentRank})</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
            <span style="font-size:0.75rem;color:var(--text-sub);text-transform:uppercase;font-weight:800;">Island Code</span>
            <span style="font-size:0.85rem;font-weight:900;color:#fbbf24;background:rgba(245,158,11,0.12);padding:2px 8px;border-radius:6px;">${data.mapCode}</span>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span style="font-size:0.75rem;color:var(--text-sub);text-transform:uppercase;font-weight:800;">Format</span>
            <span style="font-size:0.85rem;font-weight:800;color:#cbd5e1;">${data.rounds}</span>
          </div>
        </div>

        <div style="display:flex;gap:12px;">
          <button type="button" class="btn btn-discord" style="flex:1;background:var(--kick-green);color:#000;font-weight:900;padding:12px;border-radius:10px;" onclick="acceptMatchDemo()">
            Launch Match & Enter Arena
          </button>
          <button type="button" class="btn btn-outline" style="border-radius:10px;padding:12px 18px;" onclick="closeMatchModal()">
            Decline
          </button>
        </div>
      </div>
    `;

    modal.classList.add('open');
    if (window.lucide) window.lucide.createIcons();
  }

  window.closeMatchModal = function () {
    const modal = document.getElementById('match-found-modal');
    if (modal) modal.remove();
    const btn = document.getElementById('btn-enter-queue');
    if (btn) btn.innerHTML = `<i data-lucide="swords" style="width:18px;height:18px;"></i> Enter Queue`;
    if (window.lucide) window.lucide.createIcons();
  };

  window.acceptMatchDemo = function () {
    window.location.href = 'matches';
  };

  // ── Social & Friends Drawer ─────────────────────────────────
  function initFriendsDrawer() {
    const overlay = document.getElementById('friends-drawer-overlay');
    const drawer = document.getElementById('friends-drawer');
    const trigger = document.getElementById('btn-open-friends');
    const floatingTrigger = document.getElementById('floating-friends-trigger');
    const closeBtn = document.getElementById('btn-close-friends');
    const addInput = document.getElementById('friends-add-input');
    const addBtn = document.getElementById('btn-send-friend-req');

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
    if (floatingTrigger) floatingTrigger.addEventListener('click', openFriends);
    if (closeBtn) closeBtn.addEventListener('click', closeFriends);
    if (overlay) overlay.addEventListener('click', closeFriends);

    if (addBtn && addInput) {
      addBtn.addEventListener('click', () => {
        const val = addInput.value.trim();
        if (!val) return;
        showToast(`Friend request sent to ${val}!`);
        addInput.value = '';
      });
    }
  }

  function renderFriendsList() {
    const container = document.getElementById('friends-list-container');
    if (!container) return;

    container.innerHTML = state.friends.map(f => `
      <div class="friend-item-card">
        <div class="friend-item-left">
          <div class="friend-avatar-wrap">
            <img src="${f.avatar}" class="friend-avatar-img" alt="${f.name}"/>
            <span class="friend-status-dot ${f.status}"></span>
          </div>
          <div class="friend-item-info">
            <div class="friend-item-name">${f.name} <span style="font-size:0.7rem;color:var(--kick-green);font-weight:900;">${f.elo} ELO</span></div>
            <div class="friend-item-activity">${f.activity}</div>
          </div>
        </div>
        <div class="friend-actions-group">
          <button class="btn-friend-action" title="Invite to Party" onclick="inviteFriendToParty('${f.id}')">
            <i data-lucide="user-plus" style="width:14px;height:14px;"></i>
          </button>
          <button class="btn-friend-action" title="Friendly 1v1" onclick="challengeFriendly('${f.name}')">
            <i data-lucide="swords" style="width:14px;height:14px;"></i>
          </button>
        </div>
      </div>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  window.inviteFriendToParty = function (friendId) {
    const friend = state.friends.find(f => f.id === friendId);
    if (!friend) return;
    const slot2 = document.getElementById('party-slot-2');
    if (slot2) {
      slot2.innerHTML = `
        <img src="${friend.avatar}" class="party-slot-avatar" alt="${friend.name}"/>
      `;
      slot2.classList.add('leader');
      showToast(`${friend.name} joined your party!`);
    }
  };

  window.challengeFriendly = function (friendName) {
    showToast(`Challenged ${friendName} to a Friendly 1v1! (Anti-abuse XP cap active)`);
  };

  // ── Party Slots ─────────────────────────────────────────────
  function initPartySlots() {
    const slot2 = document.getElementById('party-slot-2');
    if (slot2) {
      slot2.addEventListener('click', () => {
        const floatingTrigger = document.getElementById('floating-friends-trigger');
        if (floatingTrigger) floatingTrigger.click();
      });
    }
  }

  // ── Live Online Ticker Fluctuator ───────────────────────────
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

  // ── Toast Notification Helper ───────────────────────────────
  function showToast(msg) {
    let toast = document.getElementById('ct-ranked-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'ct-ranked-toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: #181c20;
        border: 1px solid var(--kick-green);
        color: #ffffff;
        padding: 10px 22px;
        border-radius: 99px;
        font-size: 0.84rem;
        font-weight: 800;
        box-shadow: 0 10px 30px rgba(0,0,0,0.8);
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
  }

})();
