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
  const clientId = 'xyza7891U2d0FjPqXn4L1vR8';
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
