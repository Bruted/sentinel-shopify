# Redeyed Sentinel — Shopify server-side verification

This is the **server** half of the integration. The theme snippet
(`snippets/redeyed-sentinel.liquid`) only *renders* the widget; it cannot block
a form submission on its own. To actually enforce the CAPTCHA you need a server
that receives the submitted `sentinel-token` and verifies it against the Redeyed
API before acting on the request.

## Why a server is required

Shopify storefront forms (`{% form 'contact' %}`, `{% form 'customer_login' %}`,
`{% form 'create_customer' %}`, newsletter, etc.) **post directly to Shopify's
own endpoints**. The theme is Liquid + JS only — you cannot run arbitrary code in
the request path, so the theme cannot reject a submission server-side. Your
secret API key also must never live in the theme (it is public to anyone who
views source).

So verification has to happen somewhere you control a server.

## Recommended patterns (pick one)

1. **Shopify App Proxy** — Build (or use) a Shopify app that exposes an App
   Proxy route (e.g. `/apps/sentinel/verify`). Point your form's JS at the proxy
   to verify the token before the real submission, or have the proxy perform the
   protected action itself. Shopify signs proxy requests so you can trust them.

2. **Headless / custom storefront (Hydrogen, custom frontend)** — You own the
   form handler, so call `verifySentinelToken()` server-side before creating the
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

`POST {SENTINEL_BASE_URL}/api/v1/verify`

- Header: `X-Api-Key: <your secret API key>`
- JSON body: `{ "site_key": "<public site key>", "token": "<sentinel-token>" }`
- Success when `data.success === true` **or** `success === true`.

## Run the example

```bash
cd app-proxy-verify
npm install
export SENTINEL_SITE_KEY=sk_live_xxxxxxxx     # public Site Key
export SENTINEL_API_KEY=secret_xxxxxxxx        # SECRET — server only
export SENTINEL_BASE_URL=https://redeyed.com   # optional
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

Generate keys in **Redeyed Lab → Developer → Sentinel**:

- **Sites** → Site Key (public, goes in the theme).
- **API Keys** → secret API key (server only, set as `SENTINEL_API_KEY`).
