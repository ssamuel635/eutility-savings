# Eutility Savings Subsite — local prototype

A working, mobile-first build of the Eutility savings comparison + SME load-aggregation subsite, based on:

- **Creative Brief v2.0** (Website Requirements – Eutility Singapore) — UX, colours, type, motion, WhatsApp handoff
- **Price comparison sheet** (Plans + Promotions tabs) — all 36 residential plans and current promos
- **V1 Figma wireframes** — Residential | SME toggle, SME multi-site flow, Referrals page

Plain HTML/CSS/JavaScript with **no dependencies and no build step**, so it runs anywhere and ports easily to WordPress or Webflow later.

**Deploying:** see `DEPLOY.md`. It's a static site — Vercel serves the folder as-is, no database required.

---

## Do I need a database?

Not for review, and not for a first public version that hands customers off to
WhatsApp or email.

Everything the customer does — signing up, logging in, saving a savings check,
uploading a bill, their referral code — is held in **their own browser** via
`localStorage`, behind `assets/js/services/`. So the platform behaves like the
real thing with zero infrastructure and zero cost.

What that means in practice:

| | Today (no backend) | Needs a backend |
|---|---|---|
| Sign up, log in | Works, per browser | Same account across devices |
| Saved checks, bills | Works, per browser | Eutility can actually see them |
| Bill upload | Kept locally, never sent | Reaches Eutility for review |
| Referral leaderboard | Sample data, clearly labelled | Real standings |
| Switch request | Goes out by WhatsApp or email | Logged in a CRM |

The switch journey is genuinely functional without a database, because the
handoff is a real message: WhatsApp to the chatbot on `+65 8227 7121`, or
email to `customerservice@eutility.com.sg`. Every WhatsApp button has the email
option beside it.

When a backend does arrive, only the four files in `assets/js/services/` change —
`store.js`, `customer.js`, `plans-service.js`, `rewards.js`. Set `MOCK = false`
in `store.js` and swap the read/write bodies for `fetch()` calls. No page code
moves.

## Customer records: Excel now, Freshworks later

Sign-ups, profile changes, savings checks, bills and app switch requests are
sent to a CRM. For now the CRM is an Excel workbook; later it's Freshworks,
and nothing in the website or app changes when it does.

```
Website  assets/js/services/crm.js ─┐
                                    ├─► /api/crm/*  server.js ─► server/crm ─┬─ excel.js       (now)
App      mobile/src/api/crm.ts ─────┘                                        └─ freshworks.js  (later)
```

- **Where:** `data/crm/eutility-customers.xlsx`, with sheets *Customers*,
  *Applications*, *Savings checks* and *Bills*. Bill files sit in
  `data/crm/bills/`. The folder is git-ignored and never deployed, because
  it holds personal data. Run `npm install` once, then `npm start`.
- **Staff use it directly:** change an application's **Stage** (a dropdown)
  or write a **Note to customer**, then save. The app's Track tab picks it up
  the next time it's opened. "Needs attention" plus a note asks the customer
  for something, such as a clearer bill photo.
- **Excel open while the server runs** is fine. Windows locks the file, so
  new records wait in `pending.jsonl` and are written once it's closed.
  Edits staff save are never overwritten.
- **The app on a phone:** copy `mobile/.env.example` to `mobile/.env` and set
  `EXPO_PUBLIC_CRM_URL` to this computer's Wi-Fi address (e.g.
  `http://192.168.1.20:5173`). The web preview uses `localhost:5173`.
- **Remote tests:** `npm start`, then `npm run tunnel` in a second terminal.
  It opens a free Cloudflare quick tunnel and prints a public `https://…`
  address for the website and the `EXPO_PUBLIC_CRM_URL` line for the app
  (put it in `mobile/.env`, restart Expo). Testers anywhere then write into
  the workbook on your PC. One-time install:
  `winget install --id Cloudflare.cloudflared`. The address changes each run
  and works only while your laptop and both commands are running. Anyone with
  it can open the site, so share it with testers only.
