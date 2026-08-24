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
 * Pass forceRelink=true to bypass the "already linked" guard.
 */
function startEpicOAuth(uidOverride, forceRelink = false) {
  // Guard: if already linked, don't allow re-OAuth unless force-relinking after unlink
  if (!forceRelink && typeof currentUserData !== 'undefined' && currentUserData?.epicUsername) {
    if (typeof showToast === 'function') {
      showToast('Epic account already linked. Unlink first to change accounts.', 'info');
    }
    return;
  }
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

/**
 * Canonical redirect URI for Social Account linking (Twitch / X).
 */
function getSocialRedirectUri() {
  const host = window.location.hostname.toLowerCase();
  if (host === 'championtokens.fun' || host === 'www.championtokens.fun' || host.includes('netlify.app')) {
    return 'https://championtokens.fun/social-callback';
  }
  let origin = window.location.origin;
  if (!origin.includes('localhost') && !origin.includes('127.0.0.1')) {
    origin = origin.replace(/^http:/, 'https:');
  }
  return `${origin}/social-callback`;
}

/**
 * Initiate official Twitch OAuth flow to verify and connect Twitch account.
 */
function startTwitchOAuth(uidOverride) {
  const uid = uidOverride || (auth.currentUser ? auth.currentUser.uid : (typeof currentUser !== 'undefined' && currentUser ? currentUser.uid : ''));
  if (!uid) {
    if (typeof showToast === 'function') showToast('Please log in to Champion Tokens first', 'error');
    return;
  }

  const clientId = 'champion_tokens_twitch';
  const redirectUri = encodeURIComponent(getSocialRedirectUri());
  const state = encodeURIComponent(btoa(JSON.stringify({ platform: 'twitch', uid })));

  try {
    localStorage.setItem('ct_social_linking_platform', 'twitch');
    localStorage.setItem('ct_social_linking_uid', uid);
  } catch (e) {}

  const twitchAuthUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=user:read:email&state=${state}&force_verify=true`;
  window.location.href = twitchAuthUrl;
}

/**
 * Initiate official X OAuth 2.0 PKCE flow to verify and connect X account.
 */
function startXOAuth(uidOverride) {
  const uid = uidOverride || (auth.currentUser ? auth.currentUser.uid : (typeof currentUser !== 'undefined' && currentUser ? currentUser.uid : ''));
  if (!uid) {
    if (typeof showToast === 'function') showToast('Please log in to Champion Tokens first', 'error');
    return;
  }

  const clientId = 'champion_tokens_x';
  const redirectUri = encodeURIComponent(getSocialRedirectUri());
  const state = encodeURIComponent(btoa(JSON.stringify({ platform: 'x', uid })));
  const codeVerifier = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);

  try {
    localStorage.setItem('ct_social_linking_platform', 'x');
    localStorage.setItem('ct_social_linking_uid', uid);
    localStorage.setItem('ct_x_code_verifier', codeVerifier);
  } catch (e) {}

  const xAuthUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=users.read%20tweet.read&state=${state}&code_challenge=${codeVerifier}&code_challenge_method=plain`;
  window.location.href = xAuthUrl;
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
    '/api/discordAuth',
    'https://championtokens.fun/api/discordAuth',
    'https://championtokens.netlify.app/.netlify/functions/discordAuth'
  ];

  let lastError = null;
  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
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
          const uInfo = data.user || {};
          const realName = uInfo.displayName || uInfo.discordUsername || 'Player';

          // Cache Discord profile locally
          try {
            if (data.user) {
              localStorage.setItem('ct_cached_discord_user', JSON.stringify(data.user));
            }
          } catch (e) {}

          // Update client auth user profile
          try {
            if (cred.user && cred.user.updateProfile) {
              await cred.user.updateProfile({
                displayName: realName,
                photoURL: uInfo.photoURL || ''
              });
            }
          } catch (e) {}

          // Sync into Firestore user record
          try {
            if (typeof db !== 'undefined' && cred.user) {
              const userRef = db.collection('users').doc(cred.user.uid);
              const snap = await userRef.get();
              if (!snap.exists) {
                await userRef.set({
                  uid: cred.user.uid,
                  displayName: realName,
                  email: uInfo.email || cred.user.email || '',
                  photoURL: uInfo.photoURL || cred.user.photoURL || '',
                  discordId: uInfo.discordId || cred.user.uid.replace('discord:', ''),
                  discordUsername: uInfo.discordUsername || '',
                  tokens: 10.00,
                  totalEarned: 10.00,
                  totalSpent: 0.00,
                  matchesPlayed: 0,
                  matchesWon: 0,
                  createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                  lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
                });
                await db.collection('transactions').add({
                  userId: cred.user.uid,
                  amount: 10.00,
                  type: 'bonus',
                  description: '🎉 Welcome bonus (10.00 Starter Tokens)',
                  timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                });
              } else {
                const existing = snap.data() || {};
                const updates = {
                  lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
                };
                if (!existing.displayName || existing.displayName === 'Champion' || existing.displayName === 'Player') {
                  updates.displayName = realName;
                }
                if (uInfo.discordUsername && !existing.discordUsername) {
                  updates.discordUsername = uInfo.discordUsername;
                }
                if (uInfo.discordId && !existing.discordId) {
                  updates.discordId = uInfo.discordId;
                }
                if (uInfo.photoURL && (!existing.photoURL || existing.photoURL.includes('default'))) {
                  updates.photoURL = uInfo.photoURL;
                }
                await userRef.update(updates);
              }
            }
          } catch (dbErr) {
            console.warn('Firestore sync notice:', dbErr);
          }

          // Mark sync version as up to date
          try {
            localStorage.setItem('ct_auth_sync_v', AUTH_SYNC_VERSION);
          } catch (e) {}

          return cred.user;
        }
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Authentication server is connecting, please retry.');
}

