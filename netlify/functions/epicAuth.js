// ============================================================
//  CHAMPION TOKENS — Epic Games OAuth Token Exchange Function
// ============================================================

// Epic Games OAuth 2.0 Credentials (from Epic Games Developer Portal)
const EPIC_CLIENT_ID     = process.env.EPIC_CLIENT_ID || 'xyza78916i52N8UrLv1m41xvkgeBXfUh';
const EPIC_CLIENT_SECRET = process.env.EPIC_CLIENT_SECRET || 'QVCOU070fXLGtGjH8IUpNe0GfPJ8Zb0pOmDcBiSNMX4';
const EPIC_TOKEN_URL     = 'https://api.epicgames.dev/epic/oauth/v1/token';
const EPIC_USERINFO_URL  = 'https://api.epicgames.dev/epic/id/v1/accounts';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { code, redirectUri } = JSON.parse(event.body || '{}');

    if (!code) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing authorization code from Epic Games' }),
      };
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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success:       true,
        epicUsername:  epicDisplayName,
        epicAccountId: epicAccountId,
      }),
    };
  } catch (err) {
    console.error('Epic OAuth error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || 'Internal Server Error' }),
    };
  }
};
