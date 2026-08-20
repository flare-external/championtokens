// ============================================================
//  CHAMPION TOKENS — Authentication Helpers (Discord OAuth)
// ============================================================

/**
 * Build the Discord OAuth redirect URL and navigate there.
 * Discord will redirect back to /callback.html?code=...
 */
function signInWithDiscord() {
  const redirectUri = getRedirectUri();
  const params = new URLSearchParams({
    client_id:     DISCORD_CLIENT_ID,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         'identify email',
  });
  window.location.href = `https://discord.com/api/oauth2/authorize?${params}`;
}

/**
 * Build the Epic Games OAuth redirect URL and navigate there.
 * Epic will redirect back to /epic-callback?code=...
 */
function signInWithEpic() {
  const clientId = 'xyza78916i52N8UrLv1m41xvkgeBXfUh';
  const redirectUri = encodeURIComponent(`${window.location.origin}/epic-callback`);
  window.location.href = `https://www.epicgames.com/id/authorize?client_id=${clientId}&response_type=code&scope=basic_profile&redirect_uri=${redirectUri}`;
}

/** The OAuth redirect URI — must match what's set in Discord Developer Portal */
function getRedirectUri() {
  const base = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '');
  return base + '/callback.html';
}

/** Sign out of Firebase */
function signOut() {
  return auth.signOut();
}

/**
 * Sign in as a temporary Guest / Tester account with full functionality.
 */
async function signInAsGuest() {
  try {
    const cred = await auth.signInAnonymously();
    const user = cred.user;
    const guestNumber = Math.floor(1000 + Math.random() * 9000);
    const guestName = `Guest_${guestNumber}`;

    const userRef = db.collection('users').doc(user.uid);
    const snap = await userRef.get();

    if (!snap.exists) {
      await userRef.set({
        uid:             user.uid,
        discordId:       `guest_${guestNumber}`,
        discordUsername: guestName.toLowerCase(),
        displayName:     guestName,
        photoURL:        null,
        tokens:          10.00,
        totalEarned:     10.00,
        totalSpent:      0.00,
        matchesPlayed:   0,
        matchesWon:      0,
        isGuest:         true,
        epicUsername:    `GuestEpic_${guestNumber}`,
        createdAt:       firebase.firestore.FieldValue.serverTimestamp(),
      });

      // Initial free beta tokens transaction
      await db.collection('transactions').add({
        userId:      user.uid,
        amount:      10.00,
        type:        'signup_bonus',
        description: '🎁 10.00 Free Starter Tokens for Guest Tester',
        timestamp:   firebase.firestore.FieldValue.serverTimestamp(),
      });
    }

    window.location.href = 'dashboard';
    return user;
  } catch (err) {
    console.error('Guest login error:', err);
    alert('Guest login error: ' + err.message);
  }
}

/**
 * Exchange a Discord OAuth code for a Firebase custom token via Cloud Function,
 * then sign in to Firebase.
 * Returns the Firebase user.
 */
async function exchangeDiscordCode(code) {
  const redirectUri = getRedirectUri();

  const response = await fetch(CLOUD_FUNCTION_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ code, redirectUri }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${response.status}`);
  }

  const { token } = await response.json();
  const cred = await auth.signInWithCustomToken(token);
  return cred.user;
}

/**
 * Require auth on a protected page.
 * Redirects to index.html if the user is not signed in.
 * Returns a Promise that resolves with the Firebase user.
 */
function requireAuth(redirectTo = 'index.html') {
  return new Promise((resolve) => {
    auth.onAuthStateChanged((user) => {
      if (!user) {
        window.location.href = redirectTo;
      } else {
        resolve(user);
      }
    });
  });
}

/** Admin Discord IDs list */
const ADMIN_DISCORD_IDS = ['1121188319410278420'];

/**
 * Check if the given user is an administrator
 */
function isAdminUser(user, userData = null) {
  if (!user && !userData) return false;
  const uid = user?.uid || userData?.uid || '';
  const discordId = userData?.discordId || uid.replace('discord:', '');
  return ADMIN_DISCORD_IDS.includes(discordId) || userData?.isAdmin === true;
}

/**
 * Redirect already-signed-in users away from the landing page.
 */
function redirectIfAuthed(redirectTo = 'dashboard') {
  auth.onAuthStateChanged((user) => {
    if (user) window.location.href = redirectTo;
  });
}