- **Always-on testing** (no laptop): host `server.js` on Railway/Render with a
  persistent volume for `data/crm/`, or switch to Freshworks.
- **On Vercel:** the static site has no server, so records wait in each
  visitor's browser (an outbox) and nothing reaches the workbook.
- **Switching to Freshworks:** set `CRM_PROVIDER=freshworks`,
  `FRESHWORKS_DOMAIN` and `FRESHWORKS_API_KEY`. Field mapping is in
  `server/crm/freshworks.js`; create the `cf_…` custom fields first and test
  in a sandbox (the note and file calls are marked "verify").
- **Not production security:** the API has input checks, a rate limit and an
  origin allowlist, but no customer sign-in yet. That arrives with the real
  backend.

## Accounts and login

`login.html` signs in against accounts created by the sign-up wizard in the same
browser. A demo account is seeded so the site can be looked at without signing
up first:

```
demo@eutility.com.sg / getcontrol
```

The password check in `services/customer.js` is **not security** — it's a
scramble, not a password hash, and everything is client-side. It exists so the
screen behaves correctly (wrong password refused, unknown email refused) until
there's a server. To keep the whole site private during review, use Vercel's
Deployment Protection rather than this page; `DEPLOY.md` explains.

## Copy and the Eutility business profile

Wording across the site reflects the actual business rather than a generic
comparison-site voice:

- Eutility is an **independent energy and telecommunications consultant**,
  family owned and Australian, operating since **1979**
- It is **not an electricity retailer** — Eutility Singapore is registered with
  ACRA under "activities of brokers and agents for electric power and natural
  gas", which is the trust story the FAQ leans on
- **Eutility Singapore Pte Ltd**, UEN **201624008N**, incorporated 2 September
  2016, at 140 Paya Lebar Road, #05-08, AZ @ Paya Lebar, Singapore 409015
- The Australian business manages energy and telecoms for 2,000+ businesses
  across 19,000+ sites, which is where the SME credibility comes from

These live in `CONFIG.company` (`assets/js/config.js`) so the FAQ and footer
stay consistent. One FAQ answer — how Eutility is paid — is deliberately left as
a draft for Eutility to confirm; it's marked in the page.

---

## Run it locally

You need Node 18+ (or Python 3).

```bash
cd eutility-savings
npm start            # → http://localhost:5173
# or, without Node:
python3 -m http.server 5173
```

`npm start` is better: it also handles clean URLs (`/calculator`) and referral links (`/r/ABC123`).
Don't open the HTML files directly with `file://`. The browser blocks JavaScript modules that way.

Run the tests for the pricing maths:

```bash
npm test             # 11 tests: fixed, discount-off-tariff, time-of-use, tiered, daily charge, SME tiers
```

## What this is

A frontend-first prototype of Eutility's **customer platform**, not just a calculator:
discover plans → check savings → sign up → upload your bill → keep a profile → earn rewards.
Customer data, bills and rewards are **mock** (stored in the visitor's browser through the
services layer) so the screens can be reviewed before any backend exists.

```
UI (pages, widgets)  →  services/  →  data
                         plans-service.js   → assets/js/data/plans.js (generated from the Excel sheet)
                         customer.js        → store.js → localStorage   (later: API + CRM)
                         rewards.js         → store.js + sample data    (later: referral backend)
```

Nothing above the services layer knows where data comes from, so swapping in a real API
means editing `assets/js/services/*` only.

## Pages

