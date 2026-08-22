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
 * Open the official Epic Games account linking OAuth flow.
 */
function signInWithEpic() {
  startEpicOAuth();
}

/**
 * Get canonical Epic OAuth redirect URI.
 */
function getEpicRedirectUri() {
  const host = window.location.hostname.toLowerCase();
  if (host === 'championtokens.fun' || host === 'www.championtokens.fun' || host.includes('netlify.app')) {
    return 'https://championtokens.fun/epic-callback';
  }
  let origin = window.location.origin;
  if (!origin.includes('localhost') && !origin.includes('127.0.0.1')) {
    origin = origin.replace(/^http:/, 'https:');
  }
  return `${origin}/epic-callback`;
}

/**
 * Initiate official published Epic Games OAuth 2.0 flow.
 */
function startEpicOAuth(uidOverride) {
  const clientId = 'xyza78916i52N8UrLv1m41xvkgeBXfUh';
  const redirectUri = encodeURIComponent(getEpicRedirectUri());
  const uid = uidOverride || (auth.currentUser ? auth.currentUser.uid : (typeof currentUser !== 'undefined' && currentUser ? currentUser.uid : ''));
  let state = '';
  if (uid) {
    state = encodeURIComponent(btoa(JSON.stringify({ uid: uid })));
    try { localStorage.setItem('ct_epic_linking_uid', uid); } catch (e) {}
  }
  const epicAuthUrl = `https://www.epicgames.com/id/authorize?client_id=${clientId}&response_type=code&scope=basic_profile&redirect_uri=${redirectUri}${state ? `&state=${state}` : ''}`;
  window.location.href = epicAuthUrl;
}

/** The OAuth redirect URI — must match what's set in Discord Developer Portal */
function getRedirectUri() {
  let origin = window.location.origin;
  if (!origin.includes('localhost') && !origin.includes('127.0.0.1')) {
    origin = origin.replace(/^http:/, 'https:');
  }
  return origin + '/callback.html';
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
  const endpoints = [
    'https://us-central1-champion-tokens.cloudfunctions.net/discordAuth',
    '/.netlify/functions/discordAuth',
    '/api/discordAuth'
  ];

  let lastError = null;
  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ code, redirectUri }),
        signal:  controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          const cred = await auth.signInWithCustomToken(data.token);
          return cred.user;
        }
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Authentication server is connecting, please retry.');
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
  if (user?.isAnonymous || userData?.isGuest === true || uid.startsWith('guest_') || discordId.startsWith('guest_')) {
    return false;
  }
  return ADMIN_DISCORD_IDS.includes(discordId) || (userData?.isAdmin === true && !userData?.isGuest);
}

/**
 * Redirect already-signed-in users away from the landing page.
 */
function redirectIfAuthed(redirectTo = 'dashboard') {
  auth.onAuthStateChanged((user) => {
    if (user) window.location.href = redirectTo;
  });
}
