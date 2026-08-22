// ============================================================
//  CHAMPION TOKENS — Database / Firestore Helpers
// ============================================================

// ── Users ────────────────────────────────────────────────────

/**
 * Ensures user document exists with 10.00 Tokens starter balance.
 */
async function ensureUserRecord(user) {
  if (!user || !user.uid) return null;
  const userRef = db.collection('users').doc(user.uid);
  const snap = await userRef.get();
  if (!snap.exists) {
    const newUser = {
      uid: user.uid,
      displayName: user.displayName || 'Champion',
      email: user.email || '',
      photoURL: user.photoURL || '',
      tokens: 10.00,
      totalEarned: 10.00,
      totalSpent: 0.00,
      matchesPlayed: 0,
      matchesWon: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
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
  }
  return { id: snap.id, ...snap.data() };
}

/** Fetch a user document by UID (or create with 10.00 starter tokens if missing) */
async function getUser(uid) {
  if (!uid) return null;
  const snap = await db.collection('users').doc(uid).get();
  if (snap.exists) {
    return { id: snap.id, ...snap.data() };
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
    throw new Error('Minimum wager is 0.50 tokens ($0.50)');
  }
  if (Number(hostUser.tokens || 0) < wager) {
    throw new Error('Insufficient tokens to create this match');
  }

  const size = matchData.size || '1v1';
  const mode = matchData.mode || 'Realistic';
  const maxPlayers = size === '1v1' ? 2 : size === '2v2' ? 4 : 6;
  const title = `${size} ${mode}`;
  const code = generateMatchCode();

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
  };

  const matchRef = await db.collection('matches').add({
    title,
    size,
    mode,
    wager,
    maxPlayers,
    players:    [hostPlayer],
    playerUids: [hostUser.uid],
    status:     'waiting', // waiting | in_progress | completed | cancelled
    createdBy:  hostUser.uid,
    hostName:   hostUser.displayName,
    code,
    prizePool:  wager,
    winner:     null,
    createdAt:  firebase.firestore.FieldValue.serverTimestamp(),
    expiresAt:  firebase.firestore.Timestamp.fromDate(expiresAt),
    completedAt:null,
  });

  // Hold the host's wager
  await updateTokens(
    hostUser.uid,
    -wager,
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
  if (Number(joiningUser.tokens || 0) < wager)
    throw new Error(`Insufficient tokens to join (Requires ${formatTokens(wager)} tokens)`);

  const newPlayer = {
    uid:          joiningUser.uid,
    displayName:  joiningUser.displayName || 'Player',
    epicUsername: joiningUser.epicUsername || '',
    isPremium:    !!joiningUser.isPremium,
    photoURL:     joiningUser.photoURL || '',
    isHost:       false,
    ready:        false,
  };

  await matchDoc.ref.update({
    players:    firebase.firestore.FieldValue.arrayUnion(newPlayer),
    playerUids: firebase.firestore.FieldValue.arrayUnion(joiningUser.uid),
    prizePool:  firebase.firestore.FieldValue.increment(wager),
  });

  await updateTokens(
    joiningUser.uid,
    -wager,
    'match_wager',
    `🎮 Joined match — "${match.title}" (${match.code})`
  );

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
 * - If Host leaves: cancels match & refunds everyone.
 * - If Joined player leaves: removes player, reduces prizePool, refunds player.
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
    // Cancel match and refund ALL players in the match
    const refundPromises = (match.players || []).map(p =>
      updateTokens(p.uid, wager, 'refund', `↩️ Match cancelled by host — "${match.title}" refund`)
    );
    await Promise.all(refundPromises);

    await matchRef.update({
      status:      'cancelled',
      completedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    return { action: 'cancelled', message: 'Match cancelled and your tokens were refunded.' };
  } else {
    // Non-host player leaving
    const updatedPlayers = (match.players || []).filter(p => p.uid !== uid);
    const updatedUids    = (match.playerUids || []).filter(u => u !== uid);

    await matchRef.update({
      players:    updatedPlayers,
      playerUids: updatedUids,
      prizePool:  firebase.firestore.FieldValue.increment(-wager),
      status:     'waiting',
    });

    // Refund player wager
    await updateTokens(uid, wager, 'refund', `↩️ Left match — "${match.title}" refund`);

    return { action: 'left', message: 'You left the match and your wager was refunded.' };
  }
}

/**
 * Auto-expire match after 30 minutes and refund all players.
 */
async function expireMatch(matchId) {
  const matchRef = db.collection('matches').doc(matchId);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) return;

  const match = matchSnap.data();
  if (match.status !== 'waiting') return;

  const wager = Number(match.wager);
  const refundPromises = (match.players || []).map(p =>
    updateTokens(p.uid, wager, 'refund', `⏱️ Match expired (30m limit) — "${match.title}" refund`)
  );
  await Promise.all(refundPromises);

  await matchRef.update({
    status:      'cancelled',
    completedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
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
 */
async function declareWinner(matchId, winnerUid, hostUid) {
  const matchRef  = db.collection('matches').doc(matchId);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) throw new Error('Match not found');

  const match = matchSnap.data();
  if (match.createdBy !== hostUid) throw new Error('Only the host can declare a winner');
  if (match.status === 'completed')  throw new Error('Match is already completed');

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
      const prizePerPlayer = Math.round((rawPrize / Math.max(1, winningPlayers.length)) * 100) / 100;

      updatePayload.status = 'completed';
      updatePayload.isDisputed = false;
      updatePayload.winnerTeam = winningTeam;
      updatePayload.winner = winningPlayers.length === 1 ? { uid: winningPlayers[0].uid, displayName: winningPlayers[0].displayName } : null;
      updatePayload.completedAt = firebase.firestore.FieldValue.serverTimestamp();

      await matchRef.update(updatePayload);

      // Distribute prize tokens
      for (const wp of winningPlayers) {
        await updateTokens(wp.uid, prizePerPlayer, 'match_win', `🏆 Won match — "${match.title}"`);
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
  const prizePerPlayer = Math.round((rawPrize / Math.max(1, winningPlayers.length)) * 100) / 100;

  await matchRef.update({
    status: 'completed',
    isDisputed: false,
    winnerTeam: winningTeam,
    resolvedByAdmin: adminUid,
    winner: winningPlayers.length === 1 ? { uid: winningPlayers[0].uid, displayName: winningPlayers[0].displayName } : null,
    completedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  for (const wp of winningPlayers) {
    await updateTokens(wp.uid, prizePerPlayer, 'match_win', `🏆 Won match (Staff Decision) — "${match.title}"`);
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

/** Fetch top 10 real users by token balance */
async function getLeaderboard() {
  const snap = await db.collection('users')
    .orderBy('tokens', 'desc')
    .limit(50)
    .get();
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(u => {
      if (u.isGuest === true || u.id.startsWith('guest_') || u.uid?.startsWith('guest_')) return false;
      const name = (u.displayName || '').toLowerCase();
      if (name.includes('guest') || name.includes('tester') || name.startsWith('guest #') || name.startsWith('guest-')) return false;
      return true;
    })
    .slice(0, 10);
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
    displayName: user.displayName,
    photoURL:    user.photoURL || '',
    isLeader:    true,
  };

  const teamRef = await db.collection('teams').add({
    name:       name.trim(),
    tag:        cleanTag,
    code,
    ownerUid:   user.uid,
    ownerName:  user.displayName,
    members:    [leader],
    memberUids: [user.uid],
    createdAt:  firebase.firestore.FieldValue.serverTimestamp(),
  });

  // Link team to user document
  await db.collection('users').doc(user.uid).update({
    teamId:   teamRef.id,
    teamName: name.trim(),
    teamTag:  cleanTag,
  });

  return { id: teamRef.id, code, name: name.trim(), tag: cleanTag };
}

/** Fetch a user's current team */
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
    throw new Error('You are already on this team');
  }

  const newMember = {
    uid:         user.uid,
    displayName: user.displayName,
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

  return { id: teamDoc.id, name: team.name, tag: team.tag };
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

    await db.collection('users').doc(uid).update({
      teamId:   firebase.firestore.FieldValue.delete(),
      teamName: firebase.firestore.FieldValue.delete(),
      teamTag:  firebase.firestore.FieldValue.delete(),
    });

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
    const snap = await db.collection('users').orderBy('tokens', 'desc').get();
    const realUsers = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => {
        if (u.isGuest === true || u.id.startsWith('guest_') || u.uid?.startsWith('guest_')) return false;
        const name = (u.displayName || '').toLowerCase();
        if (name.includes('guest') || name.includes('tester') || name.startsWith('guest #') || name.startsWith('guest-')) return false;
        return true;
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