| Page | File | What it does |
|---|---|---|
| Home | `index.html` | Hero + quick calculator, what Eutility does, Singapore imagery, plan teaser, testimonials, 3 steps, account and rewards teasers |
| Explore Plans | `plans.html` | Browse all 34 comparable plans: usage slider, type chips (fixed / no lock-in / green / night saver / discount-off-tariff / promotions), retailer filter, sort; plan cards with the estimated monthly bill; a detail sheet with rates, contract, deposit, early termination fee, promo and source |
| Create account | `signup.html` | 4-step wizard: your details → your home (address, postal, home type) → electricity (retailer, plan, usage, SP account) → bill upload, then review + consent. Saves the customer, runs a savings check and offers a WhatsApp confirmation |
| My account | `account.html` | Dashboard: profile, electricity details, saved savings checks, uploaded bills, rewards progress, sign out / clear demo data |
| Savings Calculator | `calculator.html` | **Residential**: usage slider, retailer → plan, contract filter, green-only, time-of-use assumption. Shows a "thinking" loader, then the count-up reveal, current vs recommended plan, promos, an animated bar chart and a table of every plan. **SME** (`#sme`): company name, add/remove sites, running total, volume-tier bar, estimated savings, "Talk to Eutility" |
| How It Works | `how-it-works.html` | Four-step scroll journey: WhatsApp chat mockup, bill-scan animation, savings count-up, confetti |
| Eutility Rewards | `referrals.html` | **Leaderboard first**, then your progress towards the next reward, your link (copy / share), reward placeholders, recent activity and how it works |
| Testimonials | `testimonials.html` | Grid of testimonial cards |
| FAQ | `faq.html` | Search, grouped accordion, "Still have questions? WhatsApp us" |
| About & Contact | `about.html` | Story, mission, team, WhatsApp / email / phone |
| Legal | `legal.html` | Privacy and Terms placeholders |

Brief features that are built:

- WhatsApp handoff with a pre-filled message. On desktop it shows a **QR code** so the user can continue on their phone.
- Sticky WhatsApp bar at the bottom on mobile.
- Hamburger menu and sticky header.
- Count-up animation lasting 1.5 s.
- Confetti when savings are more than S$100 a year.
- An optional "ding" sound. It is off by default and the user turns it on.
- Pulsing **Switch Now** button (blue, per Figma).
- Fade-and-slide reveals as you scroll.
- All motion is switched off when the user's device asks for reduced motion.

## Customer journey

```
Visitor → Explore plans ─┐
                         ├→ Check savings → Sign up → Upload bill → Confirm on WhatsApp → Switch
Visitor → Calculator ────┘                     ↓
                                          My account (profile · checks · bills · rewards)
```

## Look & tone (v5)

- **Warmer surfaces:** alternating sections use a warm sand (`--sand #FAF7F2`) instead of grey, with a soft orange/blue wash behind the hero. Less boardroom, more living room.
- **Singapore cues:** a heavily blurred skyline photo (`assets/img/bg-blur-light.jpg` / `-dark.jpg`, made by `tools/make_blur_bg.py` (removed 15 Oct 2026, photo source unconfirmed)) sits under a near-opaque wash behind every page's opening section, the navy footer and the rewards board; an HDB-and-shophouse silhouette (`assets/img/skyline.svg`, from `tools/make_skyline.py`) runs along the top of the footer; the Marina Bay photo anchors the homepage; the office photo is on About; testimonials use Singapore names and neighbourhoods.
- **Header:** nav stays on one line from 1024 px up, the logo never gets squeezed, and the account chip truncates long names.
- **Copy:** plain, everyday wording — "We check, you decide, we handle the rest", "We do the switching", "Got a friend still overpaying?" — instead of corporate phrasing.

## Text colour over photography (v7)

Headlines and copy sit over a blurred photo, so the type uses a navy-leaning ink scale rather than black/grey:

| Token | Value | Used for | Contrast on the wash |
|---|---|---|---|
| `--ink` | `#16233A` | headlines | ~14:1 |
| `--ink-soft` | `#3A4A63` | body copy in page openings | ~8:1 |
| `--ink-muted` | `#5C6A80` | captions, helper text | ~6:1 |
| `--eyebrow-ink` | `#1C4F7C` | eyebrows / small caps | ~7.7:1 |

A soft diagonal scrim (`main > section:first-of-type::after`) brightens the side the copy sits on, so the skyline stays visible on the other side without fighting the words.

## Loading & arrival animations (v7)

