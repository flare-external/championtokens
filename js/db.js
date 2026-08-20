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
 * @param {string} type    'bonus' | 'match_wager' | 'match_win' | 'purchase' | 'admin'
 * @param {string} description
 */
async function updateTokens(uid, amount, type, description) {
  const roundedAmount = Math.round(Number(amount) * 100) / 100;
  const userRef = db.collection('users').doc(uid);
  const update  = {
    tokens: firebase.firestore.FieldValue.increment(roundedAmount),
  };
  if (roundedAmount > 0) update.totalEarned = firebase.firestore.FieldValue.increment(roundedAmount);
  if (roundedAmount < 0) update.totalSpent  = firebase.firestore.FieldValue.increment(Math.abs(roundedAmount));

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
 * Create a new match.
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

  const hostPlayer = {
    uid:         hostUser.uid,
    displayName: hostUser.displayName,
    photoURL:    hostUser.photoURL || '',
    isHost:      true,
  };

  const matchRef = await db.collection('matches').add({
    title,
    size,
    mode,
    wager,
    maxPlayers,
    players:    [hostPlayer],
    playerUids: [hostUser.uid],
    status:     'waiting', // waiting | in_progress | completed
    createdBy:  hostUser.uid,
    hostName:   hostUser.displayName,
    code,
    prizePool:  wager,
    winner:     null,
    createdAt:  firebase.firestore.FieldValue.serverTimestamp(),
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

  if (snap.empty) throw new Error('Match not found or already started');

  const matchDoc = snap.docs[0];
  const match    = matchDoc.data();
  const wager    = Number(match.wager);

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
 * Subscribe to open (status=waiting) matches in real-time.
 * In-memory sort avoids composite index requirement.
 */
function subscribeOpenMatches(callback) {
  return db.collection('matches')
    .where('status', '==', 'waiting')
    .onSnapshot((snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
