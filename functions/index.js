// ============================================================
//  CHAMPION TOKENS — Firebase Cloud Function
//  Handles Discord OAuth2 token exchange securely server-side.
//
//  Deploy:
//    firebase functions:secrets:set DISCORD_CLIENT_SECRET
//    firebase deploy --only functions
// ============================================================

const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

admin.initializeApp();
setGlobalOptions({ region: 'us-central1' });

const DISCORD_CLIENT_SECRET = defineSecret('DISCORD_CLIENT_SECRET');

exports.discordAuth = onRequest(
  { secrets: [DISCORD_CLIENT_SECRET] },
  async (req, res) => {
    // ── CORS ─────────────────────────────────────────────────
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { code, redirectUri } = req.body;
    if (!code || !redirectUri) {
      res.status(400).json({ error: 'Missing code or redirectUri' });
      return;
    }

    try {
      // ── Step 1: Exchange code for Discord access token ────
      const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id:     "1540084692873912470",
          client_secret: DISCORD_CLIENT_SECRET.value(),
          grant_type:    'authorization_code',
          code,
          redirect_uri:  redirectUri,
        }),
      });

      const tokenData = await tokenResponse.json();
      if (tokenData.error) {
        console.error('Discord token error:', tokenData);
        res.status(400).json({ error: tokenData.error_description || 'Discord auth failed' });
        return;
      }

      // ── Step 2: Fetch Discord user profile ────────────────
      const userResponse = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const discordUser = await userResponse.json();

      if (!discordUser.id) {
        res.status(400).json({ error: 'Failed to fetch Discord user' });
        return;
      }

      // ── Step 3: Build user info ───────────────────────────
      const uid         = `discord:${discordUser.id}`;
      const displayName = discordUser.global_name || discordUser.username;
      const photoURL    = discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=128`
        : `https://cdn.discordapp.com/embed/avatars/${Number(discordUser.id) % 6}.png`;

      // ── Step 4: Create/update Firestore user doc ──────────
      const db      = admin.firestore();
      const userRef = db.collection('users').doc(uid);
      const snap    = await userRef.get();

      if (!snap.exists) {
        // First login — create doc with starter bonus
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
        // Returning user — refresh name, avatar, username, lastLoginAt
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

      // ── Step 5: Create Firebase custom token ──────────────
      const firebaseToken = await admin.auth().createCustomToken(uid, {
        discordId:  discordUser.id,
        displayName,
      });

      res.json({
        token: firebaseToken,
        user: { uid, displayName, photoURL },
      });

    } catch (err) {
      console.error('discordAuth error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);