- **First-screen choreography:** header, eyebrow, headline, lead, then the card rise in sequence (80 ms apart) once the page is ready, with a 400 ms failsafe.
- **Navigation progress bar:** a thin blue-to-orange bar starts on any internal link click and completes on the next page.
- **Skeletons:** the plan grid shows shimmering placeholder cards before the first render.
- **Photo fade-up:** images fade and settle from a slight zoom once decoded, over a gradient placeholder.
- **Arrivals:** leaderboard rows stagger in; the savings figure gets a one-off orange glow as it counts up.
- All of the above is disabled under `prefers-reduced-motion`.

## Reload behaviour (v8)

Refreshing used to stall for a beat and then snap into place. Five causes, five fixes:

- **Header space is reserved before JS runs.** The header is injected by `layout.js`, so the first painted frame had no header and everything jumped down ~110 px. `html:not(.shell-ready) body > main` holds the row open; `initLayout` adds `shell-ready` in the same tick it inserts the header, so no frame shows both or neither.
- **The boot animation no longer waits for `window.load`.** It waits on `document.fonts.ready` (capped at 400 ms) instead of every image on the page, which is what left the first screen blank on a refresh.
- **The headline rise is gated on `html.is-ready`.** It used to start the moment the CSS parsed, while the `<h1>` was still at `opacity: 0`, so the animation burned off unseen and the headline appeared flat. `boot-in` now also skips any element containing `.rise`, so nothing animates twice.
- **The backdrop is preloaded.** `bg-blur-light.jpg` (19 KB) has a `rel="preload"` on every page, so the hero photo is there in the first frame instead of fading in over white.
- **Reloads skip the cross-page transition,** via `pagereveal` + `navigation.type === 'reload'` — that transition holds the old frame on screen while the new one loads, which is exactly what read as hanging.
- Plus: the sticky header ignores scroll events for the first 500 ms, so restoring your position on a deep reload no longer counts as "scrolling down" and hides it.

## Page arrival (v8)

The complaint was that a page would sit there looking half-drawn, then animate a beat later. Four causes:

- **Content already on screen is no longer a scroll reveal.** `observeReveals` used to hand everything to the IntersectionObserver, so what you could already see waited for a callback and then ran a 0.9 s fade. Anything inside the opening viewport is now marked `reveal--instant` and handed to the boot sequence; only what's below the fold is observed.
- **One screen, one animation system.** Hero elements carried both `.reveal` (from the markup) and `.boot-in` (added by `bootSequence`), so they animated twice and arrived blurred and late. `bootSequence` now collects everything visible on load — hero or list — into a single ladder in DOM order, capped at 9 items and 6 stagger steps.
- **The first-visit loader is homepage-only.** On every other page it was a white sheet sitting over content that had already rendered. It's also shorter now (fonts-ready or 700 ms, 0.35 s fade) and `pointer-events: none`.
- **The plans grid renders immediately.** Plan data ships with the page, so the 220 ms skeleton delay was invented latency. The skeleton markup stays behind a `PLANS_READY` flag for when this comes from an API.

Timings across the board: boot stagger 0.04 s + 0.06 s per step (was 0.08), boot fade 0.52 s (was 0.7), headline rise 0.62 s (was 0.9), fonts wait capped at 250 ms (was 400). Every page now stops moving inside ~1.1 s.

## Hero scrim stacking (v8)

`main > section:first-of-type` is positioned, so it painted *above* the plain sections after it — and its 620 px photo wash spilled over them as a permanent grey veil. On the homepage the hero is tall enough to hide this; on FAQ and Explore Plans it greyed out the first accordion, the "SAVINGS" group heading and the plan count. Fixed with `main > section:first-of-type ~ section { position: relative; z-index: 1 }`. This was a rendering bug, not an animation — it did not clear on its own.

## Motion & usability (v3)