/** One-time session sync version key */
const AUTH_SYNC_VERSION = '2026_08_23_resync_v3';

/**
 * Require auth on a protected page.
 * Redirects to index.html if the user is not signed in.
 * Returns a Promise that resolves with the Firebase user.
 */
function requireAuth(redirectTo = 'index.html') {
  return new Promise((resolve) => {
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = redirectTo;
        return;
      }

      // One-time session reset to re-fetch Discord profile, username, and avatar
      try {
        const currentVer = localStorage.getItem('ct_auth_sync_v');
        if (currentVer !== AUTH_SYNC_VERSION) {
          localStorage.setItem('ct_auth_sync_v', AUTH_SYNC_VERSION);
          await auth.signOut();
          window.location.href = redirectTo + (redirectTo.includes('?') ? '&' : '?') + 'resync=1';
          return;
        }
      } catch (e) {}

      resolve(user);
    });
  });
}

/** Platform Owner / Highest Admin Discord ID & UID */
const OWNER_DISCORD_ID = '1121188319410278420';
const OWNER_UID = 'discord:1121188319410278420';

/** Admin Discord IDs list */
const ADMIN_DISCORD_IDS = ['1121188319410278420'];

/**
 * Check if the given user is the Platform Owner / Highest Admin
 */
function isOwnerUser(user, userData = null) {
  if (!user && !userData) return false;
  const uid = user?.uid || userData?.uid || userData?.id || '';
  const discordId = userData?.discordId || (uid.startsWith('discord:') ? uid.replace('discord:', '') : '');
  return discordId === OWNER_DISCORD_ID || uid === OWNER_UID || uid === OWNER_DISCORD_ID;
}

/**
 * Check if the given user is an administrator
 */
function isAdminUser(user, userData = null) {
  if (!user && !userData) return false;
  if (isOwnerUser(user, userData)) return true;
  const uid = user?.uid || userData?.uid || userData?.id || '';
  const discordId = userData?.discordId || (uid.startsWith('discord:') ? uid.replace('discord:', '') : '');
  if (user?.isAnonymous || userData?.isGuest === true || uid.startsWith('guest_') || discordId.startsWith('guest_')) {
    return false;
  }
  return ADMIN_DISCORD_IDS.includes(discordId) || (userData?.isAdmin === true && !userData?.isGuest);
}

/**
 * Redirect already-signed-in users away from the landing page.
 */
function redirectIfAuthed(redirectTo = 'dashboard') {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      try {
        const currentVer = localStorage.getItem('ct_auth_sync_v');
        if (currentVer !== AUTH_SYNC_VERSION) {
          localStorage.setItem('ct_auth_sync_v', AUTH_SYNC_VERSION);
          await auth.signOut();
          return;
        }
      } catch (e) {}
      window.location.href = redirectTo;
    }
  });
}
