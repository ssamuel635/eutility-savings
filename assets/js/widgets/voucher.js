// Voucher cards for the referral lucky draw: our own artwork (no shop logos;
// Eutility has no rights to use them). The colour shows the prize tier:
// blue S$5, teal S$10–20, purple S$50–100, gold S$500. Styles in rewards.css.

const BASKET = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9h18l-1.6 9.2a2 2 0 0 1-2 1.8H6.6a2 2 0 0 1-2-1.8z"/><path d="m8 9 3-5M16 9l-3-5"/><path d="M9 13v3M12 13v3M15 13v3"/></svg>`;

/** The tier for a prize value: 'blue' | 'teal' | 'purple' | 'gold'. */
export function tier(value) {
  if (value >= 500) return 'gold';
  if (value >= 50) return 'purple';
  if (value >= 10) return 'teal';
  return 'blue';
}

/**
 * A voucher card. size: 'reel' (the strip), 'mini' (tables), 'big' (the prize).
 * `sample` adds a SAMPLE stamp (previews never pay out).
 */
export function voucherCard(value, { size = 'reel', sample = false, cls = '' } = {}) {
  return `
  <div class="voucher voucher--${tier(value)} voucher--${size} ${cls}" role="img" aria-label="S$${value} grocery voucher">
    <div class="voucher__top"><span class="voucher__brand">Eutility Rewards</span><span class="voucher__icon">${BASKET}</span></div>
    <div class="voucher__value"><small>S$</small>${value}</div>
    <div class="voucher__label">Grocery voucher</div>
    ${size === 'big' ? `<div class="voucher__code"><span>Voucher code</span><strong>${sample ? 'SAMPLE-0000' : 'Sent on WhatsApp'}</strong></div>` : ''}
    ${sample && size === 'big' ? '<span class="voucher__stamp">Sample</span>' : ''}
  </div>`;
}
