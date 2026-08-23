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
      tokens: 10.00,
      totalEarned: 10.00,
      totalSpent: 0.00,
      matchesPlayed: 0,
      matchesWon: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await userRef.set(newUser);
    await db.collection('transactions').add({
      userId: user.uid,
      amount: 10.00,
      type: 'bonus',
      description: '🎉 10.00 Free Starter Tokens',
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
  if (roundedAmount > 0 && type !== 'refund') {
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
  const teamId = matchData.teamId || null;
  const teamName = matchData.teamName || null;
  const teamTag = matchData.teamTag || null;
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
    throw new Error(`Insufficient tokens (Requires ${formatTokens(hostDeposit)} tokens to create match & cover squad)`);
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
    teamTag:      teamTag || '',
    paidAmount:   hostDeposit,
  };

  let defaultMapCode = '9854-1829-8735';
  if (mode === 'Zone Wars') defaultMapCode = '3537-4087-0888';
  else if (mode === 'Box Fights') defaultMapCode = '2355-0939-8965';
  const mapCode = matchData.mapCode || defaultMapCode;

  const matchRef = await db.collection('matches').add({
    title,
    size,
    mode,
    wager,
    maxPlayers,
    mapCode,
    teamId,
    teamName,
    teamTag,
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
    `🎮 Created match — "${title}" (${code})`
  );

  return { id: matchRef.id, code, title };
}

/**
 * Join a match by its 6-character code.
 */
async function joinMatch(code, joiningUser) {
  const snap = await db.collection('matches')
    .where('code', '==', code.toUpperCase())
    .where('status', '==', 'waiting')
    .limit(1)
    .get();

  if (snap.empty) throw new Error('Match not found, started, or expired');

  const matchDoc = snap.docs[0];
  const match    = matchDoc.data();
  const wager    = Number(match.wager);

  // Check if 30-min timer expired
  if (match.expiresAt && match.expiresAt.toDate() < new Date()) {
    await expireMatch(matchDoc.id);
    throw new Error('This match has expired and is no longer available');
  }

  if (match.players.length >= match.maxPlayers)
    throw new Error('This match is already full');
  if (match.players.find(p => p.uid === joiningUser.uid))
    throw new Error('You are already in this match');

  // Check if this joining player is covered by host's squad entry setting
  const isHostSquadTeammate = (match.players.length < (match.maxPlayers / 2));
  const isCovered = (match.tokenCoverage === 'all' && isHostSquadTeammate) ||
    (match.tokenCoverage === 'custom' && (match.coveredMemberUids || []).includes(joiningUser.uid));

  const playerDeduction = isCovered ? 0 : wager;

  if (playerDeduction > 0 && Number(joiningUser.tokens || 0) < playerDeduction)
    throw new Error(`Insufficient tokens to join (Requires ${formatTokens(playerDeduction)} tokens)`);

  const newPlayer = {
    uid:          joiningUser.uid,
    displayName:  joiningUser.displayName || 'Player',
    epicUsername: joiningUser.epicUsername || '',
    isPremium:    !!joiningUser.isPremium,
    photoURL:     joiningUser.photoURL || '',
    isHost:       false,
    ready:        false,
    paidAmount:   playerDeduction,
    isCovered:    isCovered,
  };

  const updateFields = {
    players:    firebase.firestore.FieldValue.arrayUnion(newPlayer),
    playerUids: firebase.firestore.FieldValue.arrayUnion(joiningUser.uid),
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
      `🎮 Joined match — "${match.title}" (${match.code})`
    );
  }

  return matchDoc.id;
}

/**
 * Player toggles or sets Ready status in a match.
 * If all players are ready, match status automatically becomes 'in_progress'.
 */
async function setPlayerReady(matchId, uid, isReady = true) {
  const matchRef = db.collection('matches').doc(matchId);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) throw new Error('Match not found');

  const match = matchSnap.data();
  if (match.status !== 'waiting' && match.status !== 'ready') {
    throw new Error('Cannot change ready state once match has started or ended');
  }

  const updatedPlayers = (match.players || []).map(p => {
    if (p.uid === uid) {
      return { ...p, ready: isReady };
    }
    return p;
  });

  const allReady = updatedPlayers.length === match.maxPlayers && updatedPlayers.every(p => p.ready);
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
    });
    await msgRef.add({
      isSystem:  true,
      text:      `👑 Team ${hostName} is host, so ${oppName} has to add them in Fortnite!`,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });
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
 * Auto-expire match after 30 minutes and issue 100% full refund to all players.
 */
