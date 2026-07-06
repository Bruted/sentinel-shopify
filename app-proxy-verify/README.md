# Redeyed Sentinel — Shopify server-side verification

This is the **server** half of the integration. The theme snippet
(`snippets/redeyed-sentinel.liquid`) only *renders* the widget; it cannot block
a form submission on its own. To actually enforce the CAPTCHA you need a server
that receives the submitted `sentinel-token` and verifies it against the Redeyed
API before acting on the request.

Verification uses a reCAPTCHA/Turnstile-style flow: this site's own **Secret
Key** authenticates the verify call. There is **no developer API key** involved.

## Why a server is required

Shopify storefront forms (`{% form 'contact' %}`, `{% form 'customer_login' %}`,
`{% form 'create_customer' %}`, newsletter, etc.) **post directly to Shopify's
own endpoints**. The theme is Liquid + JS only — you cannot run arbitrary code in
the request path, so the theme cannot reject a submission server-side. Your
Secret Key also must never live in the theme (it is public to anyone who
views source).

So verification has to happen somewhere you control a server.

## Recommended patterns (pick one)

1. **Shopify App Proxy** — Build (or use) a Shopify app that exposes an App
   Proxy route (e.g. `/apps/sentinel/verify`). Point your form's JS at the proxy
   to verify the token before the real submission, or have the proxy perform the
   protected action itself. Shopify signs proxy requests so you can trust them.

2. **Headless / custom storefront (Hydrogen, custom frontend)** — You own the
   form handler, so call `verifySentinelToken(token, remoteip)` server-side before creating the
   customer / sending the message via the Storefront or Admin API. This is the
   cleanest way to truly *block* bad submissions.

3. **Shopify Functions / Flow / webhook** — React to events (e.g. customer
   created, order created) and verify the token that the widget attached, then
   take action (tag, cancel, alert). This is *after the fact* rather than
   blocking, but useful for moderation.

4. **External endpoint** — Any server (this Express example, a Lambda, a Worker)
   that the storefront JS calls to verify before submitting.

> The honest limitation: with a vanilla (non-headless) Shopify theme you cannot
> hard-block the native form post. Use an App Proxy or headless storefront for
> true blocking; otherwise treat verification as detection/moderation.

## The contract

`POST {SENTINEL_BASE_URL}/sentinel/siteverify`

- No `X-Api-Key` header. The Secret Key travels in the body.
- JSON body: `{ "secret": "<secret key>", "response": "<sentinel-token>" }`
  plus optional `"remoteip": "<client ip>"`.
- Response: `{ "success": true|false, "outcome": "...", "score": N }`.
- Success when `success === true`.

## Run the example

```bash
cd app-proxy-verify
npm install
export SENTINEL_SITE_KEY=sk_live_xxxxxxxx        # public Site Key (renders widget)
export SENTINEL_SECRET_KEY=ssk_live_xxxxxxxx     # SECRET Key — server only
export SENTINEL_BASE_URL=https://redeyed.com     # optional
npm start
```

Then POST a token:

```bash
curl -X POST http://localhost:3000/verify \
  -H 'Content-Type: application/json' \
  -d '{"sentinel-token":"<token-from-widget>"}'
```

- `200 { ok: true }` — token valid, continue your logic.
- `403` — verification failed.
- `400` — no token supplied.

## Using the helper directly

```js
const { verifySentinelToken } = require('./verify');

const { success } = await verifySentinelToken(token);
if (!success) throw new Error('Bot check failed');
```

## Keys

Both keys come from **Redeyed Lab → Sentinel → Sites**:

- **Site Key** (public, goes in the theme — still renders the widget).
- **Secret Key** (server only, set as `SENTINEL_SECRET_KEY`). It is shown only
  once when you create the site, so store it safely.

## Changelog

- **1.0.2** — Send a proxy-aware `remoteip` on verification so the token matches
  the IP that solved the challenge (fixes "Verified but form fails" behind
  proxies/CDNs). The `/verify` handler now reads the visitor's real IP from
  `cf-connecting-ip` → first `x-forwarded-for` hop → `x-real-ip` → socket
  address, validates it, and only forwards it when it looks like a real IP.
- **1.0.1** — Verification now uses the per-site Secret Key
  (reCAPTCHA/Turnstile-style) instead of a developer API key. Endpoint moved to
  `POST /sentinel/siteverify` with body `{ secret, response, remoteip? }`; the
  `X-Api-Key` header and `SENTINEL_API_KEY` are removed in favor of
  `SENTINEL_SECRET_KEY`.
