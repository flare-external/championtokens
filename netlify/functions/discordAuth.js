// ============================================================
//  CHAMPION TOKENS — Netlify Serverless Function
//  Handles Discord OAuth2 → Firebase Custom Token
//  Free on Netlify (125k calls/month)
// ============================================================

const admin = require('firebase-admin');

const HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function getFirebaseAdmin() {
  if (!admin.apps.length) {
    const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!rawServiceAccount) {
      throw new Error('Missing FIREBASE_SERVICE_ACCOUNT environment variable in Netlify');
    }

    let serviceAccount;
    try {
      // Handle either raw JSON string or base64 encoded JSON
      const jsonString = rawServiceAccount.trim().startsWith('{')
        ? rawServiceAccount
        : Buffer.from(rawServiceAccount, 'base64').toString('utf-8');
      serviceAccount = JSON.parse(jsonString);
    } catch (parseErr) {
      throw new Error('Failed to parse FIREBASE_SERVICE_ACCOUNT JSON: ' + parseErr.message);
    }

    // Fix potential newline issues in private_key if passed as string
    if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId:  serviceAccount.project_id || 'champion-tokens',
    });
  }
  return {
    admin,
    db: admin.firestore(),
  };
}

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let code, redirectUri;
  try {
    ({ code, redirectUri } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (!code || !redirectUri) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Missing code or redirectUri' }) };
  }

  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientSecret) {
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ error: 'Missing DISCORD_CLIENT_SECRET in Netlify environment variables' }),
    };
  }

  try {
    // ── Step 1: Exchange Discord code for access token ─────
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     '1540084692873912470',
        client_secret: clientSecret,
        grant_type:    'authorization_code',
        code,
        redirect_uri:  redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      console.error('Discord token exchange error:', tokenData);
      return {
        statusCode: 400,
        headers:    HEADERS,
        body:       JSON.stringify({ error: tokenData.error_description || tokenData.error || 'Discord auth failed' }),
      };
    }

    // ── Step 2: Get Discord user profile ──────────────────
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const discordUser = await userRes.json();

    if (!discordUser.id) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Failed to fetch Discord user profile' }) };
    }

    // ── Step 3: Initialize Firebase Admin ─────────────────
    const { db } = getFirebaseAdmin();

    const uid         = `discord:${discordUser.id}`;
    const displayName = discordUser.global_name || discordUser.username;
    const photoURL    = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=128`
      : `https://cdn.discordapp.com/embed/avatars/${Number(discordUser.id) % 6}.png`;

    // ── Step 4: Create/update Firestore user doc ──────────
    const userRef = db.collection('users').doc(uid);
    const snap    = await userRef.get();

    if (!snap.exists) {
      await userRef.set({
        uid,
        displayName,
        email:           discordUser.email || '',
        photoURL,
        discordId:       discordUser.id,
        discordUsername: discordUser.username,
        tokens:          500,
        totalEarned:     500,
        totalSpent:      0,
        matchesPlayed:   0,
        matchesWon:      0,
        createdAt:       admin.firestore.FieldValue.serverTimestamp(),
        lastDailyClaim:  null,
      });

      await db.collection('transactions').add({
        userId:      uid,
        amount:      500,
        type:        'bonus',
        description: '🎉 Welcome bonus',
        timestamp:   admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      await userRef.update({ displayName, photoURL });
    }

    // ── Step 5: Issue Firebase custom token ───────────────
    const firebaseToken = await admin.auth().createCustomToken(uid, {
      discordId: discordUser.id,
      displayName,
    });

    return {
      statusCode: 200,
      headers:    HEADERS,
      body:       JSON.stringify({ token: firebaseToken, user: { uid, displayName, photoURL } }),
    };

  } catch (err) {
    console.error('discordAuth error:', err);
    return {
      statusCode: 500,
      headers:    HEADERS,
      body:       JSON.stringify({ error: err.message || 'Internal server error' }),
    };
  }
};
