(function () {
  'use strict';

  // Read saved ELO or default to 2,450 (Elite)
  const savedElo = localStorage.getItem('ct_user_elo');
  const savedUnranked = localStorage.getItem('ct_is_unranked');

  // Honest Real Contenders (No fake bots)
  const ONLINE_CONTENDERS = [];

  const state = {
    teamSize: '1v1',
    gameMode: 'realistic',
    isQueueing: false,
    queueTimer: null,
    dotsTimer: null,
    queueSeconds: 0,
    userRank: 'Elite',
    userElo: savedElo !== null ? parseInt(savedElo, 10) : 2450,
    isUnranked: savedUnranked === 'true',
    placementsPlayed: 0,
    placementsRequired: 5,
    carouselIndex: 0,
    carouselTimer: null,
    currentUser: null,
    partySlots: [
      { id: 'slot-1', isLeader: true, player: null },
      { id: 'slot-2', isLeader: false, player: null },
      { id: 'slot-3', isLeader: false, player: null }
    ]
  };

  document.addEventListener('DOMContentLoaded', () => {
    initContenderUser();
    injectFloatingIcons();
    init10sCarousel();
    initUpperLeftRank();
    initSetEloBtn();
    initTopAuth();
    initPartyHub();
    initQueueModal();
    initReferralsModal();
    initLiveTicker();
    initCoinsAndDaily();
    initTosOnMain();
    ensureCookieBanner();
    updateRankUI();
    if (window.lucide) window.lucide.createIcons();
  });

  // Persistent 12-Digit Contender ID & Profile State
  function initContenderUser() {
    let cid = localStorage.getItem('ct_contender_id');
    if (!cid || cid.length !== 12 || cid === '882194017402') {
      cid = '112118831941';
      localStorage.setItem('ct_contender_id', cid);
    }

    const storedUser = localStorage.getItem('ct_user');
    if (storedUser) {
      try {
        state.currentUser = JSON.parse(storedUser);
      } catch (e) {
        state.currentUser = null;
      }
    }

    if (!state.currentUser || !state.currentUser.name || /^\d{12}$/.test(state.currentUser.name) || !state.currentUser.isLoggedIn) {
      state.currentUser = {
        id: cid || '112118831941',
        name: 'adrian',
        customName: 'adrian',
        tag: '',
        isLoggedIn: true,
        avatar: '/adrian-avatar.png',
        isVip: true
      };
      localStorage.setItem('ct_user', JSON.stringify(state.currentUser));
      localStorage.setItem('ct_contender_id', state.currentUser.id);
    } else {
      if (!state.currentUser.avatar || state.currentUser.avatar.includes('unsplash') || state.currentUser.avatar.includes('photo-1566492031773')) {
        state.currentUser.avatar = '/adrian-avatar.png';
        localStorage.setItem('ct_user', JSON.stringify(state.currentUser));
      }
      if (!state.currentUser.id || state.currentUser.id.length !== 12) {
        state.currentUser.id = cid;
        localStorage.setItem('ct_user', JSON.stringify(state.currentUser));
      }
    }
  }

  // Floating Background Layer
  function injectFloatingIcons() {
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

  // Rank Tier Calculation
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
    const rankPill = document.getElementById('ct-header-rank-pill');

    if (rankPill) {
      const isTop2 = meta.name === 'Champion' || meta.name === 'Unreal';
      rankPill.classList.toggle('rank-shine-top2', isTop2);
      rankPill.classList.toggle('rank-unreal', meta.name === 'Unreal');
    }

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

    // Update modal tier highlight
    const rows = document.querySelectorAll('#ranks-modal .ct-rank-row-item');
    rows.forEach((row, idx) => {
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

    updatePartyLeaderSlot();
    updateMainLeaderboard();
    if (window.lucide) window.lucide.createIcons();
  }

  // Synchronized Season Leaderboard Snapshot on Main Tab (Only Adrian / You)
  function updateMainLeaderboard() {
    const meta = getRankMeta(state.userElo, state.isUnranked);
    const u = state.currentUser || { name: 'adrian', customName: 'adrian', id: '112118831941', avatar: '/adrian-avatar.png' };
    const displayName = u.customName || u.name || 'adrian';
    const cid = u.id || '112118831941';
    const avatar = u.avatar || '/adrian-avatar.png';

    const avatarEl = document.getElementById('main-lb-avatar');
    const nameEl = document.getElementById('main-lb-name');
    const idEl = document.getElementById('main-lb-id');
    const iconEl = document.getElementById('main-lb-icon');
    const eloEl = document.getElementById('main-lb-elo');
    const tierEl = document.getElementById('main-lb-tier');

    if (avatarEl) avatarEl.src = avatar;
    if (nameEl) nameEl.textContent = displayName;
    if (idEl) idEl.textContent = cid;
    if (iconEl) iconEl.src = meta.icon;
    if (eloEl) eloEl.textContent = meta.eloDisplay;
    if (tierEl) tierEl.textContent = `(${meta.name})`;
  }

  // Upper Left Clickable Rank Display
  // Upper Left Clickable Rank Display
  function initUpperLeftRank() {
    const rankPill = document.getElementById('ct-header-rank-pill');
    const modal = document.getElementById('ranks-modal');
    const closeBtn = document.getElementById('btn-close-ranks-modal');

    function openModal() {
      updateRankUI();
      if (modal) modal.classList.add('open');
    }

    if (rankPill) {
      rankPill.addEventListener('click', (e) => {
        e.stopPropagation();
        openModal();
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
  }

  // Set ELO Test Tool in Upper Left -> Prompts ELO rating directly
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

      if (input === null) return;

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

  // Top Bar Auth & Profile Island Dropdown
  function initTopAuth() {
    const signInBtn = document.getElementById('header-signin-btn');
    const userIsland = document.getElementById('ct-user-island');
    const islandDropdown = document.getElementById('ct-island-dropdown');
    const islandAvatar = document.getElementById('island-user-avatar');
    const islandName = document.getElementById('island-user-name');
    const dropdownAvatar = document.getElementById('dropdown-user-avatar');
    const dropdownName = document.getElementById('dropdown-user-name');
    const dropdownProfileLink = document.getElementById('dropdown-profile-link');
    const signOutBtn = document.getElementById('btn-user-signout');

    // Auth Modal
    const authModal = document.getElementById('auth-modal');
    const closeAuthBtn = document.getElementById('btn-close-auth-modal');
    const discordAuthBtn = document.getElementById('btn-auth-discord-instant');
    const instantAuthBtn = document.getElementById('btn-auth-instant');

    function renderAuthState() {
      const u = state.currentUser;
      if (!u.avatar || u.avatar.includes('images.unsplash.com')) {
        u.avatar = '/adrian-avatar.png';
      }
      const displayName = u.customName || u.name || u.id;

      if (u.isLoggedIn) {
        if (signInBtn) signInBtn.style.display = 'none';
        if (userIsland) userIsland.style.display = 'inline-flex';
        if (islandAvatar) islandAvatar.src = u.avatar;
        if (islandName) islandName.textContent = displayName;
        if (dropdownAvatar) dropdownAvatar.src = u.avatar;
        if (dropdownName) dropdownName.textContent = `${displayName}${u.tag || ''}`;
        const cleanProfileId = String(u.id || '').replace(/\D/g, '').slice(0, 12) || u.id;
        if (dropdownProfileLink) dropdownProfileLink.href = `/profile/${cleanProfileId}`;
      } else {
        if (signInBtn) signInBtn.style.display = 'inline-flex';
        if (userIsland) userIsland.style.display = 'none';
        if (islandDropdown) islandDropdown.classList.remove('open');
      }

      updatePartyLeaderSlot();
      if (window.lucide) window.lucide.createIcons();
    }

    function doInstantSignIn() {
      state.currentUser = {
        id: '112118831941',
        name: 'adrian',
        customName: 'adrian',
        tag: '',
        isLoggedIn: true,
        avatar: '/adrian-avatar.png',
        isVip: true
      };
      localStorage.setItem('ct_user', JSON.stringify(state.currentUser));
      localStorage.setItem('ct_contender_id', '112118831941');
      closeAuthModal();
      renderAuthState();
      showToast('Signed in as adrian (Contender #112118831941)');
    }

    function openAuthModal() {
      if (authModal) authModal.classList.add('open');
    }

    function closeAuthModal() {
      if (authModal) authModal.classList.remove('open');
    }

    if (signInBtn) signInBtn.addEventListener('click', openAuthModal);
    if (closeAuthBtn) closeAuthBtn.addEventListener('click', closeAuthModal);
    if (instantAuthBtn) instantAuthBtn.addEventListener('click', doInstantSignIn);
    if (authModal) {
      authModal.addEventListener('click', (e) => {
        if (e.target === authModal) closeAuthModal();
      });
    }

    // Discord Sign In Click
    if (discordAuthBtn) {
      discordAuthBtn.addEventListener('click', () => {
        if (typeof signInWithDiscord === 'function') {
          signInWithDiscord();
        } else {
          doInstantSignIn();
        }
      });
    }


    // Listen to real Firebase / Discord Auth State
    if (typeof auth !== 'undefined') {
      auth.onAuthStateChanged((fbUser) => {
        if (fbUser) {
          state.currentUser.isLoggedIn = true;
          state.currentUser.name = fbUser.displayName || 'Player';
          state.currentUser.avatar = fbUser.photoURL || 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=120&auto=format&fit=crop&q=80';
          let cid = localStorage.getItem('ct_contender_id');
          if (!cid || cid.length !== 12) {
            const digits = (fbUser.uid || '').replace(/\D/g, '');
            cid = digits.length >= 12 ? digits.slice(0, 12) : Math.floor(100000000000 + Math.random() * 900000000000).toString();
            localStorage.setItem('ct_contender_id', cid);
          }
          state.currentUser.id = cid;
          localStorage.setItem('ct_user', JSON.stringify(state.currentUser));
          renderAuthState();
        }
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
        if (typeof signOut === 'function') {
          try { signOut(); } catch (e) {}
        }
        state.currentUser.isLoggedIn = false;
        state.currentUser.name = state.currentUser.id;
        state.currentUser.tag = '';
        state.currentUser.customName = '';
        localStorage.setItem('ct_user', JSON.stringify(state.currentUser));
        renderAuthState();
        showToast('Signed out successfully');
      });
    }

    renderAuthState();
  }

  // Party Leader Slot Sync
  function updatePartyLeaderSlot() {
    const leaderName = document.getElementById('party-slot-1-name');
    const leaderAvatar = document.getElementById('party-slot-1-avatar');
    const leaderRank = document.getElementById('party-slot-1-rank');

    if (state.currentUser) {
      const displayName = state.currentUser.customName || state.currentUser.name || state.currentUser.id;
      if (leaderName) leaderName.textContent = displayName;
      if (leaderAvatar) leaderAvatar.src = state.currentUser.avatar;
    }

    if (leaderRank) {
      const meta = getRankMeta(state.userElo, state.isUnranked);
      leaderRank.textContent = `${meta.name} • ${meta.eloDisplay}`;
    }
  }

  // Party System Hub & Slots Controller
  function initPartyHub() {
    const inviteModal = document.getElementById('party-invite-modal');
    const closeInviteBtn = document.getElementById('btn-close-party-invite');
    const searchInput = document.getElementById('party-search-input');
    const searchResults = document.getElementById('party-search-results');
    const openSearchBtn = document.getElementById('btn-open-party-search');
    const openModeBtn = document.getElementById('btn-open-mode-select');
    const modeLabel = document.getElementById('party-mode-label');
    const memberCount = document.getElementById('party-member-count');
    const queueBtn = document.getElementById('btn-open-queue-modal');

    // Slot 2 and Slot 3 triggers
    const slot2 = document.getElementById('party-slot-2');
    const slot3 = document.getElementById('party-slot-3');

    function openPartyInviteModal() {
      if (inviteModal) {
        inviteModal.classList.add('open');
        renderContenderList(ONLINE_CONTENDERS);
        if (searchInput) searchInput.value = '';
      }
    }

    function closePartyInviteModal() {
      if (inviteModal) inviteModal.classList.remove('open');
    }

    if (openSearchBtn) openSearchBtn.addEventListener('click', openPartyInviteModal);
    if (closeInviteBtn) closeInviteBtn.addEventListener('click', closePartyInviteModal);
    if (inviteModal) {
      inviteModal.addEventListener('click', (e) => {
        if (e.target === inviteModal) closePartyInviteModal();
      });
    }

    // Filter available contenders live (Real contenders only, no fake bots)
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim().toLowerCase();
        if (!query) {
          renderContenderList([]);
          return;
        }
        const filtered = ONLINE_CONTENDERS.filter(c =>
          c.name.toLowerCase().includes(query) || c.id.includes(query)
        );
        if (filtered.length === 0 && query.length >= 3) {
          // Allow direct party invite by Contender ID or username
          if (searchResults) {
            searchResults.innerHTML = `
              <div style="background:#000;border:none;border-radius:12px;padding:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
                <div style="display:flex;align-items:center;gap:12px;min-width:0;">
                  <div style="width:36px;height:36px;border-radius:50%;background:rgba(83,252,24,0.12);color:#53fc18;display:flex;align-items:center;justify-content:center;font-weight:700;">#</div>
                  <div style="min-width:0;">
                    <div style="font-size:0.86rem;font-weight:600;color:#fff;">Contender: ${query}</div>
                    <div style="font-size:0.72rem;color:#64748b;">Send party invite code</div>
                  </div>
                </div>
                <button type="button" class="btn-direct-invite" style="background:#14171e;border:none;color:#53fc18;padding:8px 16px;border-radius:8px;font-size:0.75rem;font-weight:700;cursor:pointer;">
                  Invite
                </button>
              </div>
            `;
            const dBtn = searchResults.querySelector('.btn-direct-invite');
            if (dBtn) {
              dBtn.addEventListener('click', () => {
                dBtn.textContent = '✓ Invited';
                dBtn.style.background = 'rgba(83,252,24,0.15)';
                dBtn.disabled = true;
                showToast(`Party invite sent to ${query}`);
              });
            }
          }
          return;
        }
        renderContenderList(filtered);
      });
    }

    function renderContenderList(list) {
      if (!searchResults) return;

      if (list.length === 0) {
        searchResults.innerHTML = `
          <div style="background:#08090c;border:none;border-radius:12px;padding:26px 16px;text-align:center;color:#64748b;font-size:0.82rem;">
            <div style="font-weight:600;color:#ffffff;margin-bottom:6px;">No other contenders currently in lobby</div>
            <div>Enter a 12-digit Contender ID above to send a direct party invite.</div>
          </div>
        `;
        return;
      }

      searchResults.innerHTML = list.map(c => `
        <div style="background:#000;border:none;border-radius:12px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="display:flex;align-items:center;gap:12px;min-width:0;">
            <img src="${c.avatar}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;" alt="${c.name}"/>
            <div style="min-width:0;">
              <div style="font-size:0.86rem;font-weight:600;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                ${c.name} <span style="font-size:0.7rem;color:#64748b;font-family:monospace;">#${c.id.slice(-4)}</span>
              </div>
              <div style="font-size:0.72rem;color:#53fc18;">${c.rank} • ${c.elo.toLocaleString()} ELO</div>
            </div>
          </div>
          <button type="button" class="btn-invite-action" data-invite-id="${c.id}" style="background:#14171e;border:none;color:#53fc18;padding:6px 14px;border-radius:8px;font-size:0.75rem;font-weight:600;cursor:pointer;white-space:nowrap;transition:all 0.15s ease;">
            Invite
          </button>
        </div>
      `).join('');

      // Wire invite click listeners
      const inviteBtns = searchResults.querySelectorAll('.btn-invite-action');
      inviteBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const cid = btn.getAttribute('data-invite-id');
          const contender = ONLINE_CONTENDERS.find(x => x.id === cid);
          if (!contender) return;

          btn.textContent = '✓ Invited';
          btn.style.background = 'rgba(83,252,24,0.15)';
          btn.disabled = true;

          showToast(`Party invitation sent to ${contender.name}`);

          setTimeout(() => {
            addPlayerToParty(contender);
            closePartyInviteModal();
          }, 1500);
        });
      });
    }

    function addPlayerToParty(player) {
      // Find first empty slot
      let targetSlot = null;
      if (!state.partySlots[1].player) {
        targetSlot = 1;
      } else if (!state.partySlots[2].player) {
        targetSlot = 2;
      }

      if (targetSlot === null) {
        showToast('Party is full (3/3 Contenders)');
        return;
      }

      state.partySlots[targetSlot].player = player;
      renderPartySlots();
      showToast(`${player.name} joined your party!`);
    }

    function removePlayerFromParty(slotIdx) {
      if (state.partySlots[slotIdx]) {
        const removed = state.partySlots[slotIdx].player;
        state.partySlots[slotIdx].player = null;
        renderPartySlots();
        if (removed) showToast(`Removed ${removed.name} from party`);
      }
    }

    function renderPartySlots() {
      // Slot 2
      if (slot2) {
        const p2 = state.partySlots[1].player;
        if (p2) {
          slot2.className = 'ct-party-slot slot-active';
          slot2.innerHTML = `
            <button type="button" class="ct-slot-kick-btn" data-kick="1" style="position:absolute;top:8px;right:8px;background:rgba(239,68,68,0.15);border:none;color:#ef4444;width:22px;height:22px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;">✕</button>
            <img src="${p2.avatar}" class="ct-slot-avatar" alt="${p2.name}"/>
            <div class="ct-slot-meta">
              <span class="ct-slot-name">${p2.name}</span>
              <span class="ct-slot-rank">${p2.rank} • ${p2.elo.toLocaleString()} ELO</span>
            </div>
          `;
        } else {
          slot2.className = 'ct-party-slot slot-empty';
          slot2.innerHTML = `
            <button type="button" class="ct-party-invite-btn" id="btn-invite-slot-2">
              <div class="ct-party-plus-icon">
                <i data-lucide="plus" style="width:20px;height:20px;"></i>
              </div>
              <span class="ct-party-slot-text">Invite Friend</span>
            </button>
          `;
          const b2 = slot2.querySelector('#btn-invite-slot-2');
          if (b2) b2.addEventListener('click', openPartyInviteModal);
        }
      }

      // Slot 3
      if (slot3) {
        const p3 = state.partySlots[2].player;
        if (p3) {
          slot3.className = 'ct-party-slot slot-active';
          slot3.innerHTML = `
            <button type="button" class="ct-slot-kick-btn" data-kick="2" style="position:absolute;top:8px;right:8px;background:rgba(239,68,68,0.15);border:none;color:#ef4444;width:22px;height:22px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;">✕</button>
            <img src="${p3.avatar}" class="ct-slot-avatar" alt="${p3.name}"/>
            <div class="ct-slot-meta">
              <span class="ct-slot-name">${p3.name}</span>
              <span class="ct-slot-rank">${p3.rank} • ${p3.elo.toLocaleString()} ELO</span>
            </div>
          `;
        } else {
          slot3.className = 'ct-party-slot slot-empty';
          slot3.innerHTML = `
            <button type="button" class="ct-party-invite-btn" id="btn-invite-slot-3">
              <div class="ct-party-plus-icon">
                <i data-lucide="plus" style="width:20px;height:20px;"></i>
              </div>
              <span class="ct-party-slot-text">Invite Friend</span>
            </button>
          `;
          const b3 = slot3.querySelector('#btn-invite-slot-3');
          if (b3) b3.addEventListener('click', openPartyInviteModal);
        }
      }

      // Update Member Count
      const activeCount = 1 + (state.partySlots[1].player ? 1 : 0) + (state.partySlots[2].player ? 1 : 0);
      if (memberCount) memberCount.textContent = `${activeCount} / 3 Contenders`;

      // Wire kick buttons
      document.querySelectorAll('.ct-slot-kick-btn').forEach(kBtn => {
        kBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const sIdx = parseInt(kBtn.getAttribute('data-kick'), 10);
          removePlayerFromParty(sIdx);
        });
      });

      if (window.lucide) window.lucide.createIcons();
    }

    // Slot invite triggers initial bind
    const b2 = document.getElementById('btn-invite-slot-2');
    const b3 = document.getElementById('btn-invite-slot-3');
    if (b2) b2.addEventListener('click', openPartyInviteModal);
    if (b3) b3.addEventListener('click', openPartyInviteModal);

    // Mode Selector Modal Trigger
    if (openModeBtn) {
      openModeBtn.addEventListener('click', () => {
        const qModal = document.getElementById('queue-select-modal');
        if (qModal) qModal.classList.add('open');
      });
    }

    renderPartySlots();
  }

  // 10s Carousel Slider
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
      }, 10000);
    }

    function resetTimer() {
      clearInterval(state.carouselTimer);
      startTimer();
    }

    startTimer();
  }

  // Gamemode Queue Controller
  function initQueueModal() {
    const openBtn = document.getElementById('btn-open-queue-modal');
    const modal = document.getElementById('queue-select-modal');
    const closeBtn = document.getElementById('btn-close-queue-modal');
    const startQueueBtn = document.getElementById('btn-start-queue-modal');
    const modeLabel = document.getElementById('party-mode-label');

    if (openBtn) {
      openBtn.addEventListener('click', (e) => {
        const cancelX = e.target.closest('#btn-cancel-queue-x');
        if (cancelX) {
          e.stopPropagation();
          cancelQueue();
          return;
        }
        if (state.isQueueing) {
          cancelQueue();
        } else {
          if (modal) modal.classList.add('open');
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

    // Team Size Selectors
    const sizeBtns = document.querySelectorAll('.ct-size-btn');
    sizeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        sizeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.teamSize = btn.getAttribute('data-size') || '1v1';
        updateModalQueueBtn();
      });
    });

    // Gamemode Selectors
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
      const modeName = getGamemodeDisplayName(state.gameMode);
      const bo = getBestOfFormat(state.gameMode);
      if (startQueueBtn) {
        startQueueBtn.textContent = `Queue ${state.teamSize} ${modeName}`;
      }
      if (modeLabel) {
        modeLabel.textContent = `${state.teamSize} ${modeName} (${bo})`;
      }
    }

    if (startQueueBtn) {
      startQueueBtn.addEventListener('click', () => {
        closeModal();
        startQueue();
      });
    }

    function startQueue() {
      state.isQueueing = true;
      state.queueSeconds = 0;
      if (openBtn) {
        openBtn.classList.add('queueing');
        openBtn.innerHTML = `
          <div class="ct-queue-spinner"></div>
          <span class="ct-queue-text-wrap">Search for players<span id="queue-dots">..</span></span>
          <span id="queue-btn-timer" class="ct-queue-btn-timer">0:00</span>
          <span id="btn-cancel-queue-x" class="ct-queue-btn-x">
            <i data-lucide="x" style="width:16px;height:16px;"></i>
          </span>
        `;
        if (window.lucide) window.lucide.createIcons();
      }

      // Animated Dots: . , .. , ... , .
      let dotStep = 2;
      clearInterval(state.dotsTimer);
      state.dotsTimer = setInterval(() => {
        dotStep = (dotStep % 3) + 1;
        const dotsEl = document.getElementById('queue-dots');
        if (dotsEl) {
          dotsEl.textContent = '.'.repeat(dotStep);
        }
      }, 420);

      // Elapsed Timer
      clearInterval(state.queueTimer);
      state.queueTimer = setInterval(() => {
        state.queueSeconds++;
        const mins = Math.floor(state.queueSeconds / 60);
        const secs = state.queueSeconds % 60;
        const fmt = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        const timerBadge = document.getElementById('queue-btn-timer');
        if (timerBadge) timerBadge.textContent = fmt;

        // Match Found Simulation after 8 seconds
        if (state.queueSeconds === 8) {
          matchFoundSimulation();
        }
      }, 1000);
    }

    function cancelQueue() {
      state.isQueueing = false;
      clearInterval(state.queueTimer);
      clearInterval(state.dotsTimer);
      if (openBtn) {
        openBtn.classList.remove('queueing');
        openBtn.innerHTML = `<i data-lucide="play" style="width:20px;height:20px;fill:currentColor;"></i> <span>Queue Match</span>`;
        if (window.lucide) window.lucide.createIcons();
      }
      showToast('Matchmaking cancelled.');
    }

    function matchFoundSimulation() {
      clearInterval(state.queueTimer);
      clearInterval(state.dotsTimer);
      if (openBtn) {
        openBtn.classList.remove('queueing');
        openBtn.innerHTML = `<i data-lucide="check" style="width:20px;height:20px;"></i> <span>Match Found!</span>`;
        if (window.lucide) window.lucide.createIcons();
      }
      showMatchModal();
    }
  }

  function getGamemodeDisplayName(key) {
    switch (key) {
      case 'realistic': return 'Realistic';
      case 'boxfight': return 'Box Fights';
      case 'buildfight': return 'Build Fights';
      case 'zonewars': return 'Zone Wars';
      default: return 'Realistic';
    }
  }

  function getBestOfFormat(key) {
    switch (key) {
      case 'realistic': return 'BO9';
      case 'boxfight': return 'BO7';
      case 'buildfight': return 'BO5';
      case 'zonewars': return 'BO9';
      default: return 'BO9';
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
      <div class="ct-queue-modal-card" style="text-align:center;border:none;">
        <div style="width:48px;height:48px;border-radius:12px;background:rgba(83,252,24,0.15);color:#53fc18;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;">
          <i data-lucide="swords" style="width:24px;height:24px;"></i>
        </div>
        <h3 style="font-family:'Outfit',sans-serif;font-size:1.4rem;font-weight:600;color:#fff;margin-bottom:4px;">Match Found!</h3>
        <p style="color:#94a3b8;font-size:0.8rem;margin-bottom:16px;">
          Opponent matched within ±300 ELO range.
        </p>
        <div style="background:#000;border:none;border-radius:12px;padding:14px;margin-bottom:16px;text-align:left;font-size:0.82rem;">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="color:#64748b;font-weight:600;">Playlist:</span>
            <span style="color:#fff;font-weight:600;">${state.teamSize} ${modeName}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="color:#64748b;font-weight:600;">Opponent ELO:</span>
            <span style="color:#53fc18;font-weight:600;">2,480 ELO (Elite)</span>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span style="color:#64748b;font-weight:600;">Island Code:</span>
            <span style="color:#fbbf24;font-weight:600;font-family:monospace;">2355-0939-8965</span>
          </div>
        </div>
        <div style="display:flex;gap:10px;">
          <button type="button" class="btn-modal-start-queue" style="margin-top:0;" onclick="window.location.href='matches'">Accept & Play</button>
          <button type="button" class="btn btn-outline" style="border-radius:10px;padding:10px 18px;border:none;" onclick="closeMatchModal()">Decline</button>
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
    if (openBtn) {
      openBtn.classList.remove('queueing');
      openBtn.innerHTML = `<i data-lucide="play" style="width:20px;height:20px;fill:currentColor;"></i> <span>Queue Match</span>`;
    }
    if (window.lucide) window.lucide.createIcons();
  };

  // Referrals Modal
  function initReferralsModal() {
    const modal = document.getElementById('referrals-modal');
    const triggers = document.querySelectorAll('.trigger-referrals');
    const closeBtn = document.getElementById('btn-close-referrals');
    const copyBtn = document.getElementById('btn-copy-ref-link');
    const input = document.getElementById('referral-link-input');
    const islandDropdown = document.getElementById('ct-island-dropdown');

    if (input && state.currentUser) {
      input.value = `https://championtokens.fun/?ref=CHAMP-${state.currentUser.id.slice(-8)}`;
    }

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



  // Real-Time Online Ticker (Real stats: 1 Player Online • 0 Matches In Progress)
  function initLiveTicker() {
    const onlineEl = document.getElementById('ticker-online-count');
    const matchesEl = document.getElementById('ticker-matches-count');
    if (onlineEl) onlineEl.textContent = '1';
    if (matchesEl) matchesEl.textContent = '0';
  }

  // ── Collectible Coin System & Daily Login Rewards ─────────────
  function getUserCoins() {
    const val = localStorage.getItem('ct_user_coins');
    return val !== null ? parseInt(val, 10) : 100;
  }

  function setUserCoins(val) {
    localStorage.setItem('ct_user_coins', val.toString());
    const countEl = document.getElementById('header-coin-count');
    if (countEl) countEl.textContent = val.toLocaleString();
  }

  function getDailyState() {
    const lastClaim = parseInt(localStorage.getItem('ct_daily_last_claim') || '0', 10);
    const streak = parseInt(localStorage.getItem('ct_daily_streak') || '0', 10);
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const canClaim = !lastClaim || (now - lastClaim >= oneDayMs);
    return { canClaim, streak: canClaim && (now - lastClaim > 2 * oneDayMs) ? 0 : streak };
  }

  function ensureDailyRewardModal() {
    if (document.getElementById('daily-reward-modal')) return;

    const dailyRewards = [50, 75, 100, 125, 150, 200, 300];
    const { canClaim, streak } = getDailyState();
    const activeDayIdx = Math.min(streak, 6);

    const modal = document.createElement('div');
    modal.className = 'ct-modal-overlay';
    modal.id = 'daily-reward-modal';
    modal.style.zIndex = '3500';

    modal.innerHTML = `
      <div class="ct-ranks-modal-card" style="max-width:560px;">
        <button type="button" class="ct-modal-close-btn" id="btn-close-daily-modal">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>

        <div class="ct-modal-title" style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
          <span style="font-family:'Outfit',sans-serif;font-weight:700;font-size:1.15rem;color:#ffffff;">Daily Login Rewards</span>
          <span style="background:rgba(251,191,36,0.12);color:#fbbf24;font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:6px;border:none;text-transform:uppercase;margin-left:auto;">Streak: ${streak} Days</span>
        </div>
        <div style="font-size:0.78rem;color:#94a3b8;margin-bottom:14px;">
          Log in daily to claim coins. Streaks reset if more than 48 hours pass between logins.
        </div>

        <div class="ct-daily-grid">
          ${dailyRewards.map((reward, i) => {
            const isClaimed = i < streak;
            const isActive = i === activeDayIdx && canClaim;
            return `
              <div class="ct-daily-card ${isClaimed ? 'claimed' : (isActive ? 'active' : '')}">
                <div class="ct-daily-card-day">Day ${i + 1}</div>
                <div class="ct-daily-card-val">+${reward}</div>
                <div class="ct-daily-card-tag">${isClaimed ? 'Claimed' : (isActive ? 'Claim' : 'Locked')}</div>
              </div>
            `;
          }).join('')}
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
        showToast(`Claimed +${reward} Coins! Total: ${newTotal.toLocaleString()} Coins`);
      });
    }
  }

  function initCoinsAndDaily() {
    const coins = getUserCoins();
    const countEl = document.getElementById('header-coin-count');
    if (countEl) countEl.textContent = coins.toLocaleString();

    const coinPill = document.getElementById('ct-header-coin-pill');
    if (coinPill) {
      coinPill.addEventListener('click', (e) => {
        e.stopPropagation();
        ensureDailyRewardModal();
        const modal = document.getElementById('daily-reward-modal');
        if (modal) modal.classList.add('open');
      });
    }
  }

  // ── Clean & Simple Terms of Service Modal (No Outline) ────────
  function ensureTosModal() {
    if (document.getElementById('tos-modal')) return;

    const isAccepted = localStorage.getItem('ct_tos_accepted_v4') === 'true';

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
              <div class="ct-tos-item-title">Match Evidence & Verification</div>
              <p class="ct-tos-item-desc">Contenders must provide unedited match screenshots or clip recordings upon request to confirm match outcomes and settle score discrepancies.</p>
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
        localStorage.setItem('ct_tos_accepted_v4', 'true');
        modal.classList.remove('open');
        if (closeBtn) closeBtn.style.display = 'block';
        checkbox.checked = true;
        checkbox.disabled = true;
        acceptBtn.textContent = 'Close Agreement';
        showToast('Terms & Rules accepted.');
      });
    }

    modal.addEventListener('click', (e) => {
      const acceptedNow = localStorage.getItem('ct_tos_accepted_v4') === 'true';
      if (acceptedNow && e.target === modal) modal.classList.remove('open');
    });
  }

  // ── Modern Chromium Dark Cookie Consent Controller ─────────
  function ensureCookieBanner() {
    if (document.getElementById('ct-cookie-banner')) return;

    const isAccepted = localStorage.getItem('ct_cookies_accepted_v4') === 'true';

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
      localStorage.setItem('ct_cookies_accepted_v4', 'true');
      banner.classList.remove('show');
      setTimeout(() => { banner.style.display = 'none'; }, 400);
    };

    banner.querySelector('#btn-cookie-accept')?.addEventListener('click', dismiss);
    banner.querySelector('#btn-cookie-reject')?.addEventListener('click', dismiss);
  }

  function initTosOnMain() {
    ensureTosModal();

    // If not accepted yet, prompt on main tab
    const isAccepted = localStorage.getItem('ct_tos_accepted_v4') === 'true';
    if (!isAccepted) {
      const modal = document.getElementById('tos-modal');
      if (modal) modal.classList.add('open');
    }

    // Wire footer links
    const tosBtn = document.getElementById('footer-btn-tos');
    const privacyBtn = document.getElementById('footer-btn-privacy');
    const fairplayBtn = document.getElementById('footer-btn-fairplay');

    if (tosBtn) {
      tosBtn.addEventListener('click', () => {
        ensureTosModal();
        document.getElementById('tos-modal')?.classList.add('open');
      });
    }
    if (privacyBtn) {
      privacyBtn.addEventListener('click', () => {
        alert('Privacy Policy: Champion Tokens encrypts contender session tokens and never shares personal identifiers, IP logs, or Discord credentials with external parties.');
      });
    }
    if (fairplayBtn) {
      fairplayBtn.addEventListener('click', () => {
        ensureTosModal();
        document.getElementById('tos-modal')?.classList.add('open');
      });
    }
  }

  // Toast Notification
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
        border: none;
        color: #ffffff;
        padding: 9px 20px;
        border-radius: 99px;
        font-size: 0.8rem;
        font-weight: 600;
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