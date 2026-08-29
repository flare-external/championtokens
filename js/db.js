// ============================================================
//  CHAMPION TOKENS — Database / Firestore Helpers
// ============================================================

// ── Utility Helpers ───────────────────────────────────────────

/** Escape HTML to prevent XSS in dynamically rendered strings */
function escapeHtml(str) {
  return str ? String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '';
}

// ── Users ────────────────────────────────────────────────────

/**
 * Ensures user document exists with 10.00 Tokens starter balance.
 * Resolves best available display name from Discord profile, email, or cache.
 */
async function ensureUserRecord(user) {
  if (!user || !user.uid) return null;
  const userRef = db.collection('users').doc(user.uid);
  const snap = await userRef.get();

  let discordUserCache = null;
  try {
    const raw = localStorage.getItem('ct_cached_discord_user');
    if (raw) discordUserCache = JSON.parse(raw);
  } catch (e) {}

  let bestName = (user.displayName && user.displayName !== 'Champion' && user.displayName !== 'Player') ? user.displayName : null;
  if (!bestName) {
    if (discordUserCache?.displayName && discordUserCache.displayName !== 'Champion') {
      bestName = discordUserCache.displayName;
    } else if (discordUserCache?.discordUsername) {
      bestName = discordUserCache.discordUsername;
    } else if (user.email && user.email.includes('@')) {
      bestName = user.email.split('@')[0];
    } else if (user.uid.startsWith('discord:')) {
      bestName = `Player_${user.uid.replace('discord:', '').slice(0, 5)}`;
    } else {
      bestName = 'Player';
    }
  }

  const photoURL = user.photoURL || discordUserCache?.photoURL || '';
  const discordId = discordUserCache?.discordId || (user.uid.startsWith('discord:') ? user.uid.replace('discord:', '') : '');
  const discordUsername = discordUserCache?.discordUsername || '';

  if (!snap.exists) {
    const newUser = {
      uid: user.uid,
      displayName: bestName,
      email: user.email || discordUserCache?.email || '',
      photoURL: photoURL,
      discordId: discordId,
      discordUsername: discordUsername,
      tokens: 1.00,
      totalEarned: 0.00,
      totalSpent: 0.00,
      matchesPlayed: 0,
      matchesWon: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await userRef.set(newUser);
    await db.collection('transactions').add({
      userId: user.uid,
      amount: 1.00,
      type: 'bonus',
      description: '1.00 Free Starter Token',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { id: user.uid, ...newUser };
  } else {
    // Existing document — auto-repair if displayName is 'Champion' or 'Player'
    const existing = snap.data();
    if (!existing.displayName || existing.displayName === 'Champion' || existing.displayName === 'Player') {
      if (bestName && bestName !== 'Champion' && bestName !== 'Player') {
        await userRef.update({
          displayName: bestName,
          ...(discordUsername && !existing.discordUsername ? { discordUsername } : {}),
          ...(discordId && !existing.discordId ? { discordId } : {}),
          ...(photoURL && (!existing.photoURL || existing.photoURL.includes('default')) ? { photoURL } : {})
        });
        existing.displayName = bestName;
      }
    }
    return { id: snap.id, ...existing };
  }
}

/** Fetch a user document by UID (or create with 10.00 starter tokens if missing) */
async function getUser(uid) {
  if (!uid) return null;
  const snap = await db.collection('users').doc(uid).get();
  if (snap.exists) {
    const data = snap.data();
    // Auto-repair if displayName is 'Champion' or 'Player'
    if (!data.displayName || data.displayName === 'Champion' || data.displayName === 'Player') {
      let repairName = data.discordUsername;
      if (!repairName) {
        try {
          const raw = localStorage.getItem('ct_cached_discord_user');
          if (raw) {
            const cached = JSON.parse(raw);
            if (cached.displayName && cached.displayName !== 'Champion') repairName = cached.displayName;
            else if (cached.discordUsername) repairName = cached.discordUsername;
          }
        } catch (e) {}
      }
      if (repairName && repairName !== 'Champion' && repairName !== 'Player') {
        data.displayName = repairName;
        db.collection('users').doc(uid).update({ displayName: repairName }).catch(console.warn);
      }
    }
    return { id: snap.id, ...data };
  }
  const authUser = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;
  if (authUser && authUser.uid === uid) {
    return await ensureUserRecord(authUser);
  }
  return null;
}

/**
 * Update a user's token balance and log a transaction.
 * @param {string} uid
 * @param {number} amount  positive = credit, negative = debit
 * @param {string} type    'bonus' | 'match_wager' | 'match_win' | 'refund' | 'purchase' | 'admin'
 * @param {string} description
 */
async function updateTokens(uid, amount, type, description) {
  const roundedAmount = Math.round(Number(amount) * 100) / 100;
  const userRef = db.collection('users').doc(uid);
  const update  = {
    tokens: firebase.firestore.FieldValue.increment(roundedAmount),
  };
  if (roundedAmount > 0 && type === 'match_win') {
    update.totalEarned = firebase.firestore.FieldValue.increment(roundedAmount);
  }
  if (roundedAmount < 0) {
    update.totalSpent  = firebase.firestore.FieldValue.increment(Math.abs(roundedAmount));
  }

  await userRef.update(update);

  await db.collection('transactions').add({
    userId:      uid,
    amount:      roundedAmount,
    type,
    description,
    timestamp:   firebase.firestore.FieldValue.serverTimestamp(),
  });
}

// ── Matches ──────────────────────────────────────────────────

/** Generate a random 6-character match code */
function generateMatchCode() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

/**
 * Create a new match with 30-min expiration and ready status.
 * @param {object} hostUser
 * @param {object} matchData { mode: 'Realistic'|'Zone Wars'|'Box Fights', size: '1v1'|'2v2'|'3v3', wager: number }
 */
async function createMatch(hostUser, matchData) {
  const wager = Math.round(parseFloat(matchData.wager) * 100) / 100;
  if (isNaN(wager) || wager < 0.50) {
    throw new Error('Minimum entry is 0.50 tokens ($0.50)');
  }

  const size = matchData.size || '1v1';
  const mode = matchData.mode || 'Realistic';
  const maxPlayers = size === '1v1' ? 2 : size === '2v2' ? 4 : 6;
  const title = `${size} ${mode}`;
  const code = generateMatchCode();

  // Squad / Team queue settings
  const queueType = matchData.queueType || 'solo'; // 'solo' | 'team'
  const teamId = matchData.teamId || null;
  let teamName = matchData.teamName || null;
  let teamTag = matchData.teamTag || null;
  let teamIcon = matchData.teamIcon || null;
  let teamIconColor = matchData.teamIconColor || null;
  let teamBgColor = matchData.teamBgColor || null;
  let teamBorderColor = matchData.teamBorderColor || null;
  let invitedTeammates = matchData.invitedTeammates || [];

  // If team queue, automatically invite team roster if not pre-provided
  if (queueType === 'team' && teamId) {
    try {
      const teamSnap = await db.collection('teams').doc(teamId).get();
      if (teamSnap.exists) {
        const tData = teamSnap.data();
        teamName = teamName || tData.name;
        teamTag = teamTag || tData.tag;
        teamIcon = teamIcon || tData.icon || 'shield';
        teamIconColor = teamIconColor || tData.iconColor || '#f59e0b';
        teamBgColor = teamBgColor || tData.bgColor || 'rgba(245, 158, 11, 0.18)';
        teamBorderColor = teamBorderColor || tData.borderColor || 'rgba(245, 158, 11, 0.45)';

        if (!invitedTeammates || !invitedTeammates.length) {
          const needed = Math.max(1, (maxPlayers / 2) - 1);
          const otherMembers = (tData.members || []).filter(m => m.uid !== hostUser.uid);
          invitedTeammates = otherMembers.slice(0, needed).map(m => ({
            uid: m.uid,
            displayName: m.displayName || 'Teammate',
            photoURL: m.photoURL || '',
            epicUsername: m.epicUsername || '',
            invitedAt: Date.now(),
            status: 'pending'
          }));
        }
      }
    } catch (e) {
      console.warn('Could not auto-fetch team members for match invite:', e);
    }
  }

  const tokenCoverage = matchData.tokenCoverage || 'none'; // 'none' | 'all' | 'custom'
  const coveredMemberUids = matchData.coveredMemberUids || [];
  const splitRule = matchData.splitRule || 'equal'; // 'equal' | 'captain_first' | 'captain_70'

  // Calculate upfront tokens host needs to deposit
  let hostDeposit = wager;
  if (size !== '1v1' && teamId) {
    if (tokenCoverage === 'all') {
      const squadTeammates = Math.max(1, (maxPlayers / 2) - 1);
      hostDeposit = wager * (1 + squadTeammates);
    } else if (tokenCoverage === 'custom') {
      hostDeposit = wager * (1 + coveredMemberUids.length);
    }
  }

  if (Number(hostUser.tokens || 0) < hostDeposit) {
    throw new Error(`Insufficient tokens (Requires ${formatTokens(hostDeposit)} tokens to create match)`);
  }

  // 30 Minutes from now
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  const hostPlayer = {
    uid:          hostUser.uid,
    displayName:  hostUser.displayName || 'Host',
    epicUsername: hostUser.epicUsername || '',
    isPremium:    !!hostUser.isPremium,
    photoURL:     hostUser.photoURL || '',
    isHost:       true,
    ready:        false,
    team:         1,
    teamTag:      teamTag || '',
    paidAmount:   hostDeposit,
  };

  let defaultMapCode = '9854-1829-8735';
  if (mode === 'Zone Wars') defaultMapCode = '3537-4087-0888';
  else if (mode === 'Box Fights') defaultMapCode = '2355-0939-8965';
  const mapCode = matchData.mapCode || defaultMapCode;

  const region = matchData.region || 'EU';
  const platform = matchData.platform || 'All';
  const rounds = matchData.rounds || (mode === 'Box Fights' ? 'First to 5' : (mode === 'Zone Wars' ? 'Best of 5' : 'First to 5'));
  
  let defaultLoot = 'Iron pump (Default AR)';
  if (mode === 'Zone Wars') defaultLoot = 'Pump (AR)';
  else if (mode === 'Box Fights') defaultLoot = 'Havoc only';
  const lootPool = matchData.lootPool || defaultLoot;
  const simpleEdit = matchData.simpleEdit || 'Disabled';

  const matchRef = await db.collection('matches').add({
    title,
    size,
    mode,
    wager,
    maxPlayers,
    mapCode,
    queueType,
    teamId,
    teamName,
    teamTag,
    teamIcon:        teamIcon || null,
    teamIconColor:   teamIconColor || null,
    teamBgColor:     teamBgColor || null,
    teamBorderColor: teamBorderColor || null,
    region,
    platform,
    rounds,
    lootPool,
    simpleEdit,
    invitedTeammates,
    tokenCoverage,
    coveredMemberUids,
    splitRule,
    hostCoveredDeposit: hostDeposit,
    players:    [hostPlayer],
    playerUids: [hostUser.uid],
    status:     'waiting', // waiting | in_progress | completed | cancelled
    createdBy:  hostUser.uid,
    hostName:   hostUser.displayName,
    code,
    prizePool:  hostDeposit,
    winner:     null,
    createdAt:  firebase.firestore.FieldValue.serverTimestamp(),
    expiresAt:  firebase.firestore.Timestamp.fromDate(expiresAt),
    completedAt:null,
  });

  // Hold the host's tokens
  await updateTokens(
    hostUser.uid,
    -hostDeposit,
    'match_wager',
    `Created match — "${title}" (${code})`
  );

  // Send in-app notification to all invited teammates
  // Send in-app notification to all invited teammates
  if (queueType === 'team' && invitedTeammates.length > 0) {
    for (const tm of invitedTeammates) {
      try {
        await db.collection('users').doc(tm.uid).collection('notifications').add({
          type: 'match_team_invite',
          title: 'Team Match Invite',
          body: `${hostUser.displayName || 'Captain'} invited you to join team match "${title}" (${formatTokens(wager)} Tokens)${tm.isCovered ? ' · Entry Covered Free!' : ''}`,
          matchId: matchRef.id,
          matchCode: code,
          matchTitle: title,
          wager: wager,
          hostName: hostUser.displayName || 'Captain',
          hostUid: hostUser.uid,
          teamName: teamName || 'Team 1',
          team: 1,
          isCovered: !!tm.isCovered,
          read: false,
          accepted: false,
          declined: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      } catch (notifErr) {
        console.warn('Failed to send team match notification to', tm.uid, notifErr);
      }
    }
  }

  return { id: matchRef.id, code, title };
}

/**
 * Join a match by its 6-character code or document ID.
 */
async function joinMatch(codeOrId, joiningUser) {
  const cleanKey = (codeOrId || '').trim();
  let matchDoc = null;

  if (cleanKey.length === 6 && !cleanKey.includes('-')) {
    const snap = await db.collection('matches')
      .where('code', '==', cleanKey.toUpperCase())
      .where('status', '==', 'waiting')
      .limit(1)
      .get();
    if (!snap.empty) matchDoc = snap.docs[0];
  }

  if (!matchDoc) {
    const snap = await db.collection('matches').doc(cleanKey).get();
    if (snap.exists) matchDoc = snap;
  }

  if (!matchDoc || !matchDoc.exists) throw new Error('Match not found, started, or expired');

  const match = matchDoc.data();
  const wager = Number(match.wager || 0);

  if (match.status !== 'waiting') throw new Error('This match has already started or ended');

  // Check if 30-min timer expired
  if (match.expiresAt && match.expiresAt.toDate() < new Date()) {
    await expireMatch(matchDoc.id);
    throw new Error('This match has expired and is no longer available');
  }

  const players = match.players || [];
  if (players.length >= match.maxPlayers) throw new Error('This match is already full');
  if (players.find(p => p.uid === joiningUser.uid)) throw new Error('You are already in this match');

  const halfCount = (match.maxPlayers || 2) / 2;
  const existingTeam1Players = players.filter(p => p.team === 1 || p.isHost || p.isTeammate || p.uid === match.createdBy);
  const existingTeam2Players = players.filter(p => p.team === 2 || (p.teamId && match.team2Id && p.teamId === match.team2Id));

  // Check if user is in invitedTeammates list
  const invitedEntry = (match.invitedTeammates || []).find(tm => tm.uid === joiningUser.uid);

  let assignedTeam = 2;
  let isTeammate = false;
  let isCovered = false;

  if (invitedEntry) {
    assignedTeam = invitedEntry.team || 1;
    isTeammate = true;
    isCovered = !!invitedEntry.isCovered;
  } else if (match.queueType === 'team' || match.teamId) {
    const isHostTeamMember = (match.teamId && joiningUser.teamId === match.teamId) || (match.coveredMemberUids || []).includes(joiningUser.uid);
    const isTeam2Member = (match.team2Id && joiningUser.teamId === match.team2Id) || (match.team2CoveredMemberUids || []).includes(joiningUser.uid);

    if (isHostTeamMember && existingTeam1Players.length < halfCount) {
      assignedTeam = 1;
      isTeammate = true;
      isCovered = (match.tokenCoverage === 'all') || (match.coveredMemberUids || []).includes(joiningUser.uid);
    } else if (isTeam2Member && existingTeam2Players.length < halfCount) {
      assignedTeam = 2;
      isTeammate = true;
      isCovered = (match.team2TokenCoverage === 'all') || (match.team2CoveredMemberUids || []).includes(joiningUser.uid);
    } else {
      assignedTeam = existingTeam1Players.length < halfCount ? 1 : 2;
    }
  } else {
    assignedTeam = existingTeam1Players.length < halfCount ? 1 : 2;
  }

  const playerDeduction = isCovered ? 0 : wager;

  if (playerDeduction > 0 && Number(joiningUser.tokens || 0) < playerDeduction) {
    throw new Error(`Insufficient tokens to join (Requires ${formatTokens(playerDeduction)} tokens)`);
  }

  const targetTeamTag = assignedTeam === 1 ? (match.teamTag || joiningUser.teamTag || '') : (match.team2Tag || joiningUser.teamTag || '');

  const newPlayer = {
    uid:          joiningUser.uid,
    displayName:  joiningUser.displayName || 'Player',
    epicUsername: joiningUser.epicUsername || '',
    isPremium:    !!joiningUser.isPremium,
    photoURL:     joiningUser.photoURL || '',
    isHost:       false,
    ready:        false,
    team:         assignedTeam,
    teamId:       joiningUser.teamId || null,
    teamTag:      targetTeamTag,
    isTeammate:   isTeammate,
    paidAmount:   playerDeduction,
    isCovered:    isCovered,
  };

  const updatedInvited = (match.invitedTeammates || []).map(tm => {
    if (tm.uid === joiningUser.uid) {
      return { ...tm, status: 'accepted' };
    }
    return tm;
  });

  const updateFields = {
    players:          firebase.firestore.FieldValue.arrayUnion(newPlayer),
    playerUids:       firebase.firestore.FieldValue.arrayUnion(joiningUser.uid),
    invitedTeammates: updatedInvited,
  };
  if (playerDeduction > 0) {
    updateFields.prizePool = firebase.firestore.FieldValue.increment(playerDeduction);
  }

  await matchDoc.ref.update(updateFields);

  if (playerDeduction > 0) {
    await updateTokens(
      joiningUser.uid,
      -playerDeduction,
      'match_wager',
      `Joined match — "${match.title}" (${match.code})`
    );
  }

  return matchDoc.id;
}

/**
 * Join a match with your team (places joiningUser in Team 2 and auto-invites team roster).
 */
async function joinMatchWithTeam(codeOrId, joiningUser, options = {}) {
  const chosenTeamId = options.teamId || joiningUser.teamId;
  if (!chosenTeamId) {
    throw new Error('You must select or be in a team to join with your team. Go to Profile > Teams to create or join one.');
  }

  let matchDoc = null;
  if (codeOrId.length === 6 && !codeOrId.includes('-')) {
    const snap = await db.collection('matches')
      .where('code', '==', codeOrId.toUpperCase())
      .where('status', '==', 'waiting')
      .limit(1)
      .get();
    if (!snap.empty) matchDoc = snap.docs[0];
  }
  if (!matchDoc) {
    const docSnap = await db.collection('matches').doc(codeOrId).get();
    if (docSnap.exists) matchDoc = docSnap;
  }

  if (!matchDoc || !matchDoc.exists) throw new Error('Match not found, started, or expired');

  const match = matchDoc.data();
  const wager = Number(match.wager || 0);

  if (match.status !== 'waiting') throw new Error('This match has already started or ended');

  if (match.expiresAt && match.expiresAt.toDate() < new Date()) {
    await expireMatch(matchDoc.id);
    throw new Error('This match has expired and is no longer available');
  }

  if ((match.players || []).find(p => p.uid === joiningUser.uid)) {
    throw new Error('You are already in this match');
  }

  const halfCount = (match.maxPlayers || 2) / 2;
  const existingTeam2Count = (match.players || []).filter(p => p.team === 2 || (p.teamId && p.teamId === chosenTeamId && p.uid !== match.createdBy)).length;

  if (existingTeam2Count >= halfCount) {
    throw new Error('Opponent squad (Team 2) is already full');
  }

  const tokenCoverage = options.tokenCoverage || 'none'; // 'none' | '1' | 'all' | 'custom'
  let coveredMemberUids = options.coveredMemberUids || [];
  const splitRule = options.splitRule || 'keep'; // 'keep' | 'split'

  // Fetch joining user's team details & members
  let invitedTeammates = [];
  let teamName = joiningUser.teamName || 'Team 2';
  let teamTag = joiningUser.teamTag || '';
  let teamIcon = 'swords';
  let teamIconColor = '#3b82f6';
  let teamBgColor = 'rgba(59, 130, 246, 0.18)';
  let teamBorderColor = 'rgba(59, 130, 246, 0.45)';

  try {
    const teamSnap = await db.collection('teams').doc(chosenTeamId).get();
    if (teamSnap.exists) {
      const tData = teamSnap.data();
      teamName = tData.name || teamName;
      teamTag = tData.tag || teamTag;
      teamIcon = tData.icon || teamIcon;
      teamIconColor = tData.iconColor || teamIconColor;
      teamBgColor = tData.bgColor || teamBgColor;
      teamBorderColor = tData.borderColor || teamBorderColor;
      const needed = Math.max(0, halfCount - 1);
      const otherMembers = (tData.members || []).filter(m => m.uid !== joiningUser.uid);

      if (tokenCoverage === 'all') {
        coveredMemberUids = otherMembers.slice(0, needed).map(m => m.uid);
      } else if (tokenCoverage === '1' && otherMembers.length > 0 && !coveredMemberUids.length) {
        coveredMemberUids = [otherMembers[0].uid];
      }

      invitedTeammates = otherMembers.slice(0, needed).map(m => ({
        uid: m.uid,
        displayName: m.displayName || 'Teammate',
        photoURL: m.photoURL || '',
        epicUsername: m.epicUsername || '',
        team: 2,
        teamId: chosenTeamId,
        isCovered: coveredMemberUids.includes(m.uid),
        invitedAt: Date.now(),
        status: 'pending'
      }));
    }
  } catch (e) {
    console.warn('joinMatchWithTeam team fetch notice:', e);
  }

  // Calculate upfront deposit
  const coveredCount = coveredMemberUids.length;
  const joinerTotalDeposit = wager * (1 + coveredCount);

  if (Number(joiningUser.tokens || 0) < joinerTotalDeposit) {
    throw new Error(`Insufficient tokens (Requires ${formatTokens(joinerTotalDeposit)} tokens to join${coveredCount > 0 ? ` & cover ${coveredCount} teammate(s)` : ''})`);
  }

  const newPlayer = {
    uid:          joiningUser.uid,
    displayName:  joiningUser.displayName || 'Player',
    epicUsername: joiningUser.epicUsername || '',
    isPremium:    !!joiningUser.isPremium,
    photoURL:     joiningUser.photoURL || '',
    isHost:       false,
    ready:        false,
    team:         2,
    teamId:       chosenTeamId,
    teamTag:      teamTag,
    isTeamCaptain:true,
    paidAmount:   joinerTotalDeposit,
    isCovered:    false,
  };

  const existingInvited = match.invitedTeammates || [];
  const combinedInvited = [...existingInvited, ...invitedTeammates];

  const updateFields = {
    players:                  firebase.firestore.FieldValue.arrayUnion(newPlayer),
    playerUids:               firebase.firestore.FieldValue.arrayUnion(joiningUser.uid),
    prizePool:                firebase.firestore.FieldValue.increment(joinerTotalDeposit),
    invitedTeammates:         combinedInvited,
    team2Id:                  chosenTeamId,
    team2Name:                teamName,
    team2Tag:                 teamTag,
    team2Icon:                teamIcon,
    team2IconColor:           teamIconColor,
    team2BgColor:             teamBgColor,
    team2BorderColor:         teamBorderColor,
    team2TokenCoverage:       tokenCoverage,
    team2CoveredMemberUids:   coveredMemberUids,
    team2SplitRule:           splitRule,
  };

  await matchDoc.ref.update(updateFields);

  if (joinerTotalDeposit > 0) {
    await updateTokens(
      joiningUser.uid,
      -joinerTotalDeposit,
      'match_wager',
      `Joined match with team — "${match.title}" (${match.code})${coveredCount > 0 ? ` (Covered ${coveredCount} teammate(s))` : ''}`
    );
  }

  // Send notifications to all invited Team 2 teammates
  if (invitedTeammates.length > 0) {
    for (const tm of invitedTeammates) {
      try {
        await db.collection('users').doc(tm.uid).collection('notifications').add({
          type: 'match_team_invite',
          title: 'Team Match Invite',
          body: `${joiningUser.displayName || 'Your Captain'} invited you to join team match "${match.title}" (${formatTokens(wager)} Tokens)${tm.isCovered ? ' · Entry Covered Free!' : ''}`,
          matchId: matchDoc.id,
          matchCode: match.code,
          matchTitle: match.title,
          wager: wager,
          hostName: joiningUser.displayName || 'Captain',
          hostUid: joiningUser.uid,
          teamName: teamName,
          team: 2,
          isCovered: !!tm.isCovered,
          read: false,
          accepted: false,
          declined: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      } catch (notifErr) {
        console.warn('Failed to send team invite notification to', tm.uid, notifErr);
      }
    }
  }

  return matchDoc.id;
}

/**
 * Teammate accepts a match team invite from the notification menu.
 */
async function acceptMatchTeamInvite(matchId, acceptingUser, notifId = null) {
  const matchRef = db.collection('matches').doc(matchId);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) throw new Error('Match not found or was removed');

  const match = matchSnap.data();
  if (match.status !== 'waiting') throw new Error('This match has already started or ended');

  // Check if 30-min timer expired
  if (match.expiresAt && match.expiresAt.toDate() < new Date()) {
    await expireMatch(matchId);
    throw new Error('This match has expired');
  }

  const players = match.players || [];
  if (players.length >= match.maxPlayers) throw new Error('This match is already full');
  if (players.some(p => p.uid === acceptingUser.uid)) {
    if (notifId) {
      await db.collection('users').doc(acceptingUser.uid).collection('notifications').doc(notifId).update({
        read: true,
        accepted: true,
      }).catch(() => {});
    }
    return { matchId, code: match.code };
  }

  const invitedEntry = (match.invitedTeammates || []).find(tm => tm.uid === acceptingUser.uid);
  if (invitedEntry) {
    const inviteTime = invitedEntry.invitedAt ? (invitedEntry.invitedAt.toDate ? invitedEntry.invitedAt.toDate().getTime() : (invitedEntry.invitedAt.seconds ? invitedEntry.invitedAt.seconds * 1000 : Number(invitedEntry.invitedAt))) : (match.createdAt ? (match.createdAt.toDate ? match.createdAt.toDate().getTime() : (match.createdAt.seconds ? match.createdAt.seconds * 1000 : 0)) : 0);
    if (inviteTime > 0 && (Date.now() - inviteTime > 5 * 60 * 1000)) {
      throw new Error('This match invite has expired (5 minute limit).');
    }
  }

  const targetTeam = invitedEntry?.team || (match.team2Id && match.team2Id === acceptingUser.teamId ? 2 : 1);
  const targetTeamTag = targetTeam === 1 ? (match.teamTag || '') : (match.team2Tag || acceptingUser.teamTag || '');
  const isCovered = !!(invitedEntry?.isCovered || (targetTeam === 1 && (match.coveredMemberUids || []).includes(acceptingUser.uid)) || (targetTeam === 2 && (match.team2CoveredMemberUids || []).includes(acceptingUser.uid)));

  const wager = Number(match.wager || 0);
  if (!isCovered && Number(acceptingUser.tokens || 0) < wager) {
    throw new Error(`Insufficient tokens (Requires ${formatTokens(wager)} Tokens to enter)`);
  }

  const newPlayer = {
    uid: acceptingUser.uid,
    displayName: acceptingUser.displayName || 'Teammate',
    epicUsername: acceptingUser.epicUsername || '',
    isPremium: !!acceptingUser.isPremium,
    photoURL: acceptingUser.photoURL || '',
    isHost: false,
    ready: false,
    team: targetTeam,
    teamId: acceptingUser.teamId || null,
    teamTag: targetTeamTag,
    paidAmount: isCovered ? 0 : wager,
    isCovered: isCovered,
    isTeammate: true,
  };

  // Update invitedTeammates status in match
  const updatedInvited = (match.invitedTeammates || []).map(tm => {
    if (tm.uid === acceptingUser.uid) {
      return { ...tm, status: 'accepted' };
    }
    return tm;
  });

  const updatePayload = {
    players: firebase.firestore.FieldValue.arrayUnion(newPlayer),
    playerUids: firebase.firestore.FieldValue.arrayUnion(acceptingUser.uid),
    invitedTeammates: updatedInvited,
  };
  if (!isCovered && wager > 0) {
    updatePayload.prizePool = firebase.firestore.FieldValue.increment(wager);
  }

  await matchRef.update(updatePayload);

  if (!isCovered && wager > 0) {
    await updateTokens(
      acceptingUser.uid,
      -wager,
      'match_wager',
      `Joined team match — "${match.title}" (${match.code})`
    );
  }

  // Mark notification read & accepted
  if (notifId) {
    await db.collection('users').doc(acceptingUser.uid).collection('notifications').doc(notifId).update({
      read: true,
      accepted: true,
      acceptedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {});
  }

  return { matchId, code: match.code };
}

/**
 * Teammate declines a match team invite.
 */
async function declineMatchTeamInvite(matchId, userUid, notifId = null) {
  try {
    const matchRef = db.collection('matches').doc(matchId);
    const matchSnap = await matchRef.get();
    if (matchSnap.exists) {
      const match = matchSnap.data();
      const updatedInvited = (match.invitedTeammates || []).map(tm => {
        if (tm.uid === userUid) {
          return { ...tm, status: 'declined' };
        }
        return tm;
      });
      await matchRef.update({ invitedTeammates: updatedInvited });
    }
  } catch (e) {
    console.warn('declineMatchTeamInvite match notice:', e);
  }

  if (notifId) {
    try {
      await db.collection('users').doc(userUid).collection('notifications').doc(notifId).update({
        read: true,
        declined: true,
      });
    } catch (e) {}
  }

  return true;
}

/**
 * Player toggles or sets Ready status in a match.
 * If all players are ready (or owner/admin starts test), match status automatically becomes 'in_progress'.
 */
async function setPlayerReady(matchId, uid, isReady = true) {
  const matchRef = db.collection('matches').doc(matchId);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) throw new Error('Match not found');

  const match = matchSnap.data();
  if (match.status !== 'waiting' && match.status !== 'ready') {
    throw new Error('Cannot change ready state once match has started or ended');
  }

  let updatedPlayers = (match.players || []).map(p => {
    if (p.uid === uid) {
      return { ...p, ready: isReady };
    }
    return p;
  });

  const allReady = (updatedPlayers.length === match.maxPlayers && updatedPlayers.every(p => p.ready));
  const newStatus = allReady ? 'in_progress' : 'waiting';

  await matchRef.update({
    players: updatedPlayers,
    status:  newStatus,
    ...(allReady ? { startedAt: firebase.firestore.FieldValue.serverTimestamp() } : {}),
  });

  // Automated System Announcements on match start
  if (allReady) {
    const hostPlayer = updatedPlayers.find(p => p.isHost || p.uid === match.createdBy) || updatedPlayers[0];
    const oppPlayer = updatedPlayers.find(p => p.uid !== hostPlayer?.uid) || updatedPlayers[1];
    const hostName = hostPlayer ? (hostPlayer.epicUsername || hostPlayer.displayName) : 'Host';
    const oppName  = oppPlayer ? (oppPlayer.epicUsername || oppPlayer.displayName) : 'Opponent';

    const msgRef = matchRef.collection('messages');
    await msgRef.add({
      isSystem:  true,
      text:      '⏰ Players have 10 minutes to queue into a game. If your opponent does not join within 10 minutes, click "Call Staff" to report and a moderator will resolve the situation.',
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    }).catch(console.warn);
    await msgRef.add({
      isSystem:  true,
      text:      `Team ${hostName} is host, so ${oppName} has to add them in Fortnite!`,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    }).catch(console.warn);
  }

  return { allReady, newStatus };
}

/**
 * Leave or cancel a match with full token refund.
 * - If Host leaves: cancels match & refunds everyone (including host covered deposits).
 * - If Joined player leaves: removes player, reduces prizePool, refunds player if they paid.
 */
async function leaveOrCancelMatch(matchId, uid) {
  const matchRef = db.collection('matches').doc(matchId);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) throw new Error('Match not found');

  const match = matchSnap.data();
  if (match.status !== 'waiting' && match.status !== 'ready') {
    throw new Error('Cannot leave or cancel a match that is already in progress or completed');
  }

  const isHost = match.createdBy === uid;
  const wager  = Number(match.wager);

  if (isHost) {
    // Cancel match and refund ALL players who paid tokens
    const refundPromises = (match.players || []).map(p => {
      const refundAmt = Number(p.paidAmount !== undefined ? p.paidAmount : (p.uid === match.createdBy ? (match.hostCoveredDeposit || wager) : wager));
      if (refundAmt > 0) {
        return updateTokens(p.uid, refundAmt, 'refund', `↩️ Match cancelled by host — "${match.title}" refund`);
      }
      return Promise.resolve();
    });
    await Promise.all(refundPromises);

    await matchRef.update({
      status:      'cancelled',
      completedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    return { action: 'cancelled', message: 'Match cancelled and your tokens were refunded.' };
  } else {
    // Non-host player leaving
    const leavingPlayer = (match.players || []).find(p => p.uid === uid);
    const updatedPlayers = (match.players || []).filter(p => p.uid !== uid);
    const updatedUids    = (match.playerUids || []).filter(u => u !== uid);
    const playerPaid = leavingPlayer?.paidAmount !== undefined ? Number(leavingPlayer.paidAmount) : (leavingPlayer?.isCovered ? 0 : wager);

    const updateFields = {
      players:    updatedPlayers,
      playerUids: updatedUids,
      status:     'waiting',
    };
    if (playerPaid > 0) {
      updateFields.prizePool = firebase.firestore.FieldValue.increment(-playerPaid);
    }

    await matchRef.update(updateFields);

    // Refund player if they paid tokens
    if (playerPaid > 0) {
      await updateTokens(uid, playerPaid, 'refund', `↩️ Left match — "${match.title}" refund`);
    }

    return { action: 'left', message: 'You left the match and your tokens were refunded.' };
  }
}

/**
 * Auto-expire waiting lobby after 30 minutes and issue 100% full refund to all players.
 * NEVER expires running, started, in_progress, disputed, or completed matches.
 */
async function expireMatch(matchId) {
  const matchRef = db.collection('matches').doc(matchId);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) return;

  const match = matchSnap.data();
  // ONLY expire lobbies that are waiting and never started!
  if (match.status !== 'waiting' || match.startedAt) return;

  const wager = Number(match.wager);
  const refundPromises = (match.players || []).map(p => {
    const refundAmt = Number(p.paidAmount !== undefined ? p.paidAmount : (p.uid === match.createdBy ? (match.hostCoveredDeposit || wager) : wager));
    if (refundAmt > 0) {
      return updateTokens(p.uid, refundAmt, 'refund', `⏱️ Lobby expired (30m wait limit) — "${match.title}" full refund`);
    }
    return Promise.resolve();
  });
  await Promise.all(refundPromises);

  await matchRef.update({
    status:      'cancelled',
    isExpired:   true,
    completedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  await matchRef.collection('messages').add({
    isSystem:  true,
    text:      '⏱️ LOBBY EXPIRED: The 30-minute waiting timer has elapsed. All participants have received a 100% full token refund.',
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  }).catch(console.warn);
}

/** Helper to calculate earnings distribution based on team split rule */
function calculateTeamPayouts(winningPlayers, totalPrize, match) {
  if (!winningPlayers || !winningPlayers.length) return [];
  const winningTeamNum = winningPlayers[0]?.team || 1;
  const splitRule = (winningTeamNum === 2 ? match.team2SplitRule : match.splitRule) || 'equal';
  const captain = winningPlayers.find(p => p.isHost || p.isTeamCaptain || (winningTeamNum === 1 && p.uid === match.createdBy)) || winningPlayers[0];
  const teammates = winningPlayers.filter(p => p.uid !== captain?.uid);

  const rawEach = Math.round((totalPrize / winningPlayers.length) * 100) / 100;

  if (splitRule === 'keep') {
    // Captain keeps the earnings of any covered teammates
    const coveredTeammates = teammates.filter(p => p.isCovered || (winningTeamNum === 1 && (match.tokenCoverage === 'all' || (match.tokenCoverage === '1' && p === teammates[0]) || (match.coveredMemberUids || []).includes(p.uid))) || (winningTeamNum === 2 && (match.team2TokenCoverage === 'all' || (match.team2CoveredMemberUids || []).includes(p.uid))));
    const uncoveredTeammates = teammates.filter(p => !coveredTeammates.includes(p));

    const captainTotalPrize = Math.round(rawEach * (1 + coveredTeammates.length) * 100) / 100;

    return [
      { uid: captain.uid, amount: captainTotalPrize },
      ...coveredTeammates.map(p => ({ uid: p.uid, amount: 0 })),
      ...uncoveredTeammates.map(p => ({ uid: p.uid, amount: rawEach }))
    ];
  }

  if (splitRule === 'captain_70') {
    const captainShare = Math.round(totalPrize * 0.70 * 100) / 100;
    const teamRemainder = Math.max(0, totalPrize - captainShare);
    const eachTeammate = teammates.length ? Math.round((teamRemainder / teammates.length) * 100) / 100 : 0;
    return [
      { uid: captain.uid, amount: captainShare },
      ...teammates.map(p => ({ uid: p.uid, amount: eachTeammate }))
    ];
  }

  // 'split' / 'equal' / default
  return winningPlayers.map(p => ({ uid: p.uid, amount: rawEach }));
}

/**
 * Subscribe to open (status=waiting) matches in real-time.
 * Filters out expired matches automatically.
 */
function subscribeOpenMatches(callback) {
  return db.collection('matches')
    .where('status', '==', 'waiting')
    .onSnapshot((snap) => {
      const now = Date.now();
      const list = [];

      snap.docs.forEach(d => {
        const data = d.data();
        const expTime = data.expiresAt ? data.expiresAt.toDate().getTime() : 0;

        if (expTime > 0 && expTime < now) {
          // Trigger expiration in background
          expireMatch(d.id).catch(console.warn);
        } else {
          list.push({ id: d.id, ...data });
        }
      });

      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      callback(list);
    }, (err) => {
      console.warn('subscribeOpenMatches error:', err);
      callback([]);
    });
}

/**
 * Subscribe to all matches a user is a player in.
 */
function subscribeUserMatches(uid, callback) {
  return db.collection('matches')
    .onSnapshot((snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const mine = all.filter(m => (m.playerUids || []).includes(uid) || m.createdBy === uid);
      mine.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      callback(mine);
    }, (err) => {
      console.warn('subscribeUserMatches error:', err);
      callback([]);
    });
}

/**
 * Declare a winner for a match. Host only.
 * Awards 90% of prize pool to winner (10% fee).
 * Blocked if match has expired past the 30-minute limit.
 */
async function declareWinner(matchId, winnerUid, hostUid) {
  const matchRef  = db.collection('matches').doc(matchId);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) throw new Error('Match not found');

  const match = matchSnap.data();
  if (match.status === 'completed') throw new Error('Match is already completed');
  if (match.status === 'cancelled') throw new Error('Match is cancelled');

  // Prevent win farming: match must be in_progress and have full players
  if (match.status !== 'in_progress' && match.status !== 'disputed') {
    throw new Error('Winner can only be declared after match has started with all players readied up');
  }

  const players = match.players || [];
  const maxPlayers = Number(match.maxPlayers || 2);
  if (players.length < maxPlayers) {
    throw new Error(`Cannot declare winner on an incomplete match (${players.length}/${maxPlayers} players)`);
  }

  // 5-Minute anti-win-farming check (unless platform admin)
  const MIN_MATCH_DURATION_MS = 5 * 60 * 1000;
  if (match.startedAt && !ADMIN_DISCORD_IDS.includes((hostUid || '').replace('discord:', ''))) {
    const startedTime = match.startedAt.toDate ? match.startedAt.toDate().getTime() : (match.startedAt.seconds ? match.startedAt.seconds * 1000 : Date.now());
    const elapsed = Date.now() - startedTime;
    if (elapsed < MIN_MATCH_DURATION_MS) {
      const remainingSec = Math.ceil((MIN_MATCH_DURATION_MS - elapsed) / 1000);
      const mins = Math.floor(remainingSec / 60);
      const secs = remainingSec % 60;
      throw new Error(`Please wait ${mins}:${secs < 10 ? '0' : ''}${secs}`);
    }
  }

  const winner = players.find(p => p.uid === winnerUid);
  if (!winner) throw new Error('Player not found in match');

  const rawPrize = Number(match.prizePool || 0) * 0.90; // 90% to winner
  const prize = Math.round(rawPrize * 100) / 100;

  await matchRef.update({
    status:      'completed',
    winner: { uid: winnerUid, displayName: winner.displayName },
    completedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  await updateTokens(winnerUid, prize, 'match_win', `Won match — "${match.title}"`);

  // Update stats for all players
  const statsUpdates = players.map(player => {
    const ref = db.collection('users').doc(player.uid);
    return ref.update({
      matchesPlayed: firebase.firestore.FieldValue.increment(1),
      ...(player.uid === winnerUid
        ? { matchesWon: firebase.firestore.FieldValue.increment(1) }
        : {}),
    });
  });
  await Promise.all(statsUpdates);

  return prize;
}

/**
 * Dual-Confirmation Match Score Submission Protocol
 * Both Team 1 and Team 2 must submit the match winner.
 * - If both agree: Winner is verified & paid instantly.
 * - If conflicting: Dispute triggered & Staff Moderator auto-called!
 * @param {string} matchId
 * @param {string} reporterUid
 * @param {string} reportedWinnerTeam - 'team1' | 'team2'
 */
async function submitMatchReport(matchId, reporterUid, reportedWinnerTeam) {
  const matchRef = db.collection('matches').doc(matchId);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) throw new Error('Match not found');

  const match = matchSnap.data();
  if (match.status === 'completed') {
    throw new Error('Match is already completed');
  }

  // 5-Minute anti-win-farming check
  const MIN_MATCH_DURATION_MS = 5 * 60 * 1000;
  if (match.startedAt) {
    const startedTime = match.startedAt.toDate ? match.startedAt.toDate().getTime() : (match.startedAt.seconds ? match.startedAt.seconds * 1000 : Date.now());
    const elapsed = Date.now() - startedTime;
    if (elapsed < MIN_MATCH_DURATION_MS) {
      const remainingSec = Math.ceil((MIN_MATCH_DURATION_MS - elapsed) / 1000);
      const mins = Math.floor(remainingSec / 60);
      const secs = remainingSec % 60;
      throw new Error(`Please wait ${mins}:${secs < 10 ? '0' : ''}${secs}`);
    }
  }

  const players = match.players || [];
  const reporterPlayer = players.find(p => p.uid === reporterUid);
  if (!reporterPlayer) throw new Error('You are not a participant in this match');

  const isTeam1 = reporterPlayer.team === 'team1' || reporterPlayer.isHost || reporterPlayer.uid === match.createdBy;
  const reporterTeamKey = isTeam1 ? 'team1' : 'team2';
  const reporterTeamName = isTeam1 ? 'Team 1 (Host)' : 'Team 2 (Enemy)';

  const updatePayload = {};
  if (isTeam1) {
    updatePayload.team1Reported = reportedWinnerTeam;
    updatePayload.team1ReportedBy = reporterUid;
    updatePayload.team1ReportedByName = reporterPlayer.displayName || 'Player';
    updatePayload.team1ReportedAt = firebase.firestore.FieldValue.serverTimestamp();
  } else {
    updatePayload.team2Reported = reportedWinnerTeam;
    updatePayload.team2ReportedBy = reporterUid;
    updatePayload.team2ReportedByName = reporterPlayer.displayName || 'Player';
    updatePayload.team2ReportedAt = firebase.firestore.FieldValue.serverTimestamp();
  }

  const currentTeam1Report = isTeam1 ? reportedWinnerTeam : match.team1Reported;
  const currentTeam2Report = isTeam1 ? match.team2Reported : reportedWinnerTeam;

  const msgRef = matchRef.collection('messages');

  // Both teams have reported
  if (currentTeam1Report && currentTeam2Report) {
    if (currentTeam1Report === currentTeam2Report) {
      // 🏆 CONSENSUS: BOTH SIDES AGREE ON WINNER!
      const winningTeam = currentTeam1Report;
      const isWinnerTeam1 = winningTeam === 'team1';

      const winningPlayers = players.filter(p => (p.team === 'team1' || p.isHost || p.uid === match.createdBy) === isWinnerTeam1);
      const losingPlayers  = players.filter(p => (p.team === 'team1' || p.isHost || p.uid === match.createdBy) !== isWinnerTeam1);

      const totalPool = Number(match.prizePool || (Number(match.wager) * players.length));
      const rawPrize = totalPool * 0.90; // 90% payout
      const payouts = calculateTeamPayouts(winningPlayers, rawPrize, match);

      updatePayload.status = 'completed';
      updatePayload.isDisputed = false;
      updatePayload.winnerTeam = winningTeam;
      updatePayload.winner = winningPlayers.length === 1 ? { uid: winningPlayers[0].uid, displayName: winningPlayers[0].displayName } : null;
      updatePayload.completedAt = firebase.firestore.FieldValue.serverTimestamp();

      await matchRef.update(updatePayload);

      // Distribute prize tokens according to team split rules
      for (const p of payouts) {
        if (p.amount > 0) {
          await updateTokens(p.uid, p.amount, 'match_win', `Won match — "${match.title}"`);
        }
      }

      // Update win/loss stats
      for (const p of winningPlayers) {
        await db.collection('users').doc(p.uid).update({
          matchesPlayed: firebase.firestore.FieldValue.increment(1),
          matchesWon:    firebase.firestore.FieldValue.increment(1),
        }).catch(console.warn);
      }
      for (const p of losingPlayers) {
        await db.collection('users').doc(p.uid).update({
          matchesPlayed: firebase.firestore.FieldValue.increment(1),
        }).catch(console.warn);
      }

      // System chat notice
      await msgRef.add({
        isSystem: true,
        text: `MATCH CONFIRMED: Both sides verified that ${winningTeam === "team1" ? "Team 1" : "Team 2"} won! Total prize of ${formatTokens(rawPrize)} Tokens has been paid out.`,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });

      return { status: 'completed', winningTeam, prize: rawPrize };

    } else {
      // ⚠️ CONFLICT / DISPUTE DETECTED!
      updatePayload.status = 'disputed';
      updatePayload.isDisputed = true;
      updatePayload.disputedAt = firebase.firestore.FieldValue.serverTimestamp();

      await matchRef.update(updatePayload);

      // AUTO-SUMMON STAFF MODERATOR
      await db.collection('staff_calls').add({
        matchId,
        matchCode: match.code || '',
        callerUid: 'system_auto_dispute',
        calledByName: 'System Auto-Dispute',
        reason: 'Match Result Dispute (Conflicting Winner Claims)',
        details: `Dispute triggered in match "${match.title}" (${match.code}). Team 1 claimed ${currentTeam1Report === 'team1' ? 'Team 1 Won' : 'Team 2 Won'} vs Team 2 claimed ${currentTeam2Report === 'team1' ? 'Team 1 Won' : 'Team 2 Won'}. Moderator auto-called to inspect match.`,
        status: 'open',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });

      // System chat notice
      await msgRef.add({
        isSystem: true,
        text: `DISPUTE DETECTED: Both sides reported conflicting match results! A Staff Moderator has been automatically called to review evidence and confirm the official winner.`,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });

      return { status: 'disputed' };
    }
  } else {
    // Only one side has reported so far
    await matchRef.update(updatePayload);

    await msgRef.add({
      isSystem: true,
      text: `${reporterTeamName} submitted score: ${reportedWinnerTeam === "team1" ? "Team 1 Won" : "Team 2 Won"}. Waiting for opponent to confirm…`,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });

    return { status: 'waiting_opponent' };
  }
}

/**
 * Retract / Undo a submitted match report
 * Allows a player to cancel or change their reported score if they made a mistake (e.g. accidentally clicked Lose).
 * @param {string} matchId
 * @param {string} reporterUid
 */
async function retractMatchReport(matchId, reporterUid) {
  const matchRef = db.collection('matches').doc(matchId);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) throw new Error('Match not found');

  const match = matchSnap.data();
  if (match.status === 'completed') {
    throw new Error('Cannot retract: Match is already completed and verified');
  }

  const players = match.players || [];
  const reporterPlayer = players.find(p => p.uid === reporterUid);
  if (!reporterPlayer) throw new Error('You are not a participant in this match');

  const isTeam1 = reporterPlayer.team === 'team1' || reporterPlayer.isHost || reporterPlayer.uid === match.createdBy;
  const reporterTeamName = isTeam1 ? 'Team 1 (Host)' : 'Team 2 (Enemy)';

  const updatePayload = {};
  if (isTeam1) {
    if (!match.team1Reported) throw new Error('No reported score to retract');
    updatePayload.team1Reported = firebase.firestore.FieldValue.delete();
    updatePayload.team1ReportedBy = firebase.firestore.FieldValue.delete();
    updatePayload.team1ReportedByName = firebase.firestore.FieldValue.delete();
    updatePayload.team1ReportedAt = firebase.firestore.FieldValue.delete();
  } else {
    if (!match.team2Reported) throw new Error('No reported score to retract');
    updatePayload.team2Reported = firebase.firestore.FieldValue.delete();
    updatePayload.team2ReportedBy = firebase.firestore.FieldValue.delete();
    updatePayload.team2ReportedByName = firebase.firestore.FieldValue.delete();
    updatePayload.team2ReportedAt = firebase.firestore.FieldValue.delete();
  }

  // If match was in disputed state, return it to in_progress
  if (match.status === 'disputed' || match.isDisputed) {
    updatePayload.status = 'in_progress';
    updatePayload.isDisputed = false;
    updatePayload.disputedAt = firebase.firestore.FieldValue.delete();
  }

  await matchRef.update(updatePayload);

  const msgRef = matchRef.collection('messages');
  await msgRef.add({
    isSystem: true,
    text: `↩️ ${reporterTeamName} retracted their reported score. Both teams can now vote again.`,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
}

/**
 * Staff manual resolution for disputed matches
 */
async function adminResolveDispute(matchId, winningTeam, adminUid) {
  const matchRef = db.collection('matches').doc(matchId);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) throw new Error('Match not found');

  const match = matchSnap.data();
  const players = match.players || [];
  const isWinnerTeam1 = winningTeam === 'team1';

  const winningPlayers = players.filter(p => (p.team === 'team1' || p.isHost || p.uid === match.createdBy) === isWinnerTeam1);
  const losingPlayers  = players.filter(p => (p.team === 'team1' || p.isHost || p.uid === match.createdBy) !== isWinnerTeam1);

  const totalPool = Number(match.prizePool || (Number(match.wager) * players.length));
  const rawPrize = totalPool * 0.90;
  const payouts = calculateTeamPayouts(winningPlayers, rawPrize, match);

  await matchRef.update({
    status: 'completed',
    isDisputed: false,
    winnerTeam: winningTeam,
    resolvedByAdmin: adminUid,
    winner: winningPlayers.length === 1 ? { uid: winningPlayers[0].uid, displayName: winningPlayers[0].displayName } : null,
    completedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  for (const p of payouts) {
    if (p.amount > 0) {
      await updateTokens(p.uid, p.amount, 'match_win', `Won match (Staff Decision) — "${match.title}"`);
    }
  }
  for (const p of winningPlayers) {
    await db.collection('users').doc(p.uid).update({
      matchesPlayed: firebase.firestore.FieldValue.increment(1),
      matchesWon:    firebase.firestore.FieldValue.increment(1),
    }).catch(console.warn);
  }
  for (const p of losingPlayers) {
    await db.collection('users').doc(p.uid).update({
      matchesPlayed: firebase.firestore.FieldValue.increment(1),
    }).catch(console.warn);
  }

  await matchRef.collection('messages').add({
    isSystem: true,
    text: `STAFF RULING: Staff Moderator resolved the dispute in favor of ${winningTeam === "team1" ? "Team 1" : "Team 2"}! ${formatTokens(rawPrize)} Tokens awarded.`,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  });

  return rawPrize;
}

/**
 * Handles voting for Rematch or Double Down after match completion.
 * Checks player token balances, logs chat vote progress, and starts the rematch when all players agree.
 * @param {string} matchId
 * @param {string} uid
 * @param {'rematch'|'double'} voteType
 */
async function voteMatchRematch(matchId, uid, voteType = 'rematch') {
  const matchRef = db.collection('matches').doc(matchId);
  const snap = await matchRef.get();
  if (!snap.exists) throw new Error('Match not found');
  const match = snap.data();

  if (match.status !== 'completed') {
    throw new Error('Rematch voting is only available for completed matches');
  }

  const players = match.players || [];
  const player = players.find(p => p.uid === uid);
  if (!player) throw new Error('You are not a participant in this match');

  const currentWager = Number(match.wager || 1.00);
  const requiredTokens = voteType === 'double' ? currentWager * 2 : currentWager;

  // Check user balance
  const userSnap = await db.collection('users').doc(uid).get();
  const userTokens = Number(userSnap.data()?.tokens || 0);
  if (userTokens < requiredTokens) {
    throw new Error(`Insufficient tokens to ${voteType === 'double' ? 'double down' : 'rematch'} (Need ${formatTokens(requiredTokens)} Tokens, You have ${formatTokens(userTokens)} Tokens)`);
  }

  const REMATCH_EXPIRATION_MS = 90 * 1000; // 1 min 30 seconds
  const now = Date.now();
  const voteTime = match.rematchVotesUpdatedAt ? (match.rematchVotesUpdatedAt.toDate ? match.rematchVotesUpdatedAt.toDate().getTime() : (match.rematchVotesUpdatedAt.seconds ? match.rematchVotesUpdatedAt.seconds * 1000 : 0)) : 0;

  let rematchVotes = Array.isArray(match.rematchVotes) ? [...match.rematchVotes] : [];
  let doubleVotes  = Array.isArray(match.doubleVotes)  ? [...match.doubleVotes]  : [];

  // Reset if existing votes have expired (> 90 seconds)
  if (voteTime > 0 && (now - voteTime > REMATCH_EXPIRATION_MS)) {
    rematchVotes = [];
    doubleVotes = [];
  }

  const totalPlayers = match.maxPlayers || players.length || 2;
  const playerName = player.displayName || 'Player';

  // Toggle/Cancel: If user clicks the button they already voted for, CANCEL the vote
  if (voteType === 'rematch' && rematchVotes.includes(uid)) {
    rematchVotes = rematchVotes.filter(id => id !== uid);
    await matchRef.update({
      rematchVotes,
      rematchVotesUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await matchRef.collection('messages').add({
      isSystem: true,
      text: `${playerName} cancelled their Rematch vote`,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return { started: false, cancelled: true, voteType: 'rematch', votes: rematchVotes.length, total: totalPlayers };
  }

  if (voteType === 'double' && doubleVotes.includes(uid)) {
    doubleVotes = doubleVotes.filter(id => id !== uid);
    await matchRef.update({
      doubleVotes,
      rematchVotesUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await matchRef.collection('messages').add({
      isSystem: true,
      text: `${playerName} cancelled their Double vote`,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return { started: false, cancelled: true, voteType: 'double', votes: doubleVotes.length, total: totalPlayers };
  }

  // Cast new vote or switch vote
  if (voteType === 'rematch') {
    if (!rematchVotes.includes(uid)) rematchVotes.push(uid);
    doubleVotes = doubleVotes.filter(id => id !== uid);
  } else {
    if (!doubleVotes.includes(uid)) doubleVotes.push(uid);
    rematchVotes = rematchVotes.filter(id => id !== uid);
  }

  const currentVotes = voteType === 'rematch' ? rematchVotes : doubleVotes;

  // Cast vote announcement to chat
  await matchRef.collection('messages').add({
    isSystem: true,
    text: `${playerName} voted to ${voteType === 'double' ? 'DOUBLE' : 'REMATCH'} ${currentVotes.length}/${totalPlayers}`,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  });

  // Check if all players agreed
  if (currentVotes.length >= totalPlayers) {
    const newWager = voteType === 'double' ? currentWager * 2 : currentWager;
    const newPrizePool = newWager * totalPlayers;

    // Check balances for all participants
    for (const p of players) {
      const pSnap = await db.collection('users').doc(p.uid).get();
      const pBal = Number(pSnap.data()?.tokens || 0);
      if (pBal < newWager) {
        throw new Error(`${p.displayName || 'A player'} does not have sufficient tokens (${formatTokens(newWager)} Tokens required)`);
      }
    }

    // Deduct entry fee from each player
    for (const p of players) {
      await updateTokens(p.uid, -newWager, 'match_wager', `${voteType === "double" ? "Double Down Entry" : "Rematch Entry"} — ${match.title || "Arena Match"}`);
    }

    // Reset match state
    await matchRef.update({
      wager: newWager,
      prizePool: newPrizePool,
      status: 'in_progress',
      team1Reported: null,
      team2Reported: null,
      team1ReportedBy: null,
      team2ReportedBy: null,
      team1ReportedByName: null,
      team2ReportedByName: null,
      team1ReportedAt: null,
      team2ReportedAt: null,
      winner: null,
      winnerTeam: null,
      isDisputed: false,
      disputedAt: null,
      rematchVotes: [],
      doubleVotes: [],
      rematchVotesUpdatedAt: null,
      startedAt: firebase.firestore.FieldValue.serverTimestamp(),
      completedAt: null,
    });

    // Announce rematch start in chat
    await matchRef.collection('messages').add({
      isSystem: true,
      text: `REMATCH STARTED: All players confirmed! Entry: ${formatTokens(newWager)} Tokens · Total Prize: ${formatTokens(newPrizePool * 0.90)} Tokens. Good luck!`,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });

    return { started: true, voteType, newWager };
  } else {
    await matchRef.update({
      rematchVotes,
      doubleVotes,
      rematchVotesUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return { started: false, voteType, votes: currentVotes.length, total: totalPlayers };
  }
}

// ── Leaderboard ──────────────────────────────────────────────

/** Fetch real users ordered by matchesWon DESC, then totalEarned DESC */
async function getLeaderboard() {
  const snap = await db.collection('users').get();
  const users = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(u => {
      if (u.isGuest === true || u.id.startsWith('guest_') || u.uid?.startsWith('guest_')) return false;
      const name = (u.displayName || '').toLowerCase();
      if (name.includes('guest') || name.includes('tester') || name.startsWith('guest #') || name.startsWith('guest-')) return false;
      return true;
    });

  users.sort((a, b) => {
    const winsDiff = (Number(b.matchesWon) || 0) - (Number(a.matchesWon) || 0);
    if (winsDiff !== 0) return winsDiff;
    return (Number(b.totalEarned) || 0) - (Number(a.totalEarned) || 0);
  });

  return users;
}

/** Calculate user rank on the leaderboard */
async function getUserLeaderboardRank(uid) {
  try {
    const users = await getLeaderboard();
    const index = users.findIndex(u => (u.id === uid || u.uid === uid));
    if (index === -1) {
      return { rank: null, display: '#--', badgeClass: 'rank-badge-normal' };
    }
    const rank = index + 1;
    const badgeClass = rank === 1 ? 'rank-badge-1' : (rank <= 3 ? 'rank-badge-top' : 'rank-badge-normal');
    return { rank, display: `#${rank}`, badgeClass };
  } catch (e) {
    return { rank: null, display: '#--', badgeClass: 'rank-badge-normal' };
  }
}

// ── Transactions ─────────────────────────────────────────────

/** Fetch last N transactions for a user */
async function getUserTransactions(uid, limitCount = 15) {
  const snap = await db.collection('transactions')
    .where('userId', '==', uid)
    .get();
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
  return list.slice(0, limitCount);
}

// ── Teams (for 2v2 & 3v3) ────────────────────────────────────

/** Generate a random 5-character team invite code */
function generateTeamCode() {
  return 'TM-' + Math.random().toString(36).substr(2, 5).toUpperCase();
}

/**
 * Profanity & Inappropriate Words Filter
 */
const PROFANITY_BLOCKLIST = [
  'nigger', 'nigga', 'faggot', 'fag', 'cunt', 'whore', 'slut', 'bitch',
  'kike', 'chink', 'spic', 'retard', 'tranny', 'pedophile', 'pedo',
  'hitler', 'nazi', 'kkk', 'rape', 'rapist', 'terrorist', 'isis',
  'pussy', 'dick', 'cock', 'penis', 'vagina', 'asshole', 'bastard',
  'motherfucker', 'fuck', 'shit', 'kill yourself', 'kys', 'porn', 'sex'
];

function isProfane(text) {
  if (!text) return false;
  let clean = text.toLowerCase()
    .replace(/@/g, 'a')
    .replace(/0/g, 'o')
    .replace(/1|!|\|/g, 'i')
    .replace(/3/g, 'e')
    .replace(/5|\$/g, 's')
    .replace(/7/g, 't')
    .replace(/8/g, 'b')
    .replace(/[^a-z0-9]/g, '');

  for (const word of PROFANITY_BLOCKLIST) {
    const cleanWord = word.replace(/[^a-z0-9]/g, '');
    if (clean.includes(cleanWord)) {
      return true;
    }
  }
  return false;
}

/** Create a new team */
async function createTeam(user, { name, tag, icon, iconColor, bgColor, borderColor }) {
  if (!name || !name.trim()) throw new Error('Team name is required');
  const trimmedName = name.trim();
  const cleanTag = (tag || name.substring(0, 4)).toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
  
  if (isProfane(trimmedName) || isProfane(cleanTag)) {
    throw new Error('Team name or tag contains inappropriate words. Please choose another.');
  }

  const code = generateTeamCode();

  const leader = {
    uid:         user.uid,
    displayName: user.displayName || 'Leader',
    photoURL:    user.photoURL || '',
    isLeader:    true,
  };

  const teamIcon = icon || 'shield';
  const teamIconColor = iconColor || '#f59e0b';
  const teamBgColor = bgColor || 'rgba(245, 158, 11, 0.18)';
  const teamBorderColor = borderColor || 'rgba(245, 158, 11, 0.45)';

  const teamRef = await db.collection('teams').add({
    name:              trimmedName,
    tag:               cleanTag,
    code,
    icon:              teamIcon,
    iconColor:         teamIconColor,
    bgColor:           teamBgColor,
    borderColor:       teamBorderColor,
    ownerUid:          user.uid,
    ownerName:         user.displayName || 'Leader',
    members:           [leader],
    memberUids:        [user.uid],
    wagerCoverage:     'none',
    coveredMemberUids: [],
    splitRule:         'equal',
    createdAt:         firebase.firestore.FieldValue.serverTimestamp(),
  });

  // Link active team to user document
  await db.collection('users').doc(user.uid).update({
    teamId:   teamRef.id,
    teamName: trimmedName,
    teamTag:  cleanTag,
  });

  return { 
    id: teamRef.id, 
    code, 
    name: trimmedName, 
    tag: cleanTag,
    icon: teamIcon,
    iconColor: teamIconColor,
    bgColor: teamBgColor,
    borderColor: teamBorderColor
  };
}

/** Fetch all teams a user belongs to or owns */
async function getUserTeams(uid) {
  const teams = [];
  const seen = new Set();
  try {
    const snap = await db.collection('teams').where('memberUids', 'array-contains', uid).get();
    snap.docs.forEach(doc => {
      if (!seen.has(doc.id)) {
        seen.add(doc.id);
        teams.push({ id: doc.id, ...doc.data() });
      }
    });
    const ownerSnap = await db.collection('teams').where('ownerUid', '==', uid).get();
    ownerSnap.docs.forEach(doc => {
      if (!seen.has(doc.id)) {
        seen.add(doc.id);
        teams.push({ id: doc.id, ...doc.data() });
      }
    });
  } catch (e) {
    console.warn('getUserTeams notice:', e.message);
  }
  return teams;
}

/** Fetch a user's current active team */
async function getUserTeam(uid) {
  try {
    const user = await getUser(uid);
    if (!user) return null;
    if (user.teamId) {
      const snap = await db.collection('teams').doc(user.teamId).get();
      if (snap.exists) return { id: snap.id, ...snap.data() };
    }
    // Fallback search
    const snap = await db.collection('teams').where('memberUids', 'array-contains', uid).limit(1).get();
    if (!snap.empty) {
      return { id: snap.docs[0].id, ...snap.docs[0].data() };
    }
  } catch (e) {
    console.warn('getUserTeam fallback notice:', e.message);
  }
  return null;
}

/** Update team wager coverage and earnings split settings */
async function updateTeamSettings(teamId, settings) {
  const teamRef = db.collection('teams').doc(teamId);
  await teamRef.update({
    wagerCoverage:     settings.wagerCoverage || 'none', // 'none' | 'all' | 'custom'
    coveredMemberUids: settings.coveredMemberUids || [],
    splitRule:         settings.splitRule || 'equal',     // 'equal' | 'captain_first' | 'captain_70'
    updatedAt:         firebase.firestore.FieldValue.serverTimestamp(),
  });
}

/** Set user active team */
async function setActiveTeam(uid, team) {
  await db.collection('users').doc(uid).update({
    teamId:   team.id,
    teamName: team.name,
    teamTag:  team.tag,
  });
}

/** Join a team using invite code */
async function joinTeamByCode(code, user) {
  const cleanCode = code.trim().toUpperCase();
  const snap = await db.collection('teams').where('code', '==', cleanCode).limit(1).get();
  if (snap.empty) throw new Error('Team invite code not found');

  const teamDoc = snap.docs[0];
  const team = teamDoc.data();

  if (team.members && team.members.length >= 6) {
    throw new Error('This team is already at max roster capacity (6 players)');
  }
  if (team.members && team.members.some(m => m.uid === user.uid)) {
    // Already on team, switch active
    await setActiveTeam(user.uid, { id: teamDoc.id, name: team.name, tag: team.tag });
    return { id: teamDoc.id, name: team.name, tag: team.tag, code: team.code };
  }

  const newMember = {
    uid:         user.uid,
    displayName: user.displayName || 'Champion',
    photoURL:    user.photoURL || '',
    isLeader:    false,
  };

  await teamDoc.ref.update({
    members:    firebase.firestore.FieldValue.arrayUnion(newMember),
    memberUids: firebase.firestore.FieldValue.arrayUnion(user.uid),
  });

  await db.collection('users').doc(user.uid).update({
    teamId:   teamDoc.id,
    teamName: team.name,
    teamTag:  team.tag,
  });

  return { id: teamDoc.id, name: team.name, tag: team.tag, code: team.code };
}

/** Leave or disband team */
async function leaveTeam(teamId, uid) {
  const teamRef = db.collection('teams').doc(teamId);
  const snap = await teamRef.get();
  if (!snap.exists) return;

  const team = snap.data();
  const isOwner = team.ownerUid === uid;

  if (isOwner || (team.members && team.members.length <= 1)) {
    // Delete team and unlink members
    for (const m of team.members || []) {
      await db.collection('users').doc(m.uid).update({
        teamId:   firebase.firestore.FieldValue.delete(),
        teamName: firebase.firestore.FieldValue.delete(),
        teamTag:  firebase.firestore.FieldValue.delete(),
      }).catch(() => {});
    }
    await teamRef.delete();
    return { action: 'disbanded' };
  } else {
    // Remove member
    const updatedMembers = (team.members || []).filter(m => m.uid !== uid);
    const updatedUids    = (team.memberUids || []).filter(u => u !== uid);

    await teamRef.update({
      members:    updatedMembers,
      memberUids: updatedUids,
    });

    const u = await getUser(uid);
    if (u?.teamId === teamId) {
      await db.collection('users').doc(uid).update({
        teamId:   firebase.firestore.FieldValue.delete(),
        teamName: firebase.firestore.FieldValue.delete(),
        teamTag:  firebase.firestore.FieldValue.delete(),
      }).catch(() => {});
    }
    return { action: 'left' };
  }
}

// ── Epic Games Linking handled in linkEpicAccount / syncEpicAccountName below ──

// ── Admin Actions ────────────────────────────────────────────

/** Mark a staff call as resolved */
async function resolveStaffCall(callId, adminName, resolutionNotes = '') {
  await db.collection('staff_calls').doc(callId).update({
    status:          'resolved',
    resolvedBy:      adminName,
    resolutionNotes: resolutionNotes.trim(),
    resolvedAt:      firebase.firestore.FieldValue.serverTimestamp(),
  });
}

/** Admin grant or deduct tokens to any user (Resolves by raw UID, Discord ID, or Username) */
async function adminAdjustTokens(identifier, amount, reason) {
  const num = Number(amount);
  if (isNaN(num)) throw new Error('Invalid token amount');

  const raw = identifier.trim().replace(/^@/, '');
  let targetUid = raw;

  // Check if doc exists with raw input
  let userSnap = await db.collection('users').doc(raw).get();

  // If not, check with discord: prefix
  if (!userSnap.exists) {
    const withPrefix = `discord:${raw.replace('discord:', '')}`;
    userSnap = await db.collection('users').doc(withPrefix).get();
    if (userSnap.exists) {
      targetUid = withPrefix;
    }
  }

  // If still not, search by discordUsername or displayName
  if (!userSnap.exists) {
    const byUsername = await db.collection('users').where('discordUsername', '==', raw).limit(1).get();
    if (!byUsername.empty) {
      targetUid = byUsername.docs[0].id;
      userSnap = byUsername.docs[0];
    } else {
      const byDisplayName = await db.collection('users').where('displayName', '==', raw).limit(1).get();
      if (!byDisplayName.empty) {
        targetUid = byDisplayName.docs[0].id;
        userSnap = byDisplayName.docs[0];
      }
    }
  }

  if (!userSnap.exists) {
    throw new Error(`User not found for identifier "${identifier}". Please enter a valid Discord ID, UID, or Username.`);
  }

  await updateTokens(targetUid, num, 'admin', `Admin adjustment: ${reason}`);
  return { targetUid, userName: userSnap.data()?.displayName || targetUid };
}

/** Admin force cancel a match and refund players */
async function adminForceCancelMatch(matchId, adminName) {
  const matchRef = db.collection('matches').doc(matchId);
  const snap = await matchRef.get();
  if (!snap.exists) throw new Error('Match not found');

  const match = snap.data();
  const wager = Number(match.wager || 0);

  if (match.players && match.players.length > 0) {
    const refundPromises = match.players.map(p =>
      updateTokens(p.uid, wager, 'refund', `Admin (${adminName}) cancelled match — "${match.title}" refund`)
    );
    await Promise.all(refundPromises);
  }

  await matchRef.update({
    status:      'cancelled',
    cancelledBy: adminName,
    completedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

// ── Premium Pass & Player Tipping ────────────────────────────

/** Purchase Champion Premium (Cost: 5.00 Tokens) */
async function buyPremiumPass(uid) {
  const user = await getUser(uid);
  if (!user) throw new Error('User not found');

  if (user.isPremium && user.premiumExpiresAt && user.premiumExpiresAt.toDate() > new Date()) {
    throw new Error('You already have an active Champion Premium subscription!');
  }

  if (Number(user.tokens || 0) < 5.00) {
    throw new Error('Insufficient tokens. Premium costs 5.00 Tokens ($5.00).');
  }

  // Deduct 5.00 tokens
  await updateTokens(uid, -5.00, 'shop', 'Purchased Champion Premium (30 Days)');

  const expiresDate = new Date();
  expiresDate.setDate(expiresDate.getDate() + 30);

  await db.collection('users').doc(uid).update({
    isPremium:        true,
    premiumExpiresAt: firebase.firestore.Timestamp.fromDate(expiresDate),
  });

  return true;
}

/** Auto-refund duplicate premium purchases if user bought it multiple times */
async function autoRefundDuplicatePremium(uid) {
  try {
    const snap = await db.collection('transactions')
      .where('userId', '==', uid)
      .where('type', '==', 'shop')
      .get();
    
    const premiumPurchases = snap.docs.filter(d => {
      const desc = d.data().description || '';
      return desc.includes('Premium Pass') || desc.includes('Champion Premium');
    });

    if (premiumPurchases.length > 1) {
      const refundCheckSnap = await db.collection('transactions')
        .where('userId', '==', uid)
        .where('type', '==', 'refund_premium_duplicates')
        .limit(1)
        .get();

      if (refundCheckSnap.empty) {
        const excessCount = premiumPurchases.length - 1;
        const refundAmount = excessCount * 5.00;
        await updateTokens(
          uid,
          refundAmount,
          'refund_premium_duplicates',
          `↩️ Refunded ${refundAmount.toFixed(2)} Tokens for ${excessCount} duplicate Premium purchase(s)`
        );
      }
    }
  } catch (e) {
    console.warn('autoRefundDuplicatePremium notice:', e);
  }
}

/** Tip tokens to another player */
async function tipPlayer(senderUid, receiverUid, amount) {
  const num = Math.round(Number(amount) * 100) / 100;
  if (isNaN(num) || num < 0.10) {
    throw new Error('Minimum tip amount is 0.10 Tokens');
  }
  if (senderUid === receiverUid) {
    throw new Error('You cannot tip yourself');
  }

  const sender = await getUser(senderUid);
  if (!sender) throw new Error('Sender user not found');
  if (Number(sender.tokens || 0) < num) {
    throw new Error(`Insufficient tokens (Need ${formatTokens(num)} Tokens)`);
  }

  const receiver = await getUser(receiverUid);
  if (!receiver) throw new Error('Recipient user not found');

  // Deduct from sender
  await updateTokens(
    senderUid,
    -num,
    'tip_sent',
    `Tipped ${formatTokens(num)} Tokens to @${receiver.discordUsername || receiver.displayName}`
  );

  // Credit to receiver
  await updateTokens(
    receiverUid,
    num,
    'tip_received',
    `Received ${formatTokens(num)} Tokens tip from @${sender.discordUsername || sender.displayName}`
  );

  return { sender, receiver, amount: num };
}

/**
 * Link connected Epic Games account to user profile.
 * Strictly enforces 1-to-1 linking: no two accounts can share the same Epic account/username.
 */
async function linkEpicAccount(uid, epicUsername, epicAccountId = '') {
  if (!uid) throw new Error('User ID is required');
  const cleanName = (epicUsername || '').trim();
  const cleanId = (epicAccountId || '').trim();
  if (!cleanName || cleanName.length < 2) {
    throw new Error('Please enter a valid Epic Games / Fortnite username');
  }

  // 1. Check if another account already has this epicAccountId linked
  if (cleanId) {
    const idSnap = await db.collection('users')
      .where('epicAccountId', '==', cleanId)
      .limit(5)
      .get();
    const conflict = idSnap.docs.find(d => d.id !== uid);
    if (conflict) {
      const conflictName = conflict.data()?.displayName || conflict.data()?.epicUsername || 'another user';
      throw new Error(`This Epic Games account is already linked to @${conflictName}. It must be unlinked from that account first.`);
    }
  }

  // 2. Check if another account already has this exact epicUsername linked (case-insensitive check)
  const lowerName = cleanName.toLowerCase();
  const nameSnap = await db.collection('users')
    .where('epicUsername_lower', '==', lowerName)
    .limit(5)
    .get();
  let conflictUser = nameSnap.docs.find(d => d.id !== uid);
  
  if (!conflictUser) {
    const rawSnap = await db.collection('users')
      .where('epicUsername', '==', cleanName)
      .limit(5)
      .get();
    conflictUser = rawSnap.docs.find(d => d.id !== uid);
  }

  if (conflictUser) {
    const conflictName = conflictUser.data()?.displayName || conflictUser.data()?.epicUsername || 'another user';
    throw new Error(`The Epic Games username "${cleanName}" is already linked to @${conflictName}. It must be unlinked from that account first.`);
  }

  // Safe to link!
  const userRef = db.collection('users').doc(uid);
  await userRef.set({
    epicUsername:       cleanName,
    epicUsername_lower: lowerName,
    epicAccountId:      cleanId,
    epicVerified:       true,
    epicLinkedAt:       firebase.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return { success: true, epicUsername: cleanName };
}

/**
 * Sync / verify connected Epic Games account.
 */
async function syncEpicAccountName(uid) {
  if (!uid) throw new Error('User ID is required');
  const user = await getUser(uid);
  if (!user || !user.epicUsername) {
    throw new Error('No verified Epic Games account found to sync. Link your Epic account first.');
  }

  await db.collection('users').doc(uid).set({
    epicVerified:       true,
    epicLastSynced:     firebase.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return { success: true, epicUsername: user.epicUsername };
}

/**
 * Unlink connected Epic Games account from user profile.
 * Deducts 2.00 Tokens unlinking fee. Frees the Epic account for future linking.
 */
async function unlinkEpicAccount(uid) {
  const user = await getUser(uid);
  if (!user) throw new Error('User not found');
  if (!user.epicUsername && !user.epicAccountId) {
    throw new Error('No Epic Games account is currently linked');
  }

  if (Number(user.tokens || 0) < 2.00) {
    throw new Error('Unlinking requires 2.00 Tokens ($2.00). Please add tokens to your balance.');
  }

  await updateTokens(
    uid,
    -2.00,
    'epic_unlink_fee',
    'Unlinked Epic Games account (-2.00 Tokens fee)'
  );

  const userRef = db.collection('users').doc(uid);
  await userRef.update({
    epicUsername:       firebase.firestore.FieldValue.delete(),
    epicUsername_lower: firebase.firestore.FieldValue.delete(),
    epicAccountId:      firebase.firestore.FieldValue.delete(),
    epicVerified:       false,
    epicUnlinkedAt:     firebase.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
}

/**
 * Link social media account (Twitch or X).
 */
async function linkSocialAccount(uid, platform, handle) {
  if (!uid) throw new Error('User ID is required');
  let cleanHandle = (handle || '').trim();
  cleanHandle = cleanHandle.replace(/^https?:\/\/(www\.)?(twitch\.tv\/|x\.com\/|twitter\.com\/)/i, '');
  cleanHandle = cleanHandle.replace(/^@+/, '').trim();

  if (!cleanHandle || cleanHandle.length < 1) {
    throw new Error(`Please enter a valid ${platform === 'twitch' ? 'Twitch' : 'X'} username`);
  }

  const userRef = db.collection('users').doc(uid);
  const updateData = {};
  if (platform === 'twitch') {
    updateData.twitchUsername = cleanHandle;
    updateData.twitchLinkedAt = firebase.firestore.FieldValue.serverTimestamp();
  } else if (platform === 'x' || platform === 'twitter') {
    updateData.xUsername = cleanHandle;
    updateData.xLinkedAt = firebase.firestore.FieldValue.serverTimestamp();
  } else {
    throw new Error('Unsupported platform');
  }

  await userRef.set(updateData, { merge: true });
  return { success: true, handle: cleanHandle };
}

/**
 * Unlink social media account (Twitch or X).
 */
async function unlinkSocialAccount(uid, platform) {
  if (!uid) throw new Error('User ID is required');
  const userRef = db.collection('users').doc(uid);
  const updateData = {};
  if (platform === 'twitch') {
    updateData.twitchUsername = firebase.firestore.FieldValue.delete();
    updateData.twitchLinkedAt = firebase.firestore.FieldValue.delete();
  } else if (platform === 'x' || platform === 'twitter') {
    updateData.xUsername = firebase.firestore.FieldValue.delete();
    updateData.xLinkedAt = firebase.firestore.FieldValue.delete();
  } else {
    throw new Error('Unsupported platform');
  }

  await userRef.update(updateData);
  return { success: true };
}

// ── Avatars & Cosmetics Shop Catalog ────────────────────────

const DEFAULT_STARTER_PFP_ID = 'pfp_uncommon_1';
const DEFAULT_STARTER_PFP_URL = 'cosmetics/uncomon/uncomon.png';

const SHOP_PFPS = {
  // Uncommon — 1.00 Token
  'pfp_uncommon_1': { id: 'pfp_uncommon_1', name: '#1',  rarity: 'Uncommon', cost: 1.00, file: 'cosmetics/uncomon/uncomon.png', isDefault: true, color: '#10b981' },
  'pfp_uncommon_2': { id: 'pfp_uncommon_2', name: '#2',  rarity: 'Uncommon', cost: 1.00, file: 'cosmetics/uncomon/uncomobn.png', color: '#10b981' },
  'pfp_uncommon_3': { id: 'pfp_uncommon_3', name: '#3',  rarity: 'Uncommon', cost: 1.00, file: 'cosmetics/uncomon/uncomok.png', color: '#10b981' },
  'pfp_uncommon_4': { id: 'pfp_uncommon_4', name: '#4',  rarity: 'Uncommon', cost: 1.00, file: 'cosmetics/uncomon/uncomokda.png', color: '#10b981' },
  'pfp_uncommon_5': { id: 'pfp_uncommon_5', name: '#5',  rarity: 'Uncommon', cost: 1.00, file: 'cosmetics/uncomon/uncomokik.png', color: '#10b981' },
  'pfp_uncommon_6': { id: 'pfp_uncommon_6', name: '#6',  rarity: 'Uncommon', cost: 1.00, file: 'cosmetics/uncomon/uncomon1311111.png', color: '#10b981' },
  'pfp_uncommon_7': { id: 'pfp_uncommon_7', name: '#7',  rarity: 'Uncommon', cost: 1.00, file: 'cosmetics/uncomon/uncomonk.png', color: '#10b981' },

  // Rare — 1.75 Tokens
  'pfp_rare_1': { id: 'pfp_rare_1', name: '#8',  rarity: 'Rare', cost: 1.75, file: 'cosmetics/rare/rare too.png', color: '#3b82f6' },
  'pfp_rare_2': { id: 'pfp_rare_2', name: '#9',  rarity: 'Rare', cost: 1.75, file: 'cosmetics/rare/rare.png', color: '#3b82f6' },
  'pfp_rare_3': { id: 'pfp_rare_3', name: '#10', rarity: 'Rare', cost: 1.75, file: 'cosmetics/rare/rare23487.png', color: '#3b82f6' },
  'pfp_rare_4': { id: 'pfp_rare_4', name: '#11', rarity: 'Rare', cost: 1.75, file: 'cosmetics/rare/rarepussy.png', color: '#3b82f6' },
  'pfp_rare_5': { id: 'pfp_rare_5', name: '#12', rarity: 'Rare', cost: 1.75, file: 'cosmetics/rare/rarewee.png', color: '#3b82f6' },
  'pfp_rare_6': { id: 'pfp_rare_6', name: '#13', rarity: 'Rare', cost: 1.75, file: 'cosmetics/rare/rareyhyh.png', color: '#3b82f6' },
  'pfp_rare_7': { id: 'pfp_rare_7', name: '#14', rarity: 'Rare', cost: 1.75, file: 'cosmetics/rare/raré.png', color: '#3b82f6' },

  // Epic — 2.25 Tokens
  'pfp_epic_1': { id: 'pfp_epic_1', name: '#15', rarity: 'Epic', cost: 2.25, file: 'cosmetics/epic/epickidadddwq.png', color: '#a855f7' },
  'pfp_epic_2': { id: 'pfp_epic_2', name: '#16', rarity: 'Epic', cost: 2.25, file: 'cosmetics/epic/apikcica.png', color: '#a855f7' },
  'pfp_epic_3': { id: 'pfp_epic_3', name: '#17', rarity: 'Epic', cost: 2.25, file: 'cosmetics/epic/babyrare.png', color: '#a855f7' },
  'pfp_epic_4': { id: 'pfp_epic_4', name: '#18', rarity: 'Epic', cost: 2.25, file: 'cosmetics/epic/dddqjp9qdhp.png', color: '#a855f7' },
  'pfp_epic_5': { id: 'pfp_epic_5', name: '#19', rarity: 'Epic', cost: 2.25, file: 'cosmetics/epic/edcpdaöfko.png', color: '#a855f7' },
  'pfp_epic_6': { id: 'pfp_epic_6', name: '#20', rarity: 'Epic', cost: 2.25, file: 'cosmetics/epic/epikia.png', color: '#a855f7' },
  'pfp_epic_7': { id: 'pfp_epic_7', name: '#21', rarity: 'Epic', cost: 2.25, file: 'cosmetics/epic/epikica.png', color: '#a855f7' },
  'pfp_epic_8': { id: 'pfp_epic_8', name: '#22', rarity: 'Epic', cost: 2.25, file: 'cosmetics/epic/epikus.png', color: '#a855f7' },

  // Exclusive — 5.00 Tokens
  'pfp_exclusive_1': { id: 'pfp_exclusive_1', name: '#23', rarity: 'Exclusive', cost: 5.00, file: 'cosmetics/exclusive/exclusive.png', color: '#f59e0b' },
  'pfp_exclusive_2': { id: 'pfp_exclusive_2', name: '#24', rarity: 'Exclusive', cost: 5.00, file: 'cosmetics/exclusive/exclusic.png', color: '#f59e0b' },
  'pfp_exclusive_3': { id: 'pfp_exclusive_3', name: '#25', rarity: 'Exclusive', cost: 5.00, file: 'cosmetics/exclusive/vzs excluisive.png', color: '#f59e0b' },
  'pfp_exclusive_4': { id: 'pfp_exclusive_4', name: '#26', rarity: 'Exclusive', cost: 5.00, file: 'cosmetics/epic/epic one.png', color: '#f59e0b' },
  'pfp_exclusive_5': { id: 'pfp_exclusive_5', name: '#27', rarity: 'Exclusive', cost: 5.00, file: 'cosmetics/epic/epic.png', color: '#f59e0b' },
  'pfp_exclusive_6': { id: 'pfp_exclusive_6', name: '#28', rarity: 'Exclusive', cost: 5.00, file: 'cosmetics/epic/Epic1234.png', color: '#f59e0b' },
  'pfp_exclusive_7': { id: 'pfp_exclusive_7', name: '#29', rarity: 'Exclusive', cost: 5.00, file: 'cosmetics/epic/1333334.png', color: '#f59e0b' },
  'pfp_exclusive_8': { id: 'pfp_exclusive_8', name: '#30', rarity: 'Exclusive', cost: 5.00, file: 'cosmetics/epic/epic1231344.png', color: '#f59e0b' },
};

const BANNERS_COMING_SOON = true;
const SHOP_BANNERS = {};

const SHOP_TITLES = {
  'title_no_signal': {
    id: 'title_no_signal',
    name: 'No signal',
    icon: 'globe-off',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.45)',
    rarity: 'Rare',
    cost: 1.75
  }
};

/** Equip or Unequip a Title */
async function equipUserTitle(uid, titleId) {
  const user = await getUser(uid);
  if (!user) throw new Error('User not found');

  await db.collection('users').doc(uid).update({
    equippedTitle: titleId || null
  });
}

/**
 * Deterministic pseudo-random number generator for daily shop seeds.
 */
function seededRandom(seed) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

/**
 * Returns 12 featured daily shop PFPs (2 full rows):
 * Guaranteed 5 Exclusive, 3 Epic, 2 Rare, 2 Uncommon (12 total).
 */
function getDailyShopPfps() {
  const now = new Date();
  const dateKey = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
  
  let seed = 0;
  for (let i = 0; i < dateKey.length; i++) {
    seed = (seed * 31 + dateKey.charCodeAt(i)) >>> 0;
  }

  const allPfps = Object.values(SHOP_PFPS);
  const exclusives = allPfps.filter(p => p.rarity === 'Exclusive');
  const epics = allPfps.filter(p => p.rarity === 'Epic');
  const rares = allPfps.filter(p => p.rarity === 'Rare');
  const uncommons = allPfps.filter(p => p.rarity === 'Uncommon' && !p.isDefault);

  function pickRandomN(arr, n, subSeed) {
    const copy = [...arr];
    const picked = [];
    for (let i = 0; i < n && copy.length > 0; i++) {
      const idx = Math.floor(seededRandom(subSeed + i * 13) * copy.length);
      picked.push(copy[idx]);
      copy.splice(idx, 1);
    }
    return picked;
  }

  const pickedExclusive = pickRandomN(exclusives, 5, seed + 1);
  const pickedEpic = pickRandomN(epics, 3, seed + 2);
  const pickedRare = pickRandomN(rares, 2, seed + 3);
  const pickedUncommon = pickRandomN(uncommons, 2, seed + 4);

  return [...pickedExclusive, ...pickedEpic, ...pickedRare, ...pickedUncommon];
}

/** Purchase a PFP from Shop */
async function buyShopPfp(uid, pfpId) {
  const item = SHOP_PFPS[pfpId];
  if (!item) throw new Error('Avatar not found in catalog');

  const user = await getUser(uid);
  if (!user) throw new Error('User not found');
  if (Number(user.tokens || 0) < item.cost) {
    throw new Error(`Insufficient tokens (Requires ${formatTokens(item.cost)} Tokens, you have ${formatTokens(user.tokens || 0)} Tokens)`);
  }

  const unlocked = user.unlockedPfps || [];
  if (unlocked.includes(pfpId) || item.isDefault) {
    throw new Error('You already own this avatar');
  }

  await updateTokens(uid, -item.cost, 'shop', `Purchased Avatar: "${item.name}" (${item.rarity})`);
  await db.collection('users').doc(uid).update({
    unlockedPfps: firebase.firestore.FieldValue.arrayUnion(pfpId)
  });

  return item;
}

/** Equip a PFP from Customization Studio */
async function equipShopPfp(uid, pfpId) {
  const item = SHOP_PFPS[pfpId];
  if (!item) throw new Error('Avatar not found');

  const user = await getUser(uid);
  if (!user) throw new Error('User not found');

  const unlocked = user.unlockedPfps || [];
  if (!item.isDefault && !unlocked.includes(pfpId)) {
    throw new Error('You must unlock this avatar before equipping it');
  }

  await db.collection('users').doc(uid).update({
    photoURL: item.file,
    equippedPfp: pfpId
  });

  return item;
}

/**
 * Returns today's featured daily shop items based on UTC date seed and rarity weights.
 * High-cost items (Unreal, Champion, Elite) have lower weights and appear rarely.
 */
function getDailyShopTitles(count = 5) {
  const now = new Date();
  const dateKey = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
  
  // Create integer seed from dateKey string
  let seed = 0;
  for (let i = 0; i < dateKey.length; i++) {
    seed = (seed * 31 + dateKey.charCodeAt(i)) >>> 0;
  }

  const eligible = Object.values(SHOP_TITLES).filter(t => t.weight > 0);
  const selected = [];
  const pool = [...eligible];

  for (let step = 0; step < count && pool.length > 0; step++) {
    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
    let rand = seededRandom(seed + step * 7) * totalWeight;
    
    for (let i = 0; i < pool.length; i++) {
      rand -= pool[i].weight;
      if (rand <= 0 || i === pool.length - 1) {
        selected.push(pool[i]);
        pool.splice(i, 1);
        break;
      }
    }
  }

  return selected;
}

/** Purchase a Title from Shop */
async function buyShopTitle(uid, titleId) {
  const item = SHOP_TITLES[titleId];
  if (!item) throw new Error('Title not found in shop');

  const user = await getUser(uid);
  if (!user) throw new Error('User not found');
  if (Number(user.tokens || 0) < item.cost) {
    throw new Error(`Insufficient tokens (Requires ${formatTokens(item.cost)} Tokens)`);
  }

  const unlocked = user.unlockedTitles || [];
  if (unlocked.includes(titleId)) {
    throw new Error('You already own this title');
  }

  await updateTokens(uid, -item.cost, 'shop', `Purchased Title: "${item.name}"`);
  await db.collection('users').doc(uid).update({
    unlockedTitles: firebase.firestore.FieldValue.arrayUnion(titleId)
  });

  return item;
}

/** Purchase a Profile Banner from Shop */
async function buyShopBanner(uid, bannerId) {
  const item = SHOP_BANNERS[bannerId];
  if (!item) throw new Error('Banner not found in shop');

  const user = await getUser(uid);
  if (!user) throw new Error('User not found');
  if (Number(user.tokens || 0) < item.cost) {
    throw new Error(`Insufficient tokens (Requires ${formatTokens(item.cost)} Tokens)`);
  }

  const unlocked = user.unlockedBanners || [];
  if (unlocked.includes(bannerId)) {
    throw new Error('You already own this banner');
  }

  await updateTokens(uid, -item.cost, 'shop', `Purchased Profile Banner: "${item.name}"`);
  await db.collection('users').doc(uid).update({
    unlockedBanners: firebase.firestore.FieldValue.arrayUnion(bannerId),
    equippedBanner:  bannerId
  });

  return item;
}

/** Equip or Unequip a Title */
async function equipTitle(uid, titleId) {
  await db.collection('users').doc(uid).update({
    equippedTitle: titleId || null
  });
}

/** Equip or Unequip a Banner */
async function equipBanner(uid, bannerId) {
  await db.collection('users').doc(uid).update({
    equippedBanner: bannerId || null
  });
}

/** Update Premium Username Style (Color + Animation) */
async function updateProfileStyle(uid, styleData) {
  const user = await getUser(uid);
  if (!user?.isPremium) {
    throw new Error('Username color and animation styling is exclusively available for Premium members.');
  }

  await db.collection('users').doc(uid).update({
    profileStyle: {
      color:     styleData.color || 'gold',
      animation: styleData.animation || 'shimmer'
    }
  });

  return true;
}

/** Claim Free Daily Chest (Resets every 00:00 UTC) */
async function claimDailyFreeChest(uid) {
  const user = await getUser(uid);
  if (!user) throw new Error('User not found');

  const now = new Date();
  const todayKey = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;

  if (user.lastFreeChestDate === todayKey) {
    throw new Error('You have already claimed today’s free daily chest! Resets daily at 00:00 UTC.');
  }

  // Random reward between 0.10 and 0.50 tokens
  const possibleTokens = [0.10, 0.15, 0.25, 0.35, 0.50];
  const rewardTokens = possibleTokens[Math.floor(Math.random() * possibleTokens.length)];

  await updateTokens(uid, rewardTokens, 'daily_chest', `Daily Free Mystery Chest reward: +${formatTokens(rewardTokens)} Tokens`);
  await db.collection('users').doc(uid).update({
    lastFreeChestDate: todayKey
  });

  return { rewardTokens, todayKey };
}

/** Open Champion Mystery Chest (Costs 1.50 Tokens) */
async function buyChampionMysteryChest(uid) {
  const user = await getUser(uid);
  if (!user) throw new Error('User not found');
  if (Number(user.tokens || 0) < 1.50) {
    throw new Error('Insufficient tokens (Mystery Chest costs 1.50 Tokens)');
  }

  await updateTokens(uid, -1.50, 'chest', 'Opened Champion Mystery Chest');

  // Random weighted reward (chance of 2.00, 3.00, 5.00, 10.00 Tokens)
  const roll = Math.random();
  let winAmount = 2.00;
  if (roll > 0.90) winAmount = 10.00;
  else if (roll > 0.70) winAmount = 5.00;
  else if (roll > 0.40) winAmount = 3.00;

  await updateTokens(uid, winAmount, 'chest_win', `Mystery Chest Payout: +${formatTokens(winAmount)} Tokens!`);

  return { rewardTokens: winAmount };
}

/** Auto cleanup any legacy guest records in Firestore */
async function cleanupGuestUsers() {
  try {
    const snap = await db.collection('users').get();
    const deleteBatch = db.batch();
    let hasDeletes = false;
    snap.docs.forEach(doc => {
      const data = doc.data();
      const name = (data.displayName || '').toLowerCase();
      if (doc.id.startsWith('guest_') || data.isGuest === true || name.includes('guest #') || name.includes('guest-')) {
        deleteBatch.delete(doc.ref);
        hasDeletes = true;
      }
    });
    if (hasDeletes) {
      await deleteBatch.commit();
      console.log('Cleaned up legacy guest users from database');
    }
  } catch (e) {
    console.warn('Guest cleanup notice:', e);
  }
}

// Auto-run guest cleanup in the background
if (typeof window !== 'undefined') {
  setTimeout(() => {
    if (typeof db !== 'undefined' && db) {
      cleanupGuestUsers().catch(() => {});
    }
  }, 2000);
}

/**
 * Master Database Reset
 * Deletes all matches, transactions, teams, and staff calls, and resets all users to 10.00 Tokens.
 */
async function fullDatabaseReset() {
  const collections = ['matches', 'transactions', 'teams', 'staff_calls'];
  let deletedCount = 0;

  for (const colName of collections) {
    try {
      const snap = await db.collection(colName).get();
      if (!snap.empty) {
        const batch = db.batch();
        snap.docs.forEach(doc => {
          batch.delete(doc.ref);
          deletedCount++;
        });
        await batch.commit();
      }
    } catch (colErr) {
      console.warn(`Error clearing collection ${colName}:`, colErr);
    }
  }

  // Reset or purge users
  try {
    const userSnap = await db.collection('users').get();
    if (!userSnap.empty) {
      const userBatch = db.batch();
      for (const doc of userSnap.docs) {
        const u = doc.data();
        if (doc.id.startsWith('guest_') || u.isGuest === true || (u.displayName || '').toLowerCase().includes('guest')) {
          userBatch.delete(doc.ref);
        } else {
          userBatch.update(doc.ref, {
            tokens: 1.00,
            totalEarned: 0.00,
            totalSpent: 0.00,
            matchesPlayed: 0,
            matchesWon: 0,
            unlockedTitles: [],
            equippedTitle: '',
            unlockedBanners: [],
            equippedBanner: '',
            isPremium: false,
            teamId: firebase.firestore.FieldValue.delete(),
            teamName: firebase.firestore.FieldValue.delete(),
            teamTag: firebase.firestore.FieldValue.delete(),
            lastFreeChestDate: firebase.firestore.FieldValue.delete()
          });
          // Add clean initial bonus transaction
          await db.collection('transactions').add({
            userId: doc.id,
            amount: 1.00,
            type: 'bonus',
            description: '1.00 Starter Token',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
      }
      await userBatch.commit();
    }
  } catch (userErr) {
    console.warn('Error resetting users:', userErr);
  }

  console.log(`Database reset finished. Cleaned ${deletedCount} records.`);
  return { success: true, deletedCount };
}

// ── Notifications ─────────────────────────────────────────────

/**
 * Push a notification to a user's notifications subcollection.
 * @param {string} uid - Target user UID
 * @param {string} type - 'match_win'|'match_join'|'team_invite'|'income'|'system'|'admin'
 * @param {string} title
 * @param {string} body
 * @param {object} [extra] - Optional extra data (teamId, matchId, etc.)
 */
async function pushNotification(uid, type, title, body, extra = {}) {
  if (!uid) return;
  try {
    await db.collection('users').doc(uid).collection('notifications').add({
      type,
      title,
      body,
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      ...extra,
    });
  } catch (e) {
    console.warn('pushNotification error:', e);
  }
}

/**
 * Subscribe to a user's notifications (real-time, last 30).
 */
function subscribeNotifications(uid, callback) {
  return db.collection('users').doc(uid).collection('notifications')
    .orderBy('createdAt', 'desc')
    .limit(30)
    .onSnapshot((snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(list);
    }, (err) => {
      console.warn('subscribeNotifications error:', err);
      callback([]);
    });
}

/**
 * Mark all unread notifications as read for a user.
 */
async function markNotificationsRead(uid) {
  try {
    const snap = await db.collection('users').doc(uid).collection('notifications')
      .where('read', '==', false).get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach(d => batch.update(d.ref, { read: true }));
    await batch.commit();
  } catch (e) {
    console.warn('markNotificationsRead error:', e);
  }
}

// ── Admin: Ban/Unban ──────────────────────────────────────────

/**
 * Ban a user. Sets banned:true and records the reason.
 * Hierarchy rules: Owner can never be banned. Admins cannot ban other admins.
 */
async function adminBanUser(targetUid, adminName, reason = 'Violation of terms', callerUid = null) {
  if (!targetUid) throw new Error('Target UID required');
  if (targetUid === OWNER_UID || targetUid.includes(OWNER_DISCORD_ID)) {
    throw new Error('The Platform Owner cannot be banned.');
  }

  const targetSnap = await db.collection('users').doc(targetUid).get();
  const targetData = targetSnap.data() || {};

  const isTargetAdmin = isOwnerUser(null, targetData) || isAdminUser(null, targetData);
  const isCallerOwner = callerUid ? (callerUid === OWNER_UID || callerUid.includes(OWNER_DISCORD_ID)) : false;

  if (isTargetAdmin && !isCallerOwner) {
    throw new Error('Administrators cannot ban other administrators.');
  }

  await db.collection('users').doc(targetUid).update({
    banned: true,
    bannedAt: firebase.firestore.FieldValue.serverTimestamp(),
    bannedBy: adminName,
    banReason: reason,
  });
  return true;
}

/**
 * Unban a user.
 */
async function adminUnbanUser(targetUid) {
  if (!targetUid) throw new Error('Target UID required');
  await db.collection('users').doc(targetUid).update({
    banned: false,
    unbannedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  return true;
}

/**
 * Delete a user account from Firestore completely.
 * Hierarchy rules: Owner cannot be deleted. Admins cannot delete other admins.
 */
async function adminDeleteUser(targetUid, adminName, callerUid = null) {
  if (!targetUid) throw new Error('Target UID required');
  if (targetUid === OWNER_UID || targetUid.includes(OWNER_DISCORD_ID)) {
    throw new Error('The Platform Owner account cannot be deleted.');
  }

  const userRef = db.collection('users').doc(targetUid);
  const userSnap = await userRef.get();
  const userData = userSnap.data() || {};

  const isTargetAdmin = isOwnerUser(null, userData) || isAdminUser(null, userData);
  const isCallerOwner = callerUid ? (callerUid === OWNER_UID || callerUid.includes(OWNER_DISCORD_ID)) : false;

  if (isTargetAdmin && !isCallerOwner) {
    throw new Error('Administrators cannot delete other administrators.');
  }

  // Clean up any team owned by this user
  try {
    const teamsSnap = await db.collection('teams').where('ownerUid', '==', targetUid).get();
    for (const tDoc of teamsSnap.docs) {
      await tDoc.ref.delete();
    }
  } catch (e) {
    console.warn('adminDeleteUser team cleanup error:', e);
  }

  // Remove from other teams
  try {
    const allTeamsSnap = await db.collection('teams').where('memberUids', 'array-contains', targetUid).get();
    for (const tDoc of allTeamsSnap.docs) {
      const tData = tDoc.data();
      const updatedMembers = (tData.members || []).filter(m => m.uid !== targetUid);
      const updatedUids = (tData.memberUids || []).filter(u => u !== targetUid);
      await tDoc.ref.update({ members: updatedMembers, memberUids: updatedUids });
    }
  } catch (e) {
    console.warn('adminDeleteUser team member cleanup error:', e);
  }

  // Delete user document
  await userRef.delete();

  // Record admin audit log
  try {
    await db.collection('admin_audit_logs').add({
      action: 'delete_user',
      targetUid,
      targetName: userData.displayName || 'User',
      performedBy: adminName || 'Admin',
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) {}

  return true;
}

/**
 * Directly set exact token balance for a user.
 */
async function adminSetTokens(targetUid, exactAmount, adminName, reason = 'Admin set balance') {
  if (!targetUid) throw new Error('Target UID required');
  const num = Math.max(0, parseFloat(exactAmount) || 0);
  const userRef = db.collection('users').doc(targetUid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new Error('User not found');
  const oldTokens = Number(userSnap.data()?.tokens || 0);

  await userRef.update({
    tokens: num,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  await recordTransaction(targetUid, {
    type: 'admin_adjustment',
    amount: num - oldTokens,
    tokensAfter: num,
    description: `Admin balance set: ${reason} (by ${adminName || 'Admin'})`,
    meta: { adminName, reason, oldTokens, newTokens: num },
  });

  return { oldTokens, newTokens: num, userName: userSnap.data()?.displayName };
}

/**
 * Directly set or edit Epic Games username for a user.
 */
async function adminSetEpic(targetUid, epicUsername) {
  if (!targetUid) throw new Error('Target UID required');
  const cleanEpic = (epicUsername || '').trim();
  await db.collection('users').doc(targetUid).update({
    epicUsername: cleanEpic,
    epicVerified: !!cleanEpic,
    epicLinkedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  return true;
}

/**
 * Unlink Epic Games account from a user.
 */
async function adminUnlinkEpic(targetUid) {
  if (!targetUid) throw new Error('Target UID required');
  await db.collection('users').doc(targetUid).update({
    epicUsername: firebase.firestore.FieldValue.delete(),
    epicAccountId: firebase.firestore.FieldValue.delete(),
    epicVerified: false,
  });
  return true;
}

/**
 * Set or change staff tier for a user.
 * Tiers: 'administrator' | 'moderator' | 'none'
 */
async function adminSetStaffRole(targetUid, role, callerUid = null) {
  if (!targetUid) throw new Error('Target UID required');
  const validRoles = ['administrator', 'moderator', 'none'];
  const cleanRole = (role || 'none').toLowerCase().trim();
  if (!validRoles.includes(cleanRole)) {
    throw new Error('Invalid staff role: ' + role);
  }

  const isStaff = cleanRole !== 'none';
  await db.collection('users').doc(targetUid).update({
    staffRole: cleanRole === 'none' ? firebase.firestore.FieldValue.delete() : cleanRole,
    isAdmin: isStaff,
    roleUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  return true;
}

/**
 * Toggle Admin/Staff status for a user.
 */
async function adminToggleAdmin(targetUid, makeAdmin, callerUid = null) {
  return adminSetStaffRole(targetUid, makeAdmin ? 'administrator' : 'none', callerUid);
}

/**
 * Reset match stats for a user.
 */
async function adminResetUserStats(targetUid) {
  if (!targetUid) throw new Error('Target UID required');
  await db.collection('users').doc(targetUid).update({
    matchesPlayed: 0,
    matchesWon: 0,
    earnings: 0,
  });
  return true;
}

/**
 * Fetch recent users for the admin user directory.
 */
async function adminFetchRecentUsers(limitCount = 40) {
  try {
    const snap = await db.collection('users')
      .limit(limitCount)
      .get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (e) {
    console.warn('adminFetchRecentUsers error:', e);
    return [];
  }
}

/**
 * Search users by display name, discord username, or epic username (single-letter prefix matching).
 * Returns up to 15 results.
 */
async function searchUsers(query) {
  if (!query || !query.trim()) {
    try {
      const snap = await db.collection('users').orderBy('matchesWon', 'desc').limit(10).get();
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
      return [];
    }
  }

  const q = query.trim();
  const qCap = q.charAt(0).toUpperCase() + q.slice(1);
  const qLow = q.toLowerCase();
  const qUp = q.toUpperCase();
  const results = [];
  const seen = new Set();

  const addResult = (doc) => {
    if (!seen.has(doc.id)) {
      seen.add(doc.id);
      results.push({ id: doc.id, ...doc.data() });
    }
  };

  try {
    // 1. Exact UID match
    if (q.length > 10) {
      const byUid = await db.collection('users').doc(q).get();
      if (byUid.exists) addResult(byUid);
    }

    // 2. Prefix queries on displayName
    const prefixes = [...new Set([q, qCap, qLow, qUp])];
    for (const prefix of prefixes) {
      const snap = await db.collection('users')
        .where('displayName', '>=', prefix)
        .where('displayName', '<=', prefix + '\uf8ff')
        .limit(8).get();
      snap.docs.forEach(addResult);
    }

    // 3. Discord username prefix query
    for (const prefix of prefixes) {
      const snap = await db.collection('users')
        .where('discordUsername', '>=', prefix)
        .where('discordUsername', '<=', prefix + '\uf8ff')
        .limit(6).get();
      snap.docs.forEach(addResult);
    }

    // 4. Epic username prefix query
    for (const prefix of prefixes) {
      const snap = await db.collection('users')
        .where('epicUsername', '>=', prefix)
        .where('epicUsername', '<=', prefix + '\uf8ff')
        .limit(6).get();
      snap.docs.forEach(addResult);
    }
  } catch (e) {
    console.warn('searchUsers error:', e);
  }

  return results.slice(0, 15);
}

// ── Teams: Invite by search ───────────────────────────────────

/**
 * Send a team invite notification to another user.
 */
async function sendTeamInvite(teamId, teamName, teamTag, inviterUid, inviterName, targetUid) {
  if (!targetUid || targetUid === inviterUid) throw new Error('Invalid invite target');

  await pushNotification(targetUid, 'team_invite',
    `Team Invite: ${teamName}`,
    `${inviterName} invited you to join [${teamTag}] ${teamName}`,
    { teamId, teamName, teamTag, inviterUid, inviterName }
  );
}

/**
 * Accept a team invite (from notification payload).
 */
async function acceptTeamInvite(notifId, uid, teamId) {
  const user = await getUser(uid);
  if (!user) throw new Error('User not found');
  if (user.teamId) throw new Error('You are already in a team. Leave your current team first.');

  const teamSnap = await db.collection('teams').doc(teamId).get();
  if (!teamSnap.exists) throw new Error('Team no longer exists');
  const team = teamSnap.data();

  if ((team.members || []).length >= 6) throw new Error('Team is full (max 6 members)');
  if ((team.memberUids || []).includes(uid)) throw new Error('You are already in this team');

  const newMember = {
    uid,
    displayName: user.displayName || 'Player',
    photoURL: user.photoURL || '',
    isLeader: false,
  };

  await teamSnap.ref.update({
    members: firebase.firestore.FieldValue.arrayUnion(newMember),
    memberUids: firebase.firestore.FieldValue.arrayUnion(uid),
  });

  await db.collection('users').doc(uid).update({
    teamId: teamId,
    teamName: team.name,
    teamTag: team.tag,
  });

  // Mark notification read
  try {
    await db.collection('users').doc(uid).collection('notifications').doc(notifId).update({ read: true, accepted: true });
  } catch (e) {}

  return { teamId, teamName: team.name };
}

/**
 * Decline a team invite.
 */
async function declineTeamInvite(notifId, uid) {
  try {
    await db.collection('users').doc(uid).collection('notifications').doc(notifId).update({ read: true, declined: true });
  } catch (e) {}
}
