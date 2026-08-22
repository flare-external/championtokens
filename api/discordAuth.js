const admin = require('firebase-admin');

function getFirebaseAdmin() {
  if (!admin.apps.length) {
    const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!rawServiceAccount) {
      throw new Error('Missing FIREBASE_SERVICE_ACCOUNT environment variable');
    }

    let serviceAccount;
    try {
      const jsonString = rawServiceAccount.trim().startsWith('{')
        ? rawServiceAccount
        : Buffer.from(rawServiceAccount, 'base64').toString('utf-8');
      serviceAccount = JSON.parse(jsonString);
    } catch (parseErr) {
      throw new Error('Failed to parse FIREBASE_SERVICE_ACCOUNT JSON: ' + parseErr.message);
    }

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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let bodyData = {};
  try {
    bodyData = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const { code, redirectUri } = bodyData;
  if (!code || !redirectUri) {
    return res.status(400).json({ error: 'Missing code or redirectUri' });
  }

  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientSecret) {
    return res.status(500).json({ error: 'Missing DISCORD_CLIENT_SECRET environment variable' });
  }

  try {
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
      return res.status(400).json({ error: tokenData.error_description || tokenData.error || 'Discord auth failed' });
    }

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const discordUser = await userRes.json();

    if (!discordUser.id) {
      return res.status(400).json({ error: 'Failed to fetch Discord user profile' });
    }

    const { db, admin } = getFirebaseAdmin();

    const uid         = `discord:${discordUser.id}`;
    const displayName = discordUser.global_name || discordUser.username;
    const photoURL    = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=128`
      : `https://cdn.discordapp.com/embed/avatars/${Number(discordUser.id) % 6}.png`;

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
        tokens:          10.00,
        totalEarned:     10.00,
        totalSpent:      0.00,
        matchesPlayed:   0,
        matchesWon:      0,
        createdAt:       admin.firestore.FieldValue.serverTimestamp(),
        lastLoginAt:     admin.firestore.FieldValue.serverTimestamp(),
      });

      await db.collection('transactions').add({
        userId:      uid,
        amount:      10.00,
        type:        'bonus',
        description: '🎉 Welcome bonus (10.00 Starter Tokens)',
        timestamp:   admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      // Returning user — preserve tokens, matches, earnings. Only refresh profile display fields.
      const updates = {
        displayName,
        photoURL,
        discordUsername: discordUser.username,
        lastLoginAt:     admin.firestore.FieldValue.serverTimestamp(),
      };
      if (discordUser.email) {
        updates.email = discordUser.email;
      }
      await userRef.update(updates);
    }

    const firebaseToken = await admin.auth().createCustomToken(uid, {
      discordId: discordUser.id,
      displayName,
    });

    return res.status(200).json({ token: firebaseToken, user: { uid, displayName, photoURL } });
  } catch (err) {
    console.error('api/discordAuth error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
