# Redeyed Sentinel CAPTCHA for Shopify

Add Redeyed Sentinel bot protection to your Shopify storefront forms — contact,
newsletter, customer login, and customer registration.

**Free to install.** Rendering the widget is theme-only and costs nothing.
Verification (actually checking the token) requires a server/app and your
Redeyed API key.

## What's in this package

| Path | What it is |
| --- | --- |
| `snippets/redeyed-sentinel.liquid` | Liquid snippet that renders the Sentinel widget inside a form. |
| `config/settings_schema.json` | Settings **fragment** ("Redeyed Sentinel" group) to merge into your theme settings so the Site Key + Base URL are editable in the Theme Editor. |
| `INSTALL-liquid.md` | Step-by-step: add the snippet, merge settings, drop it into contact/login/register/newsletter forms. |
| `app-proxy-verify/` | Minimal Node (Express) example that verifies the `sentinel-token` server-side, with patterns for App Proxy / headless / Functions. |
| `LICENSE` | MIT. |

## How it works

1. **Render (theme only).** The snippet loads `sentinel.js` once and drops a
   `<div class="sentinel-captcha" data-sitekey="...">` into your form. The widget
   injects a hidden `sentinel-token` input on solve. The **Site Key is public**
   and safe to keep in the theme.

2. **Verify (server only).** A server you control receives the submitted
   `sentinel-token` and POSTs it to `{base_url}/api/v1/verify` with your **secret
   API key** in the `X-Api-Key` header. The API key must **never** be in the
   theme.

```
POST {base_url}/api/v1/verify
X-Api-Key: <secret api key>
{ "site_key": "<public site key>", "token": "<sentinel-token>" }

success when  data.success === true  OR  success === true
```

## Honest note on Shopify's constraints

Shopify storefronts are Liquid themes — **you cannot run arbitrary server code in
the storefront request path**, and native forms (`contact`, `customer_login`,
`create_customer`, newsletter) **post directly to Shopify**. That means:

- The theme snippet can **show** the CAPTCHA but cannot **block** a submission on
  its own.
- True blocking requires a place you control the server: a **Shopify App Proxy**,
  a **headless storefront** (e.g. Hydrogen / custom frontend), or **Shopify
  Functions / webhooks** for after-the-fact moderation.

See `app-proxy-verify/README.md` for the recommended patterns. If you run a
standard theme with no app, treat verification as detection/moderation rather
than a hard block.

## Getting your keys

In **Redeyed Lab → Developer → Sentinel**:

- **Sites** → **Site Key** (public) — paste into Theme Editor → Theme settings →
  Redeyed Sentinel.
- **API Keys** → secret API key — set as `SENTINEL_API_KEY` on your server only.

## Quick start

1. Follow `INSTALL-liquid.md` to render the widget on your forms.
2. (For enforcement) deploy `app-proxy-verify/` and wire it into an App Proxy or
   headless handler.

## License

MIT © 2026 Redeyed. See [LICENSE](LICENSE).
