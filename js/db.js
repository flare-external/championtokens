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
 * @param {string} type    'bonus' | 'daily' | 'match_wager' | 'match_win' | 'purchase' | 'admin'
 * @param {string} description
 */
async function updateTokens(uid, amount, type, description) {
  const userRef = db.collection('users').doc(uid);
  const update  = {
    tokens: firebase.firestore.FieldValue.increment(amount),
  };
  if (amount > 0) update.totalEarned = firebase.firestore.FieldValue.increment(amount);
  if (amount < 0) update.totalSpent  = firebase.firestore.FieldValue.increment(Math.abs(amount));

  await userRef.update(update);

  await db.collection('transactions').add({
    userId:      uid,
    amount,
    type,
    description,
    timestamp:   firebase.firestore.FieldValue.serverTimestamp(),
  });
}

// ── Daily Claim ──────────────────────────────────────────────

/** Claim 100 daily tokens. Throws if not yet 24h since last claim. */
async function claimDailyTokens(uid) {
  const user = await getUser(uid);
  const now  = new Date();

  if (user.lastDailyClaim) {
    const last      = user.lastDailyClaim.toDate();
    const diffHours = (now - last) / 3_600_000;
    if (diffHours < 24) {
      const hoursLeft = Math.ceil(24 - diffHours);
      throw new Error(`Come back in ${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}`);
    }
  }

  await db.collection('users').doc(uid).update({
    tokens:         firebase.firestore.FieldValue.increment(100),
    totalEarned:    firebase.firestore.FieldValue.increment(100),
    lastDailyClaim: firebase.firestore.FieldValue.serverTimestamp(),
  });

  await db.collection('transactions').add({
    userId:      uid,
    amount:      100,
    type:        'daily',
    description: '🎁 Daily token claim',
    timestamp:   firebase.firestore.FieldValue.serverTimestamp(),
  });

  return 100;
}

// ── Matches ──────────────────────────────────────────────────

/** Generate a random 6-character match code */
function generateMatchCode() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

/**
 * Create a new match. Deducts wager from host.
 * Returns { id, code }
 */
async function createMatch(hostUser, matchData) {
  if (hostUser.tokens < matchData.wager) {
    throw new Error('Insufficient tokens to create this match');
  }
  const code = generateMatchCode();

  const matchRef = await db.collection('matches').add({
    title:      matchData.title,
    mode:       matchData.mode,       // 'Solo' | 'Duos' | 'Squads'
    wager:      matchData.wager,
    maxPlayers: matchData.maxPlayers,
    players: [{
      uid:         hostUser.uid,
      displayName: hostUser.displayName,
      photoURL:    hostUser.photoURL || '',
      isHost:      true,
    }],
    status:      'waiting',           // waiting | in_progress | completed
    createdBy:   hostUser.uid,
    hostName:    hostUser.displayName,
    code,
    prizePool:   matchData.wager,
    winner:      null,
    createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
    completedAt: null,
  });

  // Hold the host's wager
  await updateTokens(
    hostUser.uid,
    -matchData.wager,
    'match_wager',
    `🎮 Match wager — "${matchData.title}"`
  );

  return { id: matchRef.id, code };
}

/**
 * Join a match by its 6-character code.
 * Returns the match document ID.
 */
async function joinMatch(code, joiningUser) {
  const snap = await db.collection('matches')
    .where('code',   '==', code.toUpperCase())
    .where('status', '==', 'waiting')
    .limit(1)
    .get();

  if (snap.empty) throw new Error('Match not found or already started');

  const matchDoc = snap.docs[0];
  const match    = matchDoc.data();

  if (match.players.length >= match.maxPlayers)
    throw new Error('This match is full');
  if (match.players.find(p => p.uid === joiningUser.uid))
    throw new Error('You are already in this match');
  if (joiningUser.tokens < match.wager)
    throw new Error('Insufficient tokens to join');

  const newPlayer = {
    uid:         joiningUser.uid,
    displayName: joiningUser.displayName,
    photoURL:    joiningUser.photoURL || '',
    isHost:      false,
  };

  await matchDoc.ref.update({
    players:    firebase.firestore.FieldValue.arrayUnion(newPlayer),
    playerUids: firebase.firestore.FieldValue.arrayUnion(joiningUser.uid),
    prizePool:  firebase.firestore.FieldValue.increment(match.wager),
  });

  await updateTokens(
    joiningUser.uid,
    -match.wager,
    'match_wager',
    `🎮 Joined match — "${match.title}"`
  );

  return matchDoc.id;
}

/**
 * Subscribe to open (status=waiting) matches in real-time.
 * Returns the Firestore unsubscribe function.
 */
function subscribeOpenMatches(callback) {
  return db.collection('matches')
    .where('status', '==', 'waiting')
    .orderBy('createdAt', 'desc')
    .limit(20)
    .onSnapshot(callback);
}

/**
 * Subscribe to all matches a user is a player in.
 * Note: Firestore doesn't support array-contains with objects natively;
 * we track participation via a separate index field `playerUids`.
 * We add uid to playerUids on create/join so we can query here.
 */
function subscribeUserMatches(uid, callback) {
  return db.collection('matches')
    .where('playerUids', 'array-contains', uid)
    .orderBy('createdAt', 'desc')
    .limit(10)
    .onSnapshot(callback);
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

  const prize = Math.floor(match.prizePool * 0.9); // 10% fee

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

/** Start a match (host only) */
async function startMatch(matchId, hostUid) {
  const matchRef  = db.collection('matches').doc(matchId);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) throw new Error('Match not found');
  const match = matchSnap.data();
  if (match.createdBy !== hostUid) throw new Error('Only the host can start the match');
  await matchRef.update({ status: 'in_progress' });
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
    .orderBy('timestamp', 'desc')
    .limit(limitCount)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
