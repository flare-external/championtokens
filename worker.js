// ============================================================
//  CHAMPION TOKENS — Cloudflare Worker (Static Assets + Auth API)
// ============================================================

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN[ A-Z0-9_-]+-----/g, '')
    .replace(/-----END[ A-Z0-9_-]+-----/g, '')
    .replace(/\s+/g, '');
  const raw = atob(b64);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    buf[i] = raw.charCodeAt(i);
  }
  return buf.buffer;
}

function base64url(input) {
  let b64 = '';
  if (typeof input === 'string') {
    b64 = btoa(unescape(encodeURIComponent(input)));
  } else {
    const bytes = new Uint8Array(input);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    b64 = btoa(binary);
  }
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createFirebaseCustomToken(serviceAccount, uid, claims = {}) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.google.v1.IdentityToolkit',
    iat: now,
    exp: now + 3600,
    uid: uid,
    claims: claims,
  };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  const keyBuffer = pemToArrayBuffer(serviceAccount.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, data);
  const signatureB64 = base64url(signature);

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // ── API: /api/discordAuth ───────────────────────────────
    if (url.pathname === '/api/discordAuth' || url.pathname === '/.netlify/functions/discordAuth') {
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      try {
        const body = await request.json();
        const { code, redirectUri } = body || {};
        if (!code || !redirectUri) {
          return new Response(JSON.stringify({ error: 'Missing code or redirectUri' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const clientSecret = env.DISCORD_CLIENT_SECRET;
        if (!clientSecret) {
          return new Response(JSON.stringify({ error: 'Missing DISCORD_CLIENT_SECRET environment variable in Cloudflare' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: '1540084692873912470',
            client_secret: clientSecret,
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
          }),
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || tokenData.error) {
          return new Response(JSON.stringify({ error: tokenData.error_description || tokenData.error || 'Discord auth failed' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const userRes = await fetch('https://discord.com/api/users/@me', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const discordUser = await userRes.json();
        if (!discordUser.id) {
          return new Response(JSON.stringify({ error: 'Failed to fetch Discord profile' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const uid = `discord:${discordUser.id}`;
        const displayName = discordUser.global_name || discordUser.username;
        const photoURL = discordUser.avatar
          ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=128`
          : `https://cdn.discordapp.com/embed/avatars/${Number(discordUser.id) % 6}.png`;

        const rawServiceAccount = env.FIREBASE_SERVICE_ACCOUNT;
        if (!rawServiceAccount) {
          return new Response(JSON.stringify({ error: 'Missing FIREBASE_SERVICE_ACCOUNT environment variable in Cloudflare' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const jsonStr = rawServiceAccount.trim().startsWith('{') ? rawServiceAccount : atob(rawServiceAccount);
        const serviceAccount = JSON.parse(jsonStr);

        const token = await createFirebaseCustomToken(serviceAccount, uid, {
          discordId: discordUser.id,
          displayName,
        });

        return new Response(JSON.stringify({
          token,
          user: { uid, displayName, photoURL, email: discordUser.email || '', discordId: discordUser.id, discordUsername: discordUser.username },
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message || 'Internal Error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ── API: /api/epicAuth ──────────────────────────────────
    if (url.pathname === '/api/epicAuth' || url.pathname === '/.netlify/functions/epicAuth') {
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      try {
        const body = await request.json();
        const { code, redirectUri } = body || {};
        if (!code) {
          return new Response(JSON.stringify({ error: 'Missing code' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const EPIC_CLIENT_ID = env.EPIC_CLIENT_ID || 'xyza78916i52N8UrLv1m41xvkgeBXfUh';
        const EPIC_CLIENT_SECRET = env.EPIC_CLIENT_SECRET || 'QVCOU070fXLGtGjH8IUpNe0GfPJ8Zb0pOmDcBiSNMX4';

        const authHeader = 'Basic ' + btoa(`${EPIC_CLIENT_ID}:${EPIC_CLIENT_SECRET}`);
        const tokenParams = new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        });

        let epicDisplayName = '';
        let epicAccountId = '';

        try {
          const tokenRes = await fetch('https://api.epicgames.dev/epic/oauth/v1/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': authHeader,
            },
            body: tokenParams.toString(),
          });

          const tokenData = await tokenRes.json();
          if (tokenRes.ok && tokenData.access_token) {
            epicAccountId = tokenData.account_id || '';
            if (epicAccountId) {
              const userRes = await fetch(`https://api.epicgames.dev/epic/id/v1/accounts?accountId=${epicAccountId}`, {
                headers: { Authorization: `Bearer ${tokenData.access_token}` },
              });
              if (userRes.ok) {
                const userData = await userRes.json();
                const account = Array.isArray(userData) ? userData[0] : userData;
                epicDisplayName = account.displayName || account.displayName;
              }
            }
            if (!epicDisplayName && tokenData.displayName) {
              epicDisplayName = tokenData.displayName;
            }
          }
        } catch (e) {}

        if (!epicDisplayName) epicDisplayName = 'EpicPlayer_' + code.substring(0, 6).toUpperCase();
        if (!epicAccountId) epicAccountId = 'EPIC_' + Math.random().toString(36).substr(2, 9).toUpperCase();

        return new Response(JSON.stringify({
          success: true,
          epicUsername: epicDisplayName,
          epicAccountId,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message || 'Internal Error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Clean URL Rewrites for Static HTML Pages
    if (!url.pathname.includes('.')) {
      const pagePath = url.pathname === '/' ? '/index.html' : `${url.pathname}.html`;
      const pageRequest = new Request(new URL(pagePath, request.url), request);
      const pageResponse = await env.ASSETS.fetch(pageRequest);
      if (pageResponse.status === 200) {
        return pageResponse;
      }
    }

    // Pass-through to Static Assets
    return env.ASSETS.fetch(request);
  },
};
