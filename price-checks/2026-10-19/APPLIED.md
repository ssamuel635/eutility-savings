# Price check 2026-10-19: what was applied

Applied 19 Oct 2026 with `tools/price_check/apply.py` (approved by ebin, 2026-10-19T02:08Z), then
`build_data.py --rates-date 2026-10-19` and `npm run seo`. `npm test`: 53/53 passing. Not deployed.

**Prices (3, all double-checked against Keppel's 19 Oct fact sheets).**
- Keppel FIXED24: 29.00¢ → 30.90¢
- Keppel FIXED24 Special: 28.50¢ → 30.40¢
- Keppel FIXED36: 28.90¢ → 30.63¢

**Promotions (20 approved).** Geneco promo end dates moved to 2 Nov 2026; PacificLight GETBACK24 / GETBACK36
payback deals added; Keppel and Senoko promos refreshed. Promotion removed: Tuas PowerFIX 12. PacificLight Classic 60's prompt-payment
promotion (extra 5%, up to 8% in total) was removed by the apply step and then restored at Ebin's request; the
20 Aug fact sheet still lists it.

**Not approved:** Tuas PowerFIX 24 / 36 / 25 G+ promotions (end dates unclear). They keep last week's text.

**Recommended plan at 450 kWh:** unchanged. Geneco Get It Fixed 24 at 29.00¢, saving about S$117/yr.
