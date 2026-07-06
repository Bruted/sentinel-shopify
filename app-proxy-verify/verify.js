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
 *   SENTINEL_SITE_KEY     public Site Key for the storefront (renders the widget)
 *   SENTINEL_SECRET_KEY   SECRET Key for this site — keep this on the server ONLY
 *   SENTINEL_BASE_URL     optional, defaults to https://redeyed.com
 *
 * Verification uses a reCAPTCHA/Turnstile-style flow: the site's own Secret Key
 * authenticates the verify call (no developer API key). Both keys come from the
 * Redeyed Lab → Sentinel → Sites; the Secret Key is shown only once.
 *
 * Node 18+ (global fetch). No external runtime deps required for the helper;
 * Express is only used for the example HTTP server.
 */

const SITE_KEY = process.env.SENTINEL_SITE_KEY;
const SECRET_KEY = process.env.SENTINEL_SECRET_KEY;
const BASE_URL = process.env.SENTINEL_BASE_URL || 'https://redeyed.com';

/**
 * Loose IPv4/IPv6 plausibility check so we never forward garbage as remoteip.
 * @param {string} value
 * @returns {boolean}
 */
function isPlausibleIp(value) {
  if (!value || typeof value !== 'string') return false;
  // Drop an IPv4-mapped IPv6 prefix (::ffff:1.2.3.4) and any IPv6 zone id.
  const bare = value.trim().replace(/^::ffff:/i, '').replace(/%.*$/, '');
  const ipv4 = bare.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    return ipv4.slice(1).every((octet) => Number(octet) <= 255);
  }
  // IPv6: hex groups separated by colons (requires at least one colon).
  return bare.includes(':') && /^[0-9a-f:]+$/i.test(bare);
}

/**
 * Best-effort real client IP from an incoming request, proxy/CDN aware.
 *
 * Shopify's App Proxy forwards the storefront visitor, so the real client IP
 * arrives in a proxy header rather than on the socket. Prefer Cloudflare, then
 * the first `X-Forwarded-For` hop, then `X-Real-IP`, then the raw socket
 * address. Returns undefined when nothing looks like a valid IP.
 *
 * @param {import('http').IncomingMessage} req
 * @returns {string|undefined}
 */
function clientIpFromRequest(req) {
  const headers = (req && req.headers) || {};
  const forwardedFor = headers['x-forwarded-for'];
  const candidates = [
    headers['cf-connecting-ip'],
    (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor || '').split(',')[0],
    headers['x-real-ip'],
    req && req.socket && req.socket.remoteAddress,
  ];
  for (const candidate of candidates) {
    const ip = (candidate || '').trim();
    if (isPlausibleIp(ip)) return ip;
  }
  return undefined;
}

/**
 * Verify a Sentinel token with the Redeyed API.
 *
 * @param {string} token - value of the hidden "sentinel-token" form field.
 * @param {string} [remoteip] - optional client IP address for extra signal.
 * @returns {Promise<{ success: boolean, raw: any }>}
 */
async function verifySentinelToken(token, remoteip) {
  // "Configured?" is based on the Secret Key being present — that is what
  // authenticates the verify call.
  if (!SECRET_KEY) {
    throw new Error('Missing SENTINEL_SECRET_KEY environment variable.');
  }
  if (!token || typeof token !== 'string') {
    return { success: false, raw: { error: 'missing_token' } };
  }

  const payload = { secret: SECRET_KEY, response: token };
  if (remoteip) {
    payload.remoteip = remoteip;
  }

  const res = await fetch(`${BASE_URL}/sentinel/siteverify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  // Contract: response is { success, outcome, score }. Passes when success === true.
  const success = !!body && body.success === true;

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
    // Forward the visitor's real IP as remoteip (proxy/CDN aware) so the token
    // is matched against the address that solved the challenge.
    const remoteip = clientIpFromRequest(req);
    const { success, raw } = await verifySentinelToken(token, remoteip);
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

module.exports = { app, verifySentinelToken, clientIpFromRequest, isPlausibleIp };
