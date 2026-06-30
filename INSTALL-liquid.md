# Installing the Redeyed Sentinel snippet (Liquid theme)

This adds the Sentinel widget to your storefront forms. It is **render-only** —
it shows the CAPTCHA but does not block submissions by itself. For real
enforcement see `app-proxy-verify/`.

## 1. Add the snippet

Copy `snippets/redeyed-sentinel.liquid` into your theme's `snippets/` folder.

- **Theme Editor:** Online Store → Themes → ⋯ → Edit code → Snippets → *Add a
  new snippet* named `redeyed-sentinel`, then paste the file contents.
- **Shopify CLI:** drop the file into your theme repo's `snippets/` directory
  and push.

## 2. Merge the settings fragment

`config/settings_schema.json` in this package is a **fragment** — a single
settings group, *not* a full schema. Your theme already has a
`config/settings_schema.json` that is a JSON **array** whose first element is the
`theme_info` object.

Open your theme's `config/settings_schema.json` and add the group object from
this package's fragment as a **new element of that array** (e.g. just before the
closing `]`). Make sure to add a comma after the previous element. Result looks
like:

```json
[
  { "name": "theme_info", "...": "..." },
  { "name": "...existing groups..." },
  {
    "name": "Redeyed Sentinel",
    "settings": [ /* ...from the fragment... */ ]
  }
]
```

Validate the JSON (no trailing commas) before saving.

## 3. Set your Site Key

Theme Editor → **Theme settings** → **Redeyed Sentinel** → paste your **Site
Key** (from Redeyed Lab → Developer → Sentinel → Sites). Leave **Base URL** as
`https://redeyed.com` unless you self-host.

The Site Key is public and safe in the theme. Do **not** put the secret API key
here.

## 4. Render the widget inside each form

Place `{% render 'redeyed-sentinel' %}` **inside** the `{% form %}` block,
typically just before the submit button so the hidden `sentinel-token` input is
included in the post.

### Contact form — `sections/main-contact.liquid` (or `templates/page.contact.liquid`)

```liquid
{% form 'contact' %}
  {{ form.errors | default_errors }}
  <input type="text"  name="contact[name]"  placeholder="Name">
  <input type="email" name="contact[email]" placeholder="Email">
  <textarea name="contact[body]"></textarea>

  {% render 'redeyed-sentinel' %}

  <button type="submit">Send</button>
{% endform %}
```

### Customer login — `sections/main-login.liquid` (or `templates/customers/login.liquid`)

```liquid
{% form 'customer_login' %}
  {{ form.errors | default_errors }}
  <input type="email"    name="customer[email]">
  <input type="password" name="customer[password]">

  {% render 'redeyed-sentinel' %}

  <button type="submit">Sign in</button>
{% endform %}
```

### Customer registration — `sections/main-register.liquid` (or `templates/customers/register.liquid`)

```liquid
{% form 'create_customer' %}
  {{ form.errors | default_errors }}
  <input type="text"     name="customer[first_name]">
  <input type="text"     name="customer[last_name]">
  <input type="email"    name="customer[email]">
  <input type="password" name="customer[password]">

  {% render 'redeyed-sentinel' %}

  <button type="submit">Create</button>
{% endform %}
```

### Newsletter — wherever your newsletter `{% form 'customer' %}` lives

```liquid
{% form 'customer' %}
  <input type="email" name="contact[email]">

  {% render 'redeyed-sentinel' %}

  <button type="submit">Subscribe</button>
{% endform %}
```

## 5. Optional: widget style / theme

```liquid
{% render 'redeyed-sentinel', widget: 'image_pick' %}
{% render 'redeyed-sentinel', widget: 'checkbox', theme: 'dark' %}
```

`widget` and `theme` are passed through to `data-widget` / `data-theme` on the
widget div.

## 6. Enforce it (important)

Rendering the widget alone does not stop bots, because Shopify forms post
straight to Shopify. To actually block submissions, verify the `sentinel-token`
on a server — see `app-proxy-verify/README.md` for the App Proxy / headless /
Function patterns.