- **Page transitions:** pages cross-fade when you move between them (Chrome, Edge, Safari 18+). A logo loader shows on the first visit of each session (max 1.8 s).
- **Header:** hides while scrolling down and comes back when scrolling up. There's also a back-to-top button, and the sticky WhatsApp bar slides away at the footer.
- **Hero:** the headline rises into place. The Residential | SME toggle has a sliding highlight. There's a looping strip of the retailers we compare.
- **Calculator:**
  - Home-type presets (HDB 3-room … Landed) move the slider smoothly for people who don't know their kWh.
  - A live "Your bill today is about S$X" updates as you slide.
  - A "?" tip explains what kWh means.
  - The result scrolls into view, and the saving is also shown as "≈ N months of electricity, on us".
  - Result cards animate in one after another.
- **Everywhere else:** buttons and cards lift slightly on hover, sections fade in as you scroll, and FAQ answers open and close smoothly (newer Chrome).
- **Speed:** internal pages are prefetched when you hover over or tap a link.
- **Reduced motion:** if the user's device is set to reduce motion, all of the above is switched off.

## Update the prices

The site reads its prices from `assets/js/data/plans.js`. That file is **generated from the Excel sheet**, so don't edit it by hand.

```bash
pip install openpyxl
python3 tools/build_data.py                         # uses data/price-comparison-sheet.xlsx
python3 tools/build_data.py path/to/new-sheet.xlsx  # or a newer copy
```

Keep the same column layout. Rows with the same Retailer + Plan Name are merged into one plan (time-of-use and tiered plans use one row per band). Promotions are matched to plans by Retailer + Plan Name.

## How savings are calculated (`assets/js/calc.js`)

`monthly bill = kWh × rate + daily charge × 30.4 days`, worked out for every plan. Savings are your current plan's bill minus the other plan's bill, × 12 for the yearly figure.

| Pricing type | Treatment |
|---|---|
| Fixed / Regulated | kWh × rate |
| Discount off tariff | `%` → tariff × (1 − d). Values marked `*` in the sheet are **cents off** → tariff − d |
| Time of use | You choose the share of usage in off-peak hours (default 30%). For Keppel "Nights + Weekends", weekends also count as off-peak |
| Tiered (Stack It Up 24) | Each band's rate applies only to the kWh inside that band (assumed — confirm with PacificLight) |
| Daily charge | Added on top (Easy Peasy, Easy Save, 9 to 9) |

- **Default filter:** contracts up to 24 months. Otherwise the 60-month Classic 60 would top most results. Users can choose "Any length".
- **Referral-only plans** (Keppel FIXED24 Special) are left out unless the user switches them on.
- **Promotions** are shown next to the recommended plan but are **not** added to the savings figure.
- **Flo Energy** is left out because its plan hasn't launched.

## ⚠️ Placeholders to replace before launch

| Item | Where |
|---|---|
| WhatsApp number (currently the chatbot, `6582277121`) | `assets/js/config.js` → `whatsappNumber` |
| Email and phone | `assets/js/config.js` |
| **SME aggregation tiers and discounts (made up)** | `assets/js/config.js` → `smeTiers`. The baseline is the best ≤24-month fixed residential rate in the sheet, which is also an assumption |
| Logo is in (314×112 PNG). A larger or SVG export would look sharper on high-resolution screens | `assets/img/eutility-logo.png`, symbol + favicons in `assets/img/` |
| Home-type usage presets are rounded estimates | `assets/js/config.js` → `homePresets`. Confirm against EMA's latest statistics |
| Hero illustration → real Singapore photography or cinemagraph | `assets/img/hero-hdb.svg` (made by `tools/make_hero_svg.py`) (removed 15 Oct 2026, photo source unconfirmed) |
| Customer stories: the site shows "Homes like yours" (estimates worked out from the price sheet) instead of testimonials. Add real stories only with the customer's permission | `assets/js/widgets/home-story.js` |
| Rewards: counts start at zero and there is no leaderboard until the referral backend reports real switches. Reward values, qualifying rules and the "next reward at 7" target still need Eutility to confirm | `assets/js/services/rewards.js`, `assets/js/config.js` → `rewards` |
| Customer accounts, bills and saved checks live in the browser only — no login, no database | `assets/js/services/customer.js` + `store.js` |
| Team photos and bios | `about.html` |
| Privacy Policy and Terms text | `legal.html` |
| FAQ answers are drafts (switching process, fees, data handling) | `assets/js/pages/faq.js` |
| Chat icon is generic | `assets/js/icons.js` → `chat`. Swap in the official WhatsApp glyph from Meta's brand resources if you want the logo |

