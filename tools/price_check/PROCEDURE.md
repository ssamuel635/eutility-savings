# Weekly retailer price check

An agent checks every retailer's official site, a script compares the findings
with the data the website uses, and a person approves the changes.
**Nothing is changed on the website or in the price sheet without approval.**

Run folder: `price-checks/<YYYY-MM-DD>/` (today's date, Singapore time).

## Step 1: collect (agent)

For each retailer below, read the **official** sources and write
`price-checks/<date>/raw/<key>.json` in the format further down.

| Key | Retailer | Where the reliable numbers are (from past runs) |
|---|---|---|
| geneco | Geneco | geneco.sg/residential/electricity-plans: **open in a real browser**; the plan cards (name, months, ¢/kWh incl. GST, promo) only render there. Promo T&C PDFs on get.geneco.sg |
| senoko | Senoko Energy | senokoenergy.com/households/price-plans and the plan fact sheets (`/custom/document/FS?plancode=…`), which show incl. and excl. GST |
| keppel | Keppel Electric | keppelelectric.com/residential-price-plan in a browser. The page loads Keppel's own plan list from `/api/AccountPlan/GetAllPlans` (name, rate with/without GST, fact sheet version): the most reliable read. Promos: /promotions |
| tuas | Tuas Power | **savewithtuas.com/our-electricity-plans/** (Tuas Power Supply's consumer site, not tuaspower.com.sg) and the fact sheet PDFs linked there |
| pacificlight | PacificLight | pacificlight.com.sg/support/factsheet (EMA fact sheets, one per plan); plan cards are images |
| sembcorp | Sembcorp Power | **sembcorppower.com/price-plan** in a real browser (the home page shows “undefined Month” until loaded). Each card shows ¢/kWh with and without GST and links its fact sheet |
| sp-group | SP Group tariff | spgroup.com.sg tariff page / quarterly press release (rate **with** 9% GST) |

Rules:
- Official retailer pages, fact sheets and T&C PDFs only. Third-party comparison sites
  may be used to find pages, never as the source of a number.
- Record prices **with GST** (`rate_incl_gst`), and without GST too when shown.
- If a page can't be read (images, scripts, mid-update), leave the price `null`,
  set `confidence: "low"` and say why in `notes`/`issues`. Never guess.
- `matches_id` is our plan id (see `assets/js/data/plans.js`); `null` for a new plan.
  Put our ids that are no longer offered in `not_found`. If you simply couldn't
  check a plan, leave it out of both (it will show as "couldn't verify").
- Promotions: title, value, code, and end date (`YYYY-MM-DD`) from the T&Cs where possible.
- **Copy the exact source text** that shows each price into `evidence` (e.g.
  `"24M Fixed Price Plan 24 Month 29.00c/kWh -(w/ GST)- 26.61cents/kWh (w/o GST)"`).
  The compare script rejects any number that isn't in that text.
- Discounts that depend on a condition (prompt payment, GIRO, card) are **not** part of
  `discount`; put them in `notes`. We list what every customer is guaranteed.
- **Contract terms.** For every plan, also read the **security deposit** and **early
  termination** sections of its fact sheet and add `terms` (format below). Copy the fact
  sheet's exact text into `deposit_source` / `etf_source`, and its version date into
  `factsheet_date`. Compare with our current wording (the plan's `deposit` and `etf` in
  `assets/js/data/plans.js`). Set `changed: true` only if an amount, percentage, period or
  who-it-applies-to differs, and then write the new wording for customers in `deposit` /
  `etf`, in the same style as ours (plain sentences, `S$` amounts, e.g. *"Billed on your first
  bill for all new sign-ups: HDB 1–2 room S$50; …"*). Every number you write must be in the
  copied text. If ours still matches, set `changed: false` and leave `deposit` / `etf` null.

JSON format (one file per retailer):

```json
{"retailer":"Senoko Energy","checked_at":"YYYY-MM-DD","gst_basis_on_site":"both|incl|excl|unknown",
 "sources":[{"url":"…","what":"…"}],
 "plans":[{"name":"…","matches_id":"senoko-energy-lifepower24 or null","type":"fixed|dot|tou|tiered|regulated|other",
   "contractMonths":24,"rate_incl_gst":29.0,"rate_excl_gst":26.61,
   "discount":{"value":1.64,"kind":"percent|cents"} or null,"dailyCharge_incl_gst":null,
   "tou":{"offPeak":{"window":"23:00–07:00","rate_incl_gst":20.05},"peak":{"window":"07:00–23:00","rate_incl_gst":36.95}} or null,
   "tiers":[{"from":0,"to":300,"rate_incl_gst":29.2}] or null,"category":"Standard|Green",
   "promo":{"title":"…","value":"…","code":"…","expires":"YYYY-MM-DD"} or null,
   "terms":{"factsheet_date":"YYYY-MM-DD","deposit_source":"exact fact sheet text","etf_source":"exact fact sheet text",
     "changed":false,"deposit":"new site wording or null","etf":"new site wording or null"},
   "source_url":"…","evidence":"exact text copied from the source","confidence":"high|medium|low","notes":"…"}],
 "not_found":["our ids no longer offered"],"issues":"…"}
```

## Step 1b: second read (separate pass)

Run `compare.py` once. Every row marked **high impact** (it would change the top 3
recommendations, move a typical bill by S$5+/month, or withdraw a plan) is blocked until
it is read a second time. A separate pass re-reads just those plans **by a different route**
(the fact sheet instead of the plan page, or the retailer's data feed), without looking at
the first answer, and writes `price-checks/<date>/verify/<key>.json` in the same format,
plus `"method"`. If the two reads disagree, the item stays blocked.

**Every contract-terms change** (`terms.changed: true`) also needs this second read: re-read that
plan's deposit and early termination sections and write its `terms` (with your own wording) into
`verify/<key>.json`. The two reads must have the same dollar amounts and percentages.

## Step 2: compare (script)

```bash
python3 tools/price_check/compare.py price-checks/<date>
```

This writes `report.html` (for review) and `changes.json` (proposed edits). It
also shows what the calculator would recommend at 450 kWh before and after.

Accuracy guards (an item that fails any of them is **blocked** and can't be approved):

| Guard | Catches |
|---|---|
| Number must appear in the copied `evidence` text | invented or mistyped numbers |
| With-GST = without-GST × 1.09 (±0.015) | reading the wrong column |
| Rate between 15¢ and 45¢; discount ≤ 25% / 8¢ | decimal slips, misreads |
| Move of more than 15% in one week | misreads (real moves this big are rare) |
| High-impact items need a second read that agrees | a single wrong read reaching the top recommendation |
| Contract terms: every number in the new wording must be in the copied fact sheet text, and a second read must find the same amounts and percentages | a wrong deposit or termination fee shown to customers (`terms.py`) |

The report's **Contract terms** section lists deposit and early termination changes to approve, and
plans whose fact sheet is newer than last week but where no change was found (worth a quick look).
Approved terms are written into the sheet's deposit and ETF columns for every row of that plan.

Gaps: a plan that can't be read keeps its current price and shows **when it was last
confirmed**. After 21 days unconfirmed it is marked **stale**; check it by hand or hide it.
The report's coverage card shows how many plans were confirmed this week.

Test the guards: `python3 tools/price_check/test_compare.py` and `python3 tools/price_check/test_terms.py`

## Step 3: approve (person)

Open `report.html`, tick what's right, type your name in the bar at the bottom and press
**Save approvals**. That saves `approved-<date>.json`. Save it in the run folder or leave it in
Downloads. Then ask Claude to "apply the approved changes for <date>".

Applying means:
1. `python3 tools/price_check/apply.py price-checks/<date>`. It applies only what was ticked,
   refuses to run without an approvals file, and keeps a copy of the file in the run folder.
   Add `--dry-run` first to see what will change.
2. `python3 tools/build_data.py --rates-date <date>`, then `npm run seo` (page titles carry the
   plan count and rates month), then `npm test`, then deploy.

Plans marked "couldn't verify" stay as they are until someone checks them by hand. New plans
are added to the sheet by hand.

## Run log

`price-checks/runs.csv` has one row per week. compare.py writes what the agent found
(coverage, changes, blocked, double-checked). apply.py adds who approved, how much, and when it
went live. Together they show how reliable the agent is over time.

Tests: `python3 tools/price_check/test_compare.py`, `test_terms.py` and `test_runlog.py`

## Weekly schedule

A scheduled Claude task runs Steps 1, 1b and 2 every Monday at 9:00am Singapore time. It runs on
the PC where the task was set up, so it only fires while that PC is on and the Claude app is open.
It never applies anything. It ends by giving the report's location and a short summary.