async function expireMatch(matchId) {
  const matchRef = db.collection('matches').doc(matchId);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) return;

  const match = matchSnap.data();
  if (match.status === 'completed' || match.status === 'cancelled') return;

  const wager = Number(match.wager);
  const refundPromises = (match.players || []).map(p => {
    const refundAmt = Number(p.paidAmount !== undefined ? p.paidAmount : (p.uid === match.createdBy ? (match.hostCoveredDeposit || wager) : wager));
    if (refundAmt > 0) {
      return updateTokens(p.uid, refundAmt, 'refund', `⏱️ Match expired (30m limit) — "${match.title}" full refund`);
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
    text:      '⏱️ MATCH EXPIRED: The 30-minute match timer has elapsed. All participants have received a 100% full token refund.',
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  }).catch(console.warn);
}

/** Helper to calculate earnings distribution based on team split rule */
function calculateTeamPayouts(winningPlayers, totalPrize, match) {
  if (!winningPlayers || !winningPlayers.length) return [];
  const splitRule = match.splitRule || 'equal';
  const captain = winningPlayers.find(p => p.isHost || p.uid === match.createdBy);
  const teammates = winningPlayers.filter(p => p.uid !== captain?.uid);

  if (!captain || winningPlayers.length <= 1 || splitRule === 'equal') {
    const each = Math.round((totalPrize / winningPlayers.length) * 100) / 100;
    return winningPlayers.map(p => ({ uid: p.uid, amount: each }));
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

  if (splitRule === 'captain_first') {
    const coveredDeposit = Number(match.hostCoveredDeposit || match.wager || 0);
    const reimbursement = Math.min(totalPrize, coveredDeposit);
    const remainder = Math.max(0, totalPrize - reimbursement);
    const each = Math.round((remainder / winningPlayers.length) * 100) / 100;
    return [
      { uid: captain.uid, amount: reimbursement + each },
      ...teammates.map(p => ({ uid: p.uid, amount: each }))
    ];
  }

  const each = Math.round((totalPrize / winningPlayers.length) * 100) / 100;
  return winningPlayers.map(p => ({ uid: p.uid, amount: each }));
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
  if (match.createdBy !== hostUid) throw new Error('Only the host can declare a winner');
  if (match.status === 'completed')  throw new Error('Match is already completed');

  // Check 30-minute expiration
  const expTime = match.expiresAt ? match.expiresAt.toDate().getTime() : 0;
  if (expTime > 0 && expTime <= Date.now()) {
    await expireMatch(matchId);
    throw new Error('This match has expired (30-minute limit) and was 100% fully refunded. No winner can be declared.');
  }

  const winner = match.players.find(p => p.uid === winnerUid);
  if (!winner) throw new Error('Player not found in match');

  const rawPrize = Number(match.prizePool || 0) * 0.90; // 90% to winner
  const prize = Math.round(rawPrize * 100) / 100;

  await matchRef.update({
    status:      'completed',
    winner: { uid: winnerUid, displayName: winner.displayName },
    completedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  await updateTokens(winnerUid, prize, 'match_win', `🏆 Won match — "${match.title}"`);

  // Update stats for all players
  const statsUpdates = match.players.map(player => {
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

  // Check 30-minute expiration
  const expTime = match.expiresAt ? match.expiresAt.toDate().getTime() : 0;
  if (expTime > 0 && expTime <= Date.now()) {
    await expireMatch(matchId);
    throw new Error('This match has expired (30-minute limit) and was 100% fully refunded.');
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
          await updateTokens(p.uid, p.amount, 'match_win', `🏆 Won match — "${match.title}"`);
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
        text: `🏆 MATCH CONFIRMED: Both sides verified that ${winningTeam === 'team1' ? 'Team 1' : 'Team 2'} won! Total prize of ${formatTokens(rawPrize)} Tokens has been paid out.`,
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
        calledByName: '🤖 System Auto-Dispute',
        reason: 'Match Result Dispute (Conflicting Winner Claims)',
        details: `Dispute triggered in match "${match.title}" (${match.code}). Team 1 claimed ${currentTeam1Report === 'team1' ? 'Team 1 Won' : 'Team 2 Won'} vs Team 2 claimed ${currentTeam2Report === 'team1' ? 'Team 1 Won' : 'Team 2 Won'}. Moderator auto-called to inspect match.`,
        status: 'open',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });

      // System chat notice
      await msgRef.add({
        isSystem: true,
        text: `⚠️ DISPUTE DETECTED: Both sides reported conflicting match results! A Staff Moderator has been automatically called to review evidence and confirm the official winner.`,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });

      return { status: 'disputed' };
    }
  } else {
    // Only one side has reported so far
    await matchRef.update(updatePayload);

    await msgRef.add({
      isSystem: true,
      text: `📢 ${reporterTeamName} submitted score: ${reportedWinnerTeam === 'team1' ? 'Team 1 Won' : 'Team 2 Won'}. Waiting for opponent to confirm…`,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });

    return { status: 'waiting_opponent' };
  }
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
      await updateTokens(p.uid, p.amount, 'match_win', `🏆 Won match (Staff Decision) — "${match.title}"`);
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
    text: `🛡️ STAFF RULING: Staff Moderator resolved the dispute in favor of ${winningTeam === 'team1' ? 'Team 1' : 'Team 2'}! ${formatTokens(rawPrize)} Tokens awarded.`,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  });

  return rawPrize;
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

/** Create a new team */
async function createTeam(user, { name, tag }) {
  if (!name || !name.trim()) throw new Error('Team name is required');
  const cleanTag = (tag || name.substring(0, 4)).toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
  const code = generateTeamCode();

  const leader = {
    uid:         user.uid,
    displayName: user.displayName || 'Leader',
    photoURL:    user.photoURL || '',
    isLeader:    true,
  };

  const teamRef = await db.collection('teams').add({
    name:              name.trim(),
    tag:               cleanTag,
    code,
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
    teamName: name.trim(),
    teamTag:  cleanTag,
  });

  return { id: teamRef.id, code, name: name.trim(), tag: cleanTag };
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

// ── Epic Games / Fortnite Account Linking ────────────────────

/** Link or update Epic Games username */
async function linkEpicAccount(uid, epicUsername) {
  const cleanUsername = epicUsername.trim();
  if (!cleanUsername || cleanUsername.length < 2) {
    throw new Error('Please enter a valid Epic Games / Fortnite username');
  }

  await db.collection('users').doc(uid).update({
    epicUsername: cleanUsername,
    epicLinkedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  return cleanUsername;
}

/** Sync/re-verify Epic Games username */
async function syncEpicAccount(uid, epicUsername) {
  return linkEpicAccount(uid, epicUsername);
}

/**
 * Unlink Epic Games account (Requires 2.00 Tokens fee)
 */
async function unlinkEpicAccount(uid) {
  const user = await getUser(uid);
  if (!user || !user.epicUsername) throw new Error('No Epic Games account is linked');

  if (Number(user.tokens || 0) < 2.00) {
    throw new Error('Unlinking requires 2.00 Tokens ($2.00). Please add tokens to your balance.');
  }

  // Deduct 2.00 tokens fee
  await updateTokens(uid, -2.00, 'admin', 'Unlinked Epic Games Account (-2.00 Tokens Fee)');

  await db.collection('users').doc(uid).update({
    epicUsername: firebase.firestore.FieldValue.delete(),
    epicLinkedAt: firebase.firestore.FieldValue.delete(),
  });

  return true;
}

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

  await updateTokens(targetUid, num, 'admin', `⚡ Admin adjustment: ${reason}`);
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
      updateTokens(p.uid, wager, 'refund', `🛡️ Admin (${adminName}) cancelled match — "${match.title}" refund`)
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
  await updateTokens(uid, -5.00, 'shop', '👑 Purchased Champion Premium (30 Days)');

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
    `🎁 Tipped ${formatTokens(num)} Tokens to @${receiver.discordUsername || receiver.displayName}`
  );

  // Credit to receiver
  await updateTokens(
    receiverUid,
    num,
    'tip_received',
    `🎁 Received ${formatTokens(num)} Tokens tip from @${sender.discordUsername || sender.displayName}`
  );

  return { sender, receiver, amount: num };
}

/**
 * Link connected Epic Games account to user profile.
 */
async function linkEpicAccount(uid, epicUsername, epicAccountId = '') {
  if (!uid) throw new Error('User ID is required');
  const clean = (epicUsername || '').trim();
  if (!clean) throw new Error('Epic Games username cannot be empty');

  const userRef = db.collection('users').doc(uid);
  await userRef.set({
    epicUsername:  clean,
    epicAccountId: epicAccountId || '',
    epicVerified:  true,
    epicLinkedAt:  firebase.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return { success: true, epicUsername: clean };
}

/**
 * Unlink connected Epic Games account from user profile.
 * Deducts 2.00 Tokens unlinking fee.
 */
async function unlinkEpicAccount(uid) {
  const user = await getUser(uid);
  if (!user) throw new Error('User not found');
  if (Number(user.tokens || 0) < 2.00) {
    throw new Error('Insufficient tokens to unlink (Requires 2.00 Tokens fee)');
  }

  await updateTokens(
    uid,
    -2.00,
    'epic_unlink_fee',
    '🔌 Unlinked Epic Games account (-2.00 Tokens fee)'
  );

  const userRef = db.collection('users').doc(uid);
  await userRef.update({
    epicUsername:  firebase.firestore.FieldValue.delete(),
    epicAccountId: firebase.firestore.FieldValue.delete(),
    epicVerified:  false,
    epicUnlinkedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  return { success: true };
}

// ── Shop Titles, Banners, & Daily Mystery Chests ─────────────

const SHOP_TITLES = {
  // Fortnite Rank Series
  'bronze':        { id: 'bronze',        name: '🥉 Bronze',           cost: 1.00,  rarity: 'Common',    weight: 80, className: 'title-bronze' },
  'silver':        { id: 'silver',        name: '🥈 Silver',           cost: 1.50,  rarity: 'Common',    weight: 70, className: 'title-silver' },
  'gold':          { id: 'gold',          name: '🥇 Gold',             cost: 2.50,  rarity: 'Uncommon',  weight: 50, className: 'title-gold' },
  'platinum':      { id: 'platinum',      name: '💎 Platinum',         cost: 3.50,  rarity: 'Rare',      weight: 35, className: 'title-platinum' },
  'diamond':       { id: 'diamond',       name: '🔷 Diamond',          cost: 5.00,  rarity: 'Epic',      weight: 20, className: 'title-diamond' },
  'elite':         { id: 'elite',         name: '👑 Elite',            cost: 7.50,  rarity: 'Legendary', weight: 10, className: 'title-elite' },
  'champion':      { id: 'champion',      name: '🏆 Champion',         cost: 10.00, rarity: 'Mythic',    weight: 5,  className: 'title-champion' },
  'unreal':        { id: 'unreal',        name: '🌌 Unreal',           cost: 15.00, rarity: 'Exotic',    weight: 2,  className: 'title-unreal' },

  // Special / Legacy Series
  'goated':        { id: 'goated',        name: '⚡ GOATED',           cost: 2.50,  rarity: 'Uncommon',  weight: 40, className: 'title-goated' },
  'the_boss':      { id: 'the_boss',      name: '⭐ The Boss',         cost: 5.00,  rarity: 'Epic',      weight: 15, className: 'title-the-boss' },
  'prodigy':       { id: 'prodigy',       name: '🏆 The Prodigy',      cost: 2.00,  rarity: 'Uncommon',  weight: 50, className: 'title-prodigy' },
  'box_god':       { id: 'box_god',       name: '🎯 Box Fight God',    cost: 2.50,  rarity: 'Uncommon',  weight: 45, className: 'title-box-god' },
  'high_roller':   { id: 'high_roller',   name: '💎 High Roller',      cost: 4.00,  rarity: 'Rare',      weight: 25, className: 'title-high-roller' },
  'average':       { id: 'average',       name: '⚡ Average',          cost: 1.00,  rarity: 'Common',    weight: 60, className: 'title-average' },
  'beta_pioneer':  { id: 'beta_pioneer',  name: '🌟 Beta Pioneer',     cost: 0.00,  rarity: 'Exclusive', weight: 0,  className: 'title-beta-pioneer' }
};

const BANNERS_COMING_SOON = true;
const SHOP_BANNERS = {};

/**
 * Deterministic pseudo-random number generator for daily shop seeds.
 */
function seededRandom(seed) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
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

/** Get Leaderboard Rank for a User */
async function getUserLeaderboardRank(uid) {
  try {
    const snap = await db.collection('users').get();
    const realUsers = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => {
        if (u.isGuest === true || u.id.startsWith('guest_') || u.uid?.startsWith('guest_')) return false;
        const name = (u.displayName || '').toLowerCase();
        if (name.includes('guest') || name.includes('tester') || name.startsWith('guest #') || name.startsWith('guest-')) return false;
        return true;
      });

    realUsers.sort((a, b) => {
      const winsDiff = (Number(b.matchesWon) || 0) - (Number(a.matchesWon) || 0);
      if (winsDiff !== 0) return winsDiff;
      return (Number(b.totalEarned) || 0) - (Number(a.totalEarned) || 0);
    });

    const rankIndex = realUsers.findIndex(d => d.id === uid);
    if (rankIndex === -1) return { rank: 0, display: 'Unranked', badgeClass: 'rank-badge-normal' };
    const rank = rankIndex + 1;
    return {
      rank,
      display: rank === 1 ? '#1 Champion' : `#${rank}`,
      badgeClass: rank === 1 ? 'rank-badge-1' : rank <= 3 ? 'rank-badge-top' : 'rank-badge-normal'
    };
  } catch (e) {
    console.warn('Rank calculation error:', e);
    return { rank: 0, display: 'Unranked', badgeClass: 'rank-badge-normal' };
  }
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

  await updateTokens(uid, -item.cost, 'shop', `🏷️ Purchased Title: "${item.name}"`);
  await db.collection('users').doc(uid).update({
    unlockedTitles: firebase.firestore.FieldValue.arrayUnion(titleId),
    equippedTitle:  titleId
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

  await updateTokens(uid, -item.cost, 'shop', `🎨 Purchased Profile Banner: "${item.name}"`);
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

  await updateTokens(uid, rewardTokens, 'daily_chest', `🎁 Daily Free Mystery Chest reward: +${formatTokens(rewardTokens)} Tokens`);
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

  await updateTokens(uid, -1.50, 'chest', '🗝️ Opened Champion Mystery Chest');

  // Random weighted reward (chance of 2.00, 3.00, 5.00, 10.00 Tokens)
  const roll = Math.random();
  let winAmount = 2.00;
  if (roll > 0.90) winAmount = 10.00;
  else if (roll > 0.70) winAmount = 5.00;
  else if (roll > 0.40) winAmount = 3.00;

  await updateTokens(uid, winAmount, 'chest_win', `🏆 Mystery Chest Payout: +${formatTokens(winAmount)} Tokens!`);

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
            tokens: 10.00,
            totalEarned: 10.00,
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
            amount: 10.00,
            type: 'bonus',
            description: '🎁 10.00 Starter Tokens (Beta Launch Reset)',
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
 */
async function adminBanUser(targetUid, adminName, reason = 'Violation of terms') {
  if (!targetUid) throw new Error('Target UID required');
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

// ── Admin: Search Users ───────────────────────────────────────

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
