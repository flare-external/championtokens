// ============================================================
//  CHAMPION TOKENS — Cloudflare Pages Native Function (Discord Auth)
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

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    let body = {};
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON request body' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { code, redirectUri } = body;
    if (!code || !redirectUri) {
      return new Response(JSON.stringify({ error: 'Missing code or redirectUri' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const clientSecret = env.DISCORD_CLIENT_SECRET;
    if (!clientSecret) {
      return new Response(JSON.stringify({ error: 'Missing DISCORD_CLIENT_SECRET in Cloudflare environment variables' }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    // 1. Exchange OAuth code for Discord Access Token
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: '1540084692873912470',
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || tokenData.error) {
      console.error('Discord token exchange error:', tokenData);
      return new Response(JSON.stringify({ error: tokenData.error_description || tokenData.error || 'Discord auth failed' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // 2. Fetch Discord Profile
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const discordUser = await userRes.json();
    if (!discordUser.id) {
      return new Response(JSON.stringify({ error: 'Failed to fetch Discord user profile' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const uid = `discord:${discordUser.id}`;
    const displayName = discordUser.global_name || discordUser.username;
    const photoURL = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=128`
      : `https://cdn.discordapp.com/embed/avatars/${Number(discordUser.id) % 6}.png`;

    // 3. Generate Firebase Custom Token
    let rawServiceAccount = env.FIREBASE_SERVICE_ACCOUNT;
    if (!rawServiceAccount) {
      return new Response(JSON.stringify({ error: 'Missing FIREBASE_SERVICE_ACCOUNT in Cloudflare environment variables' }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    let serviceAccount;
    try {
      const jsonStr = rawServiceAccount.trim().startsWith('{')
        ? rawServiceAccount
        : atob(rawServiceAccount);
      serviceAccount = JSON.parse(jsonStr);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Failed to parse FIREBASE_SERVICE_ACCOUNT: ' + e.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const token = await createFirebaseCustomToken(serviceAccount, uid, {
      discordId: discordUser.id,
      displayName,
    });

    return new Response(JSON.stringify({
      token,
      user: {
        uid,
        displayName,
        photoURL,
        email: discordUser.email || '',
        discordId: discordUser.id,
        discordUsername: discordUser.username,
      },
    }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err) {
    console.error('Cloudflare discordAuth error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
