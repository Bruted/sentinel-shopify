/**
 * Redeyed Sentinel — server-side token verification for Shopify.
 *
 * Shopify storefront forms post directly to Shopify, so the theme alone CANNOT
 * block a submission. To actually enforce the CAPTCHA you need a server that
 * receives the submitted "sentinel-token" and verifies it before acting on the
 * request. This file is that server piece.
 *
 * It exposes:
 *   - verifySentinelToken(token): low-level helper that calls the Redeyed API.
 *   - app: a minimal Express app with a POST /verify endpoint suitable for use
 *     behind a Shopify App Proxy, a webhook receiver, or any external endpoint.
 *
 * Required environment variables:
 *   SENTINEL_SITE_KEY   public Site Key for the storefront
 *   SENTINEL_API_KEY    SECRET API key — keep this on the server ONLY
 *   SENTINEL_BASE_URL   optional, defaults to https://redeyed.com
 *
 * Node 18+ (global fetch). No external runtime deps required for the helper;
 * Express is only used for the example HTTP server.
 */

const SITE_KEY = process.env.SENTINEL_SITE_KEY;
const API_KEY = process.env.SENTINEL_API_KEY;
const BASE_URL = process.env.SENTINEL_BASE_URL || 'https://redeyed.com';

/**
 * Verify a Sentinel token with the Redeyed API.
 *
 * @param {string} token - value of the hidden "sentinel-token" form field.
 * @returns {Promise<{ success: boolean, raw: any }>}
 */
async function verifySentinelToken(token) {
  if (!SITE_KEY || !API_KEY) {
    throw new Error(
      'Missing SENTINEL_SITE_KEY or SENTINEL_API_KEY environment variables.'
    );
  }
  if (!token || typeof token !== 'string') {
    return { success: false, raw: { error: 'missing_token' } };
  }

  const res = await fetch(`${BASE_URL}/api/v1/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Api-Key': API_KEY,
    },
    body: JSON.stringify({ site_key: SITE_KEY, token }),
  });

  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  // Contract: success when data.success === true OR success === true.
  const success =
    !!body &&
    ((body.data && body.data.success === true) || body.success === true);

  return { success, raw: body };
}

// ---------------------------------------------------------------------------
// Example Express server (App Proxy / webhook / external endpoint).
// ---------------------------------------------------------------------------
const express = require('express');

const app = express();
app.use(express.json());
// Shopify App Proxy form posts arrive url-encoded; accept both.
app.use(express.urlencoded({ extended: true }));

/**
 * POST /verify
 * Body may contain the token as "sentinel-token" (the field the widget injects)
 * or "token". Responds 200 on success, 403 on failure, 400 when no token.
 */
app.post('/verify', async (req, res) => {
  const token =
    (req.body && (req.body['sentinel-token'] || req.body.token)) || '';

  if (!token) {
    return res.status(400).json({ ok: false, error: 'missing_token' });
  }

  try {
    const { success, raw } = await verifySentinelToken(token);
    if (success) {
      // Token is valid — continue your own logic here (create record, forward
      // the request to Shopify Admin API, allow the action, etc.).
      return res.status(200).json({ ok: true });
    }
    return res.status(403).json({ ok: false, error: 'verification_failed', detail: raw });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'verification_error', detail: String(err.message || err) });
  }
});

// Only start listening when run directly (not when imported in tests).
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Sentinel verify server listening on :${port}`);
  });
}

module.exports = { app, verifySentinelToken };