## Design updates from Figma (Sep 2026)

- Primary blue **#26649B** (buttons, links, active nav), navy **#294671** (footer, selected toggle). Serif headlines are **#212121**.
- Official "eutility / get control" logo in the header. The footer has no logo, matching Figma.
- On mobile there's a tab strip under the header (Savings Calculator · How It Works · Referrals · FAQ). The desktop header is logo · nav · Check My Savings.
- The homepage hero has the "Check your savings" card with the Residential | SME toggle. Residential shows the calculator right in the card; SME links through to the SME calculator. Below it are the wide image and the referral banner.
- Orange buttons use bright **#F57C00**.
- Referral card: "Your referral link" title, Copy Link as the main button, Share on WhatsApp as an outline button. Stats cards have soft shadows.
- **Switch Now** is blue (Figma) instead of the brief's pulsing red. To go back to red, change `.btn--urgent` in `styles.css`.
- **Contrast:** white text on #F57C00 orange is about 2.9:1, below the WCAG AA 4.5:1 for normal text. If you need AA, use a deeper orange such as #C25E00.

## Where this differs from the brief

- **Navigation:** Savings Calculator · How It Works · Referrals · FAQ, plus a **Check My Savings** button. WhatsApp sits in the footer and the sticky mobile bar. This follows the V1 wireframe, which gives Referrals and SME a home. Testimonials and About are in the footer and the mobile menu.
- **Colours** now follow the Figma file (see above). All colours are variables at the top of `assets/css/styles.css`.
- **Fonts:** Canela / Freight Display are paid fonts, so **Newsreader** stands in and **Inter** is used for everything else. Both are stored in the project and load without internet. To switch fonts, change `--font-serif`.

## Project structure

```
index.html, calculator.html, how-it-works.html, referrals.html,
testimonials.html, faq.html, about.html, legal.html, 404.html
server.js                 zero-dependency dev server (clean URLs, /r/CODE referral links)
assets/
  css/styles.css          design tokens + all components
  js/config.js            ← edit: WhatsApp number, contacts, SME tiers, defaults
  js/calc.js              pricing engine (pure functions, unit-tested)
  js/layout.js            header, menu, footer, WhatsApp handoff + QR, referral capture, reveals
  js/fx.js                count-up, confetti, sound
  js/widgets/             residential calculator, SME calculator, testimonial card
  js/pages/               one small script per page
  js/data/plans.js        GENERATED from the price sheet
  js/data/testimonials.js sample content
  fonts/, img/, vendor/qrcode.js (MIT)
data/price-comparison-sheet.xlsx
tools/build_data.py       Excel → plans.js
tests/calc.test.mjs
```

## Next steps

1. Put in the real WhatsApp number and logo, then test the handoff on a phone.
2. Confirm the SME pricing tiers with Eutility's commercial team.
3. Decide on the CMS. Pages are plain HTML sections, so they can be moved into WordPress blocks or Webflow. `calc.js` + `plans.js` can be dropped in as-is.
4. Build the referral backend: issue codes, attribute sign-ups, count rewards.
5. Add analytics events: `calc_completed`, `switch_clicked`, `whatsapp_clicked`, `sme_lead`, `referral_shared`.
#   e u t i l i t y - s a v i n g s  
 #   e u t i l i t y - s a v i n g s  
 #   e u t i l i t y - s a v i n g s  
 #   e u t i l i t y - s a v i n g s  
 #   e u t i l i t y - s a v i n g s  
 #   e u t i l i t y - s a v i n g s  
 #   e u t i l i t y - s a v i n g s  
 