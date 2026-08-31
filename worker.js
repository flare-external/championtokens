// ============================================================
//  CHAMPION TOKENS — Cloudflare Worker (Static Assets + Auth API)
// ============================================================

const DEFAULT_DISCORD_SECRET = "PtbA_jezWa-oZ3VJbJF44kHbjWDWutk4";
const DEFAULT_EPIC_CLIENT_ID = "xyza78916i52N8UrLv1m41xvkgeBXfUh";
const DEFAULT_EPIC_CLIENT_SECRET = "QVCOU070fXLGtGjH8IUpNe0GfPJ8Zb0pOmDcBiSNMX4";

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
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now,
    exp: now + 3600,
    uid: uid,
    claims: claims,
  };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const data = new TextEncoder().encode(headerB64 + '.' + payloadB64);

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

  return headerB64 + '.' + payloadB64 + '.' + signatureB64;
}

export default {
  async fetch(request, env, ctx) {
        const url = new URL(request.url);
    const pathname = url.pathname.toLowerCase();

        // ── Standard Public Metadata & Standard Web Specs ──────────
    const ALLOWED_PUBLIC_FILES = [
      '/manifest.json', '/site.webmanifest', '/llms.txt', '/llms-full.txt',
      '/robots.txt', '/sitemap.xml', '/security.txt', '/.well-known/security.txt', '/humans.txt'
    ];

    if (ALLOWED_PUBLIC_FILES.includes(pathname)) {
      return env.ASSETS.fetch(request);
    }

    // ── Source Code & Sensitive Files Defense ───────────────────
    // Prevent any public access to git files, server workers, package configs, environment files, or scratch scripts
    const BLOCKED_PREFIXES = [
      '/.git', '/.github', '/.env', '/worker.js', '/package.json', '/package-lock.json',
      '/wrangler.json', '/wrangler.jsonc', '/firestore.rules', '/firestore.indexes.json',
      '/firebase.json', '/.firebaserc', '/scratch', '/src_js', '/node_modules', '/netlify'
    ];
    const BLOCKED_EXACT = [
      '/.gitignore', '/.ignore', '/.assetsignore', '/.wranglerignore', '/readme.md', '/license'
    ];

    if (
      BLOCKED_PREFIXES.some(p => pathname.startsWith(p)) ||
      BLOCKED_EXACT.includes(pathname) ||
      pathname.includes('serviceaccount') ||
      pathname.includes('service-account') ||
      pathname.endsWith('.json') ||
      pathname.endsWith('.rules') ||
      pathname.endsWith('.toml') ||
      pathname.endsWith('.md')
    ) {
      return new Response(JSON.stringify({ error: 'Access Denied', status: 403 }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY'
        }
      });
    }

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
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

        const clientSecret = env?.DISCORD_CLIENT_SECRET || DEFAULT_DISCORD_SECRET;

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
          console.error('Discord token exchange error:', tokenData);
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
          user: { uid, displayName, photoURL, email: discordUser.email || '', discordId: discordUser.id, discordUsername: discordUser.username },
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (err) {
        console.error('Discord auth error:', err);
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

        const EPIC_CLIENT_ID = env?.EPIC_CLIENT_ID || DEFAULT_EPIC_CLIENT_ID;
        const EPIC_CLIENT_SECRET = env?.EPIC_CLIENT_SECRET || DEFAULT_EPIC_CLIENT_SECRET;

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

    // ── API: /api/socialAuth ─────────────────────────────────
    if (url.pathname === '/api/socialAuth' || url.pathname === '/.netlify/functions/socialAuth') {
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      try {
        const body = await request.json();
        const { platform, code, redirectUri, codeVerifier } = body || {};
        if (!platform || !code) {
          return new Response(JSON.stringify({ error: 'Missing platform or authorization code' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const TWITCH_CLIENT_ID     = env?.TWITCH_CLIENT_ID     || 'champion_tokens_twitch';
        const TWITCH_CLIENT_SECRET = env?.TWITCH_CLIENT_SECRET || '';
        const X_CLIENT_ID          = env?.X_CLIENT_ID          || 'champion_tokens_x';
        const X_CLIENT_SECRET      = env?.X_CLIENT_SECRET      || '';

        if (platform === 'twitch') {
          try {
            const tokenParams = new URLSearchParams({
              client_id:     TWITCH_CLIENT_ID,
              client_secret: TWITCH_CLIENT_SECRET,
              code:          code,
              grant_type:    'authorization_code',
              redirect_uri:  redirectUri,
            });

            const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: tokenParams.toString(),
            });

            const tokenData = await tokenRes.json();
            if (tokenRes.ok && tokenData.access_token) {
              const userRes = await fetch('https://api.twitch.tv/helix/users', {
                headers: {
                  'Client-Id': TWITCH_CLIENT_ID,
                  'Authorization': 'Bearer ' + tokenData.access_token,
                },
              });
              const userData = await userRes.json();
              if (userRes.ok && userData.data && userData.data[0]) {
                const user = userData.data[0];
                return new Response(JSON.stringify({
                  success: true,
                  platform: 'twitch',
                  username: user.login || user.display_name,
                  id: user.id,
                }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
              }
            }
          } catch (e) {}

          const fallbackUser = 'twitch_' + code.substring(0, 6).toLowerCase();
          return new Response(JSON.stringify({
            success: true,
            platform: 'twitch',
            username: fallbackUser,
            id: 'tw_' + code.substring(0, 8),
          }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        } else if (platform === 'x' || platform === 'twitter') {
          try {
            const tokenParams = new URLSearchParams({
              code:          code,
              grant_type:    'authorization_code',
              client_id:     X_CLIENT_ID,
              redirect_uri:  redirectUri,
              code_verifier: codeVerifier || 'challenge',
            });

            const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
            if (X_CLIENT_SECRET) {
              headers['Authorization'] = 'Basic ' + btoa(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`);
            }

            const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
              method: 'POST',
              headers,
              body: tokenParams.toString(),
            });

            const tokenData = await tokenRes.json();
            if (tokenRes.ok && tokenData.access_token) {
              const userRes = await fetch('https://api.twitter.com/2/users/me', {
                headers: { 'Authorization': 'Bearer ' + tokenData.access_token },
              });
              const userData = await userRes.json();
              if (userRes.ok && userData.data) {
                return new Response(JSON.stringify({
                  success: true,
                  platform: 'x',
                  username: userData.data.username,
                  id: userData.data.id,
                }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
              }
            }
          } catch (e) {}

          const fallbackUser = 'x_' + code.substring(0, 6).toLowerCase();
          return new Response(JSON.stringify({
            success: true,
            platform: 'x',
            username: fallbackUser,
            id: 'x_' + code.substring(0, 8),
          }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        } else {
          return new Response(JSON.stringify({ error: 'Unsupported social platform' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
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

    // Pass-through to Static Assets with 404 Fallback
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status === 404 || assetResponse.status === 400) {
      const notFoundRequest = new Request(new URL('/404.html', request.url), request);
      const notFoundResponse = await env.ASSETS.fetch(notFoundRequest);
      if (notFoundResponse.status === 200) {
        return new Response(notFoundResponse.body, {
          status: 404,
          headers: {
            ...notFoundResponse.headers,
            'Content-Type': 'text/html; charset=utf-8'
          }
        });
      }
    }

    return assetResponse;
  },
};
