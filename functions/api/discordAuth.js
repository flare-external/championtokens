// ============================================================
//  CHAMPION TOKENS — Cloudflare Pages Native Function (Discord Auth)
// ============================================================

const DEFAULT_DISCORD_SECRET = "PtbA_jezWa-oZ3VJbJF44kHbjWDWutk4";
const B64_SA = "eyJ0eXBlIjoic2VydmljZV9hY2NvdW50IiwicHJvamVjdF9pZCI6ImNoYW1waW9uLXRva2VucyIsInByaXZhdGVfa2V5X2lkIjoiNmU3ZjM3NzI0OTg1ZWVlZjhmODFhMDQzNzQyZjI5MjllOGQwODdhMiIsInByaXZhdGVfa2V5IjoiLS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tXG5NSUlFdlFJQkFEQU5CZ2txaGtpRzl3MEJBUUVGQUFTQ0JLY3dnZ1NqQWdFQUFvSUJBUUREMjl6bXFTWGZoeEdRXG5tSWt2RVpHUFZ3S2QwdWIrTHZEWlNSOGlCZjBhN3h3MEVuT283NVpJUmhnYnh2L1B4NmRSUmE0UFF6Uk9ab2xwXG5CbE03OFI5cnE1KzY2NE9kakxJaW5yaG9GVTBxaHJQL0Z6TEtYY3E1bVpZbUIwc3J2amgrTnN4T3N0YnRHRWRuXG52ckdmcXM4Uk95Vm4va3VrYk8xeTBlYmVCRThCOWNaWHdhQ25qMDFkQndwc01YdExtYmpqYXlPTXF3WmlmQ0IxXG5GMFdHREsvUjVNY0ZSNUVDUTVaSnZWanpaM3kwZi9DTXJTeisvU09tZExvYlhvTHZzcmRBblcwWHBLMitjcGs0XG5uSEpNMW5zWFYxTmlnZmVRdFhNRUNqV1dONWNybWFxR1A4RTFwVkFZcFQydGorTW01WlNiNkt4eXVPRGtTZHdZXG4xZks0cUJHUkFnTUJBQUVDZ2dFQURCRFhoQnk3eFBCYjJrZnhYSlZWSGFyZk1nU1gveVQ2YUxKbTRQaFVPa1JzXG5mUDg5Z1pUbjhkSWlvbFJ4TmpaUEpoUTRONys4d1U4ekRDV3IrME44bTJ3V1lpUW41cXp3SE82Zy91V0FERnlCXG55bmRlQlVZL3FzMHR5VEEyRnU3b0tVdGNMUVY2dE43RDZGM2dzS3pMeHB5WmpuVmxxTTZlbHE0Y2JrVSs3a2gvXG5jQ0huQkxoM3FNL2tjNk9DdXdVQjlGR21uRGVNaSt1bHEyQ0lka3Ezck5tUUljZmFLQ3plMVZvZ0J0VGplQnBLXG5iSkJoUWJzQTJlczJmc2R3ZkkwaXA2U1pmcmhBaUZIMDZHVkRyeU90Qk9FQnRCQ05WTXN2dWxlblB6MEloZlg0XG5WT1BnZTREaXJiWmFzQU1KU2VESkhpV3RLOE8wenZXcHZSUUkwZnZ0R1FLQmdRRDZ6WTlaVnduTHlSWEtRNVYvXG5nNjBSUnhNT3B6M3FiV0ZVZGtLRmw5a2o4dkpzVXVtc0t1aWFDQllLVHJTY3o4a2RYelhBTEorUWRKNzN3RmFSXG50ZzNzd2FqbkxhdlFoYkIwMXNza08wcHc0MllKWnBRWlRDaitsRld2ZVZEY0xnZEVjS1ZpWTZIYmNYSndIRGNGXG5teGJWM3E1UStINFcreFlYdjNXWGpaODR5UUtCZ1FESDZ0YndPWE15YVdhTHR2UWs1aGxvQUF1Mk5KYWQwM0JZXG5BWE1hdWE0Nzd2bEVVTnpqSnJsYjZKR081TThpb1dIMXpLWFBwcmQ3VDVHdVNhRTZvTDZieTJKK3BqN0JSUy9hXG51azdJamVIYUZzWUFEZWVsSWFwYnFIUmJrc1FiOHUyQk9VZkNLZTJ5QW5LZkFOL3RuaEJ6anRXcGJzN25jc1pNXG5FdEYxTkNJK2lRS0JnQ0U4am91cllpdjBhUVBWOHdEa0JWSnQxZE95VEIwK0E1RDYzeFB2TEtKNzlxNXVTbk03XG5lSG01S3BxUkZaUldZUE9ZZzNvRkw5d242RTB5MndZU1YwUVI0ZjFJNnlVR0luMUpYY0JlYng0SXRLUDRTUllWXG5KcldlR01EWlZlTG40cVNxUFBDTi9Zd2tPNk1weWd6ZklhYVVEUXZEOG9tL0dvMXBIUDlKa0ZrcEFvR0FPWjk4XG4rSnoya1U5RUdYMVFmZG84OUhjZTZSUGJYZjUxNFVmNXIzaFp1amkxYkhXS1ZZYng0b1gwZnFXQTl0QmhkZ0hZXG53VE9pcTA1U0JWUi92bkJhd0hrdEdLZythbUxRMmxEZEtIMk0zZG0ybElsdGZYRm9zeWFvODBRb2RvM2MyMlJ4XG5SSXZsVVd2WE1mR0VtZTczZXZkdXFubWY5YUpsZWNQcXo4ZUpIMUVDZ1lFQWsxSXIwcjVoTkU4RDlUaGVsNWFkXG5UTGlPN2xBcXIvT25CMzJvM1p1Ni9ycnFmc3pPVXR3aldtNHVyWFphTHVka1BqZzhUVXF5L2RGNmNyQlIxM2NrXG5OQ290aUFIZ01pWmZuaVk4cWN4aEx3SHdqaHFuNEN4d09Wak1ySmNCQzRpK2thZktrUE9naDlUUHlSRmFCT2lwXG5xK2N6UEdXYzc2cUdWVEtlMVhkQUcrZz1cbi0tLS0tRU5EIFBSSVZBVEUgS0VZLS0tLS1cbiIsImNsaWVudF9lbWFpbCI6ImZpcmViYXNlLWFkbWluc2RrLWZic3ZjQGNoYW1waW9uLXRva2Vucy5pYW0uZ3NlcnZpY2VhY2NvdW50LmNvbSIsImNsaWVudF9pZCI6IjExMTc1MTYyNTQ4OTgyMDQ0NTE1OCIsImF1dGhfdXJpIjoiaHR0cHM6Ly9hY2NvdW50cy5nb29nbGUuY29tL28vb2F1dGgyL2F1dGgiLCJ0b2tlbl91cmkiOiJodHRwczovL29hdXRoMi5nb29nbGVhcGlzLmNvbS90b2tlbiIsImF1dGhfcHJvdmlkZXJfeDUwOV9jZXJ0X3VybCI6Imh0dHBzOi8vd3d3Lmdvb2dsZWFwaXMuY29tL29hdXRoMi92MS9jZXJ0cyIsImNsaWVudF94NTA5X2NlcnRfdXJsIjoiaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vcm9ib3QvdjEvbWV0YWRhdGEveDUwOS9maXJlYmFzZS1hZG1pbnNkay1mYnN2YyU0MGNoYW1waW9uLXRva2Vucy5pYW0uZ3NlcnZpY2VhY2NvdW50LmNvbSIsInVuaXZlcnNlX2RvbWFpbiI6Imdvb2dsZWFwaXMuY29tIn0=";

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

    const clientSecret = env?.DISCORD_CLIENT_SECRET || DEFAULT_DISCORD_SECRET;

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
    let serviceAccount;
    if (env?.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const raw = env.FIREBASE_SERVICE_ACCOUNT;
        serviceAccount = typeof raw === 'object' ? raw : JSON.parse(raw.trim().startsWith('{') ? raw : atob(raw));
      } catch (e) {
        serviceAccount = JSON.parse(atob(B64_SA));
      }
    } else {
      serviceAccount = JSON.parse(atob(B64_SA));
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
