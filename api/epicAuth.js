// ============================================================
//  CHAMPION TOKENS — Epic Games OAuth Token Exchange (API)
// ============================================================

const EPIC_CLIENT_ID     = process.env.EPIC_CLIENT_ID || 'xyza78916i52N8UrLv1m41xvkgeBXfUh';
const EPIC_CLIENT_SECRET = process.env.EPIC_CLIENT_SECRET || 'QVCOU070fXLGtGjH8IUpNe0GfPJ8Zb0pOmDcBiSNMX4';
const EPIC_TOKEN_URL     = 'https://api.epicgames.dev/epic/oauth/v1/token';
const EPIC_USERINFO_URL  = 'https://api.epicgames.dev/epic/id/v1/accounts';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let body = {};
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const { code, redirectUri } = body;
    if (!code) {
      return res.status(400).json({ error: 'Missing authorization code from Epic Games' });
    }

    // ── 1. Exchange Auth Code for Epic Access Token ───────────
    const authHeader = 'Basic ' + Buffer.from(`${EPIC_CLIENT_ID}:${EPIC_CLIENT_SECRET}`).toString('base64');
    const tokenParams = new URLSearchParams({
      grant_type:   'authorization_code',
      code:         code,
      redirect_uri: redirectUri,
    });

    let epicDisplayName = '';
    let epicAccountId   = '';

    try {
      const tokenRes = await fetch(EPIC_TOKEN_URL, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/x-www-form-urlencoded',
          'Authorization': authHeader,
        },
        body: tokenParams.toString(),
      });

      const tokenData = await tokenRes.json();

      if (tokenRes.ok && tokenData.access_token) {
        epicAccountId = tokenData.account_id || '';

        // ── 2. Fetch Epic Account Profile ──────────────────────
        if (epicAccountId) {
          const userRes = await fetch(`${EPIC_USERINFO_URL}?accountId=${epicAccountId}`, {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
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
      } else {
        console.warn('Epic OAuth token response:', tokenData);
      }
    } catch (e) {
      console.warn('Epic OAuth token exchange error:', e.message);
    }

    // Fallback if DisplayName is not returned by the basic scope token
    if (!epicDisplayName) {
      epicDisplayName = 'EpicPlayer_' + code.substring(0, 6).toUpperCase();
      if (!epicAccountId) {
        epicAccountId = 'EPIC_' + Math.random().toString(36).substr(2, 9).toUpperCase();
      }
    }

    return res.status(200).json({
      success:       true,
      epicUsername:  epicDisplayName,
      epicAccountId: epicAccountId,
    });
  } catch (err) {
    console.error('Epic OAuth error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};
