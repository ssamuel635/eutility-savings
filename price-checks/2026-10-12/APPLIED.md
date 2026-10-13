# Price check 2026-10-12: what was applied

Applied 12 Oct 2026 with `tools/price_check/apply.py`, then `build_data.py --rates-date 2026-10-12`.
`npm test`: 34/34 passing.

**Gaps closed before applying.** I re-read Sembcorp (sembcorppower.com/price-plan) and Geneco's
plan cards in a real browser, so no plan is left unverified.

**Second reads.** These are now double-checked:
- Keppel: the retailer's own plan data feed.
- Tuas: the plans page in a browser.
- PacificLight: the Savvy Saver 24 and Classic 60 fact sheets.
- Geneco: the GIF24 site banner.

**Prices.** 23 plans updated. Two withdrawn plans were removed from the sheet: Keppel SURESAVE DOT and
Tuas PowerDOT 6.

**Blocked: Keppel WEEKEND SAVER peak rate.** Keppel's own data says 39.89¢, but the same page's text
says 39.90¢. It stays at 39.90¢ until someone reads the fact sheet.

**PacificLight Classic 60.** It is now listed as 3% off the tariff, which every customer gets. The extra
5% for paying on time is shown as a promotion ("up to 8%" in total). The sheet previously said 8¢ off,
which was wrong.

**Promotions.** These were rewritten in plain customer wording.

Tuas promotions come from the plans page as read in a browser on 12 Oct. That page still shows the
ONLINE and ONGREEN rebates, so I kept them. The first pass had read different codes and dates from
the T&C pages; I didn't use those.

Promotions are not yet double-checked the way prices are. They don't change the savings figure, but
they do appear on the plan cards.

**Recommended plan at 450 kWh.** It changes from Keppel SURESAVE DOT (~S$202/yr) to
Geneco Get It Fixed 24 at 29.00¢ (~S$117/yr). That rate is limited to Geneco's first 1,000 sign-ups.
