// ============================================================
//  LOCAL DEVELOPMENT SERVER FOR CHAMPION TOKENS / EXCLUSIVE
// ============================================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const DEFAULT_DISCORD_SECRET = "PtbA_jezWa-oZ3VJbJF44kHbjWDWutk4";
const B64_SA = "eyJ0eXBlIjoic2VydmljZV9hY2NvdW50IiwicHJvamVjdF9pZCI6ImNoYW1waW9uLXRva2VucyIsInByaXZhdGVfa2V5X2lkIjoiNmU3ZjM3NzI0OTg1ZWVlZjhmODFhMDQzNzQyZjI5MjllOGQwODdhMiIsInByaXZhdGVfa2V5IjoiLS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tXG5NSUlFdlFJQkFEQU5CZ2txaGtpRzl3MEJBUUVGQUFTQ0JLY3dnZ1NqQWdFQUFvSUJBUUREMjl6bXFTWGZoeEdRXG5tSWt2RVpHUFZ3S2QwdWIrTHZEWlNSOGlCZjBhN3h3MEVuT283NVpJUmhnYnh2L1B4NmRSUmE0UFF6Uk9ab2xwXG5CbE03OFI5cnE1KzY2NE9kakxJaW5yaG9GVTBxaHJQL0Z6TEtYY3E1bVpZbUIwc3J2amgrTnN4T3N0YnRHRWRuXG52ckdmcXM4Uk95Vm4va3VrYk8xeTBlYmVCRThCOWNaWHdhQ25qMDFkQndwc01YdExtYmpqYXlPTXF3WmlmQ0IxXG5GMFdHREsvUjVNY0ZSNUVDUTVaSnZWanpaM3kwZi9DTXJTeisvU09tZExvYlhvTHZzcmRBblcwWHBLMitjcGs0XG5uSEpNMW5zWFYxTmlnZmVRdFhNRUNqV1dONWNybWFxR1A4RTFwVkFZcFQydGorTW01WlNiNkt4eXVPRGtTZHdZXG4xZks0cUJHUkFnTUJBQUVDZ2dFQURCRFhoQnk3eFBCYjJrZnhYSlZWSGFyZk1nU1gveVQ2YUxKbTRQaFVPa1JzXG5mUDg5Z1pUbjhkSWlvbFJ4TmpaUEpoUTRONys4d1U4ekRDV3IrME44bTJ3V1lpUW41cXp3SE82Zy91V0FERnlCXG55bmRlQlVZL3FzMHR5VEEyRnU3b0tVdGNMUVY2dE43RDZGM2dzS3pMeHB5WmpuVmxxTTZlbHE0Y2JrVSs3a2gvXG5jQ0huQkxoM3FNL2tjNk9DdXdVQjlGR21uRGVNaSt1bHEyQ0lka3Ezck5tUUljZmFLQ3plMVZvZ0J0VGplQnBLXG5iSkJoUWJzQTJlczJmc2R3ZkkwaXA2U1pmcmhBaUZIMDZHVkRyeU90Qk9FQnRCQ05WTXN2dWxlblB6MEloZlg0XG5WT1BnZTREaXJiWmFzQU1KU2VESkhpV3RLOE8wenZXcHZSUUkwZnZ0R1FLQmdRRDZ6WTlaVnduTHlSWEtRNVYvXG5nNjBSUnhNT3B6M3FiV0ZVZGtLRmw5a2o4dkpzVXVtc0t1aWFDQllLVHJTY3o4a2RYelhBTEorUWRKNzN3RmFSXG50ZzNzd2FqbkxhdlFoYkIwMXNza08wcHc0MllKWnBRWlRDaitsRld2ZVZEY0xnZEVjS1ZpWTZIYmNYSndIRGNGXG5teGJWM3E1UStINFcreFlYdjNXWGpaODR5UUtCZ1FESDZ0YndPWE15YVdhTHR2UWs1aGxvQUF1Mk5KYWQwM0JZXG5BWE1hdWE0Nzd2bEVVTnpqSnJsYjZKR081TThpb1dIMXpLWFBwcmQ3VDVHdVNhRTZvTDZieTJKK3BqN0JSUy9hXG51azdJamVIYUZzWUFEZWVsSWFwYnFIUmJrc1FiOHUyQk9VZkNLZTJ5QW5LZkFOL3RuaEJ6anRXcGJzN25jc1pNXG5FdEYxTkNJK2lRS0JnQ0U4am91cllpdjBhUVBWOHdEa0JWSnQxZE95VEIwK0E1RDYzeFB2TEtKNzlxNXVTbk03XG5lSG01S3BxUkZaUldZUE9ZZzNvRkw5d242RTB5MndZU1YwUVI0ZjFJNnlVR0luMUpYY0JlYng0SXRLUDRTUllWXG5KcldlR01EWlZlTG40cVNxUFBDTi9Zd2tPNk1weWd6ZklhYVVEUXZEOG9tL0dvMXBIUDlKa0ZrcEFvR0FPWjk4XG4rSnoya1U5RUdYMVFmZG84OUhjZTZSUGJYZjUxNFVmNXIzaFp1amkxYkhXS1ZZYng0b1gwZnFXQTl0QmhkZ0hZXG53VE9pcTA1U0JWUi92bkJhd0hrdEdLZythbUxRMmxEZEtIMk0zZG0ybElsdGZYRm9zeWFvODBRb2RvM2MyMlJ4XG5SSXZsVVd2WE1mR0VtZTczZXZkdXFubWY5YUpsZWNQcXo4ZUpIMUVDZ1lFQWsxSXIwcjVoTkU4RDlUaGVsNWFkXG5UTGlPN2xBcXIvT25CMzJvM1p1Ni9ycnFmc3pPVXR3aldtNHVyWFphTHVka1BqZzhUVXF5L2RGNmNyQlIxM2NrXG5OQ290aUFIZ01pWmZuaVk4cWN4aEx3SHdqaHFuNEN4d09Wak1ySmNCQzRpK2thZktrUE9naDlUUHlSRmFCT2lwXG5xK2N6UEdXYzc2cUdWVEtlMVhkQUcrZz1cbi0tLS0tRU5EIFBSSVZBVEUgS0VZLS0tLS1cbiIsImNsaWVudF9lbWFpbCI6ImZpcmViYXNlLWFkbWluc2RrLWZic3ZjQGNoYW1waW9uLXRva2Vucy5pYW0uZ3NlcnZpY2VhY2NvdW50LmNvbSIsImNsaWVudF9pZCI6IjExMTc1MTYyNTQ4OTgyMDQ0NTE1OCIsImF1dGhfdXJpIjoiaHR0cHM6Ly9hY2NvdW50cy5nb29nbGUuY29tL28vb2F1dGgyL2F1dGgiLCJ0b2tlbl91cmkiOiJodHRwczovL29hdXRoMi5nb29nbGVhcGlzLmNvbS90b2tlbiIsImF1dGhfcHJvdmlkZXJfeDUwOV9jZXJ0X3VybCI6Imh0dHBzOi8vd3d3Lmdvb2dsZWFwaXMuY29tL29hdXRoMi92MS9jZXJ0cyIsImNsaWVudF94NTA5X2NlcnRfdXJsIjoiaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vcm9ib3QvdjEvbWV0YWRhdGEveDUwOS9maXJlYmFzZS1hZG1pbnNkay1mYnN2YyU0MGNoYW1waW9uLXRva2Vucy5pYW0uZ3NlcnZpY2VhY2NvdW50LmNvbSIsInVuaXZlcnNlX2RvbWFpbiI6Imdvb2dsZWFwaXMuY29tIn0=";

