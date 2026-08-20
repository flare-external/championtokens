// ============================================================
//  CHAMPION TOKENS — Database / Firestore Helpers
// ============================================================

// ── Users ────────────────────────────────────────────────────

/** Fetch a user document by UID */
async function getUser(uid) {
  const snap = await db.collection('users').doc(uid).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
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
    uid:         hostUser.uid,
    displayName: hostUser.displayName,
    photoURL:    hostUser.photoURL || '',
    isHost:      true,
    ready:       false,
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
    uid:         joiningUser.uid,
    displayName: joiningUser.displayName,
    photoURL:    joiningUser.photoURL || '',
    isHost:      false,
    ready:       false,
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

// ── Leaderboard ──────────────────────────────────────────────

/** Fetch top 10 users by token balance */
async function getLeaderboard() {
  const snap = await db.collection('users')
    .orderBy('tokens', 'desc')
    .limit(10)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
  const user = await getUser(uid);
  if (!user || !user.teamId) {
    // Check if user is in any team
    const snap = await db.collection('teams').where('memberUids', 'array-contains', uid).limit(1).get();
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
  }
  const snap = await db.collection('teams').doc(user.teamId).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
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

/** Admin grant or deduct tokens to any user */
async function adminAdjustTokens(targetUid, amount, reason) {
  const num = Number(amount);
  if (isNaN(num)) throw new Error('Invalid token amount');
  await updateTokens(targetUid, num, 'admin', `⚡ Admin adjustment: ${reason}`);
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


