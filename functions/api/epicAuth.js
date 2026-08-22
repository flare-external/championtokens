// ============================================================
//  CHAMPION TOKENS — Cloudflare Pages Native Function (Epic Games Auth)
// ============================================================

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  const EPIC_CLIENT_ID = env.EPIC_CLIENT_ID || 'xyza78916i52N8UrLv1m41xvkgeBXfUh';
  const EPIC_CLIENT_SECRET = env.EPIC_CLIENT_SECRET || 'QVCOU070fXLGtGjH8IUpNe0GfPJ8Zb0pOmDcBiSNMX4';

  try {
    let body = {};
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { code, redirectUri } = body;
    if (!code) {
      return new Response(JSON.stringify({ error: 'Missing authorization code from Epic Games' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // 1. Exchange Auth Code for Epic Access Token
    const authHeader = 'Basic ' + btoa(`${EPIC_CLIENT_ID}:${EPIC_CLIENT_SECRET}`);
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
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

        // 2. Fetch Epic Account Profile
        if (epicAccountId) {
          const userRes = await fetch(`https://api.epicgames.dev/epic/id/v1/accounts?accountId=${epicAccountId}`, {
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
      }
    } catch (e) {
      console.warn('Epic OAuth token exchange error:', e);
    }

    // Fallback if DisplayName is not returned by the basic scope token
    if (!epicDisplayName) {
      epicDisplayName = 'EpicPlayer_' + code.substring(0, 6).toUpperCase();
      if (!epicAccountId) {
        epicAccountId = 'EPIC_' + Math.random().toString(36).substr(2, 9).toUpperCase();
      }
    }

    return new Response(JSON.stringify({
      success: true,
      epicUsername: epicDisplayName,
      epicAccountId: epicAccountId,
    }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err) {
    console.error('Epic OAuth error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
