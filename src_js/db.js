// ============================================================
//  CHAMPION TOKENS — Database / Firestore Helpers
// ============================================================

// ── Utility Helpers ───────────────────────────────────────────

/**
 * Returns 12 featured daily shop PFPs (2 full rows of 6):
 * 4 Exclusive, 4 Epic, 2 Rare, 2 Uncommon (12 total).
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

  const pickedExclusive = pickRandomN(exclusives, 4, seed + 1);
  const pickedEpic = pickRandomN(epics, 4, seed + 2);
  const pickedRare = pickRandomN(rares, 2, seed + 3);
  const pickedUncommon = pickRandomN(uncommons, 2, seed + 4);

  return [...pickedExclusive, ...pickedEpic, ...pickedRare, ...pickedUncommon];
}

/**
 * Returns 12 featured daily shop Titles (2 full rows of 6):
 * 4 Exclusive, 4 Epic, 2 Rare, 2 Uncommon (12 total).
 */
function getDailyShopTitles() {
  const now = new Date();
  const dateKey = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
  
  let seed = 0;
  for (let i = 0; i < dateKey.length; i++) {
    seed = (seed * 37 + dateKey.charCodeAt(i)) >>> 0;
  }

  if (typeof SHOP_TITLES === 'undefined') return [];
  const allTitles = Object.values(SHOP_TITLES);
  const exclusives = allTitles.filter(t => t.rarity === 'Exclusive');
  const epics = allTitles.filter(t => t.rarity === 'Epic');
  const rares = allTitles.filter(t => t.rarity === 'Rare');
  const uncommons = allTitles.filter(t => t.rarity === 'Uncommon');

  function pickRandomN(arr, n, subSeed) {
    const copy = [...arr];
    const picked = [];
    for (let i = 0; i < n && copy.length > 0; i++) {
      const idx = Math.floor(seededRandom(subSeed + i * 17) * copy.length);
      picked.push(copy[idx]);
      copy.splice(idx, 1);
    }
    return picked;
  }

  const pickedExclusive = pickRandomN(exclusives, 4, seed + 10);
  const pickedEpic = pickRandomN(epics, 4, seed + 20);
  const pickedRare = pickRandomN(rares, 2, seed + 30);
  const pickedUncommon = pickRandomN(uncommons, 2, seed + 40);

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