function createFirebaseCustomToken(serviceAccount, uid, claims = {}) {
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
  const b64H = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64P = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(b64H + '.' + b64P);
  const sig = sign.sign(serviceAccount.private_key, 'base64url');
  return `${b64H}.${b64P}.${sig}`;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=UTF-8'
};

const server = http.createServer((req, res) => {
  // CORS & Security headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // ── API: /api/discordAuth (Localhost OAuth Exchange) ──────────
  if (pathname === '/api/discordAuth' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { code, redirectUri } = JSON.parse(body || '{}');
        if (!code || !redirectUri) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Missing code or redirectUri' }));
        }

        const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: '1540084692873912470',
            client_secret: DEFAULT_DISCORD_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
          }),
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || tokenData.error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: tokenData.error_description || tokenData.error || 'Discord auth failed' }));
        }

        const userRes = await fetch('https://discord.com/api/users/@me', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const discordUser = await userRes.json();
        if (!discordUser.id) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Failed to fetch Discord profile' }));
        }

        const uid = `discord:${discordUser.id}`;
        const displayName = discordUser.global_name || discordUser.username;
        const photoURL = discordUser.avatar
          ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=128`
          : `https://cdn.discordapp.com/embed/avatars/${Number(discordUser.id) % 6}.png`;

        const serviceAccount = JSON.parse(Buffer.from(B64_SA, 'base64').toString());
        const token = createFirebaseCustomToken(serviceAccount, uid, {
          discordId: discordUser.id,
          displayName,
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          token,
          user: { uid, displayName, photoURL, email: discordUser.email || '', discordId: discordUser.id, discordUsername: discordUser.username }
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Server error' }));
      }
    });
    return;
  }

  // Normalize path
  if (pathname === '/' || pathname === '' || pathname === '/main' || pathname === '/main.html' || pathname === '/index.html') {
    pathname = '/main.html';
  }

  if (pathname === '/season-pass') {
    pathname = '/shop.html';
  }

  // Redirect legacy /profile/discord:123 to pure 12-digit /profile/123
  if (pathname.startsWith('/profile/discord:')) {
    const digits = pathname.replace(/\D/g, '').slice(0, 12) || '112118831941';
    res.writeHead(301, { Location: `/profile/${digits}` });
    return res.end();
  }

  // Handle /profile and /profile/* dynamically (excluding static assets with file extensions)
  if (pathname === '/profile' || pathname.startsWith('/profile/')) {
    if (path.extname(pathname)) {
      pathname = pathname.replace(/^\/profile/, '');
    } else {
      const profilePath = path.join(ROOT, 'profile.html');
      return serveFile(profilePath, res);
    }
  }

  let filePath = path.join(ROOT, pathname);

  // Prevent directory traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  // Check if file exists as-is
  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      return serveFile(filePath, res);
    }

    // Clean URL check (e.g. /dashboard -> /dashboard.html)
    const htmlPath = filePath + '.html';
    fs.stat(htmlPath, (htmlErr, htmlStats) => {
      if (!htmlErr && htmlStats.isFile()) {
        return serveFile(htmlPath, res);
      }

      // Check directory index
      if (!err && stats.isDirectory()) {
        const indexPath = path.join(filePath, 'index.html');
        fs.stat(indexPath, (indexErr, indexStats) => {
          if (!indexErr && indexStats.isFile()) {
            return serveFile(indexPath, res);
          }
          return serve404(res);
        });
        return;
      }

      return serve404(res);
    });
  });
});

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error: ' + err.message);
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(data);
  });
}

function serve404(res) {
  const custom404 = path.join(ROOT, '404.html');
  if (fs.existsSync(custom404)) {
    fs.readFile(custom404, (err, data) => {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=UTF-8' });
      res.end(data);
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=================================================`);
  console.log(`🚀 CHAMPION TOKENS / EXCLUSIVE LOCAL DEV SERVER`);
  console.log(`🌐 Local URL:   http://localhost:${PORT}`);
  console.log(`🌐 Network URL: http://127.0.0.1:${PORT}`);
  console.log(`📁 Serving:     ${ROOT}`);
  console.log(`=================================================`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`Port ${PORT} in use, trying ${PORT + 1}...`);
    server.listen(PORT + 1, '0.0.0.0');
  } else {
    console.error('Server error:', err);
  }
});
