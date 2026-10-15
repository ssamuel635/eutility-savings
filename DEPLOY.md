# Deploying to Vercel

The site is static — plain HTML, CSS and ES modules. There is no build step, no
server, and no database. Vercel serves the folder as-is.

`vercel.json` and `.vercelignore` are already set up:

- **`framework: null`, empty build/install commands, `outputDirectory: "."`** —
  these are load-bearing, don't remove them. Without them Vercel spots
  `package.json` + `server.js`, decides this is a Node app, and deploys
  `server.js` as a serverless entrypoint instead of serving the folder. The
  symptom is every page returning 404 except `/`.
- `/r/CODE` → `/?ref=CODE` so referral links work
- long cache on fonts and images
- `X-Robots-Tag: noindex` plus `robots.txt`, so the prototype doesn't turn up in
  Google while Kenneth is reviewing it. **Remove both when the site goes live.**
- `.vercelignore` keeps `package.json`, `server.js`, `tests/`, `tools/`,
  `data/` and the docs out of the deployment. Its paths are **anchored with a
  leading slash on purpose** — a bare `data/` also matches `assets/js/data/`,
  which is the generated plan list the entire site depends on.

Internal links all use `.html`, so `cleanUrls` is deliberately off: no redirect
hop on every click, and `/` serves the homepage.

## Option 1 — drag and drop (no CLI)

1. Go to https://vercel.com/new
2. Choose the **deploy without Git** option and drop this whole folder on it
3. Vercel gives you a `*.vercel.app` URL — send that to Kenneth

## Option 2 — the CLI (better, gives you one-command redeploys)

From this folder, in PowerShell or Command Prompt:

```
npx vercel login
npx vercel --prod
```

First run asks a few questions; accept the defaults (framework: Other, build
command: none, output directory: `.`). Every later deploy is just
`npx vercel --prod`.

## Option 3 — connect it to GitHub (best once things settle)

Push this folder to a GitHub repo, then import it at https://vercel.com/new.
Vercel redeploys on every push, and you get a preview URL per branch.

## Redeploying

From this folder: `npx vercel --prod`. Before you do, if you changed any
`import` lines, run `npm run preload` — it rewrites the
`<link rel="modulepreload">` block in every page so the browser fetches all the
JS in parallel instead of five round trips deep.

## Production hardening already in place

- **Content-Security-Policy** in `vercel.json`: scripts, fonts, images and
  connections are same-origin only. `server.js` sends the same headers locally,
  so a violation shows up in dev before it ships.
- **Link previews**: every page has Open Graph title and description tags. There is
  no preview image for now (Removed 15 Oct 2026: the blurred skyline backdrop, the link-preview image and the unused hero illustration came from a photo whose source couldn't be confirmed.) Add a licensed 1200×630 image and an
  `og:image` tag (in `tools/seo.mjs`) when one is chosen.
- **No layout shift**: `<main>` isn't painted until the page script has rendered
  into it (with a CSS failsafe at 1.2 s). Measured CLS is ≤ 0.001 on every page.
- **Lazy QR code**: the 57 KB QR library only loads when the desktop WhatsApp
  modal opens.
- `site.webmanifest` for add-to-home-screen.

## Before this stops being a prototype

- Delete `robots.txt` and the `X-Robots-Tag` header in `vercel.json` (Lighthouse
  SEO jumps from 69 to ~100 — "page is blocked from indexing" is the only
  failing SEO check, and it's deliberate for now)
- Point a real domain at it (Vercel → Project → Settings → Domains), then
  find-and-replace `https://eutility-savings.vercel.app` across the HTML — it's
  the canonical and Open Graph URL on every page
- Everything under "What still needs a backend" in `README.md`

## Private-preview password gate

While the site is in development it's locked behind a sign-in page.
`middleware.js` (Vercel Routing Middleware) runs on Vercel before any file is
served, so pages, scripts and the plan data are all unreachable until you sign
in. There's no database: accounts live in two environment variables in
Vercel (Project → Settings → Environment Variables, Production and Preview).

| Variable | What it holds |
|---|---|
| `GATE_SECRET` | Random string that signs the session cookie. Change it to sign everyone out. |
| `GATE_USERS` | Comma-separated accounts, each `name:role:salt:hash`. Role is `admin` or `viewer`. Passwords are stored only as salted PBKDF2 hashes. |

- **Sign in:** any page shows the sign-in form; you land back on that page afterwards. Sessions last 14 days.
- **Admin page:** `/__gate/admin` (admins only) lists accounts and how to manage them.
- **Sign out:** `/__gate/logout`.
- **Add or change an account:** `node tools/gate-user.mjs <name> <viewer|admin> <password>` prints the entry. Add it to `GATE_USERS` (comma-separated) and redeploy.
- **Remove an account:** delete its entry from `GATE_USERS` and redeploy. Its session stops working immediately.
- **New secret:** `node tools/gate-user.mjs --secret`.
- If either variable is missing, the site shows "Not available yet" to everyone. It fails closed, never open.
- Local preview (`npm start`) isn't gated; the gate only runs on Vercel.
- **Going public:** delete `middleware.js` and redeploy.

The in-site customer login (`login.html`) is a separate, mock customer feature.
It is not part of the gate.

### Vercel Authentication (Deployment Protection)

This is set to **Standard Protection**. The main address
(eutility-savings.vercel.app) goes through the password gate above. Preview
links and one-off deployment URLs (`eutility-savings-xxxx-….vercel.app`) still
need your Vercel login. Don't set it to "All deployments": that puts a Vercel
login in front of the main address too, and Kenneth has no Vercel account.

## Keeping the numbers current (do this every quarter)

SP Group changes the household tariff on 1 January, 1 April, 1 July and 1 October.
Every saving on the site is measured against it, so update it the week it changes.

1. Open `data/price-comparison-sheet.xlsx`, Plans tab, row **SP Group · Regulated Tariff**.
   Put the new rate **including GST** in "Rate (¢/kWh)". For example, Oct–Dec 2026 is 31.16
   (28.59 before GST).
2. Re-check retailer rates and promotions in the sheet. Promotions with an Expiry Date
   in the past are dropped automatically. The site also hides them the day after they end.
3. Rebuild the data, giving the date you checked the retailer rates:
   `python3 tools/build_data.py --rates-date YYYY-MM-DD`
   The script prints the plan count, the tariff and its quarter. Check them.
4. Run `npm test`, then `vercel deploy --prod --yes`.

The site shows "rates as at <date>" and the tariff quarter wherever it gives an
estimate, so a stale sheet is visible rather than silent.

