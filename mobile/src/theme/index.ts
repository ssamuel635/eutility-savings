// Design tokens — the same palette and type as the website
// (../assets/css/styles.css), so the app and site read as one brand.

export const colors = {
  blue: '#007BB8',        // Star Command Blue — buttons, links, active tab, hero (white on it: 4.6:1)
  deep: '#00689C',        // pressed / selected: a deeper Star Command, never navy
  heading: '#294671',     // headings and big numbers: the Eutility navy (10:1 on white), ties every page to the brand
  ink: '#111827',         // strong labels and values: near-black for contrast
  inkSoft: '#374151',     // body copy
  inkMuted: '#5B6472',    // captions, helper text
  orange: '#F57C00',      // Energy Orange — accents (large only)
  orangeAA: '#A45400',    // orange for small text on white
  orangeDisplay: '#D86A00', // orange for large savings figures
  green: '#2E7D32',
  red: '#D32F2F',
  amber: '#FFB300',
  border: '#D5DBE3',      // the one hairline colour
  cloud: '#F4F6F8',
  canvas: '#FFFFFF',      // app background: white
  navy: '#294671',        // banners and big surfaces (the original Eutility navy)
  hero: '#294671',        // the Home hero: navy
  blueSoft: '#E3F3FB',    // tinted buttons and selected rows
  white: '#FFFFFF',
  blueTint: '#E6F4FB',
  orangeTint: '#FFF3E0',
  greenTint: '#E8F5E9',
  redTint: '#FDECEA',
  // Status only (20 Oct 2026): a light green that means "done" or "on track" —
  // switch progress, active plans, accepted bills. Never used for decoration, so
  // it always means the same thing and is hard to miss.
  success: '#1E7B44',     // text and ticks (5.6:1 on white)
  successTint: '#EDF7F0', // light fill behind status tags and ticks
  successLine: '#A3D9B8', // their border
  // WhatsApp buttons only (27 Oct 2026, matching the website's .btn--wa): green
  // with navy text, since white on this green fails contrast.
  whatsapp: '#25D366',
  whatsappPressed: '#1FB859',
} as const;

/** Icon tiles (actions, menus): white, with the glyph and a fine border in
 *  one of the logo's three colours — Star Command Blue, navy, orange. Nothing
 *  outside the brand palette, no fills, no glow: calm and commercial.
 *  (green/red/teal stay as names so older screens keep working, but they
 *  resolve to brand colours.) */
const BRAND_TILE = {
  blue: { fg: '#007BB8', bg: '#FFFFFF', border: 'rgba(0, 123, 184, 0.35)' },
  navy: { fg: '#294671', bg: '#FFFFFF', border: 'rgba(41, 70, 113, 0.35)' },
  orange: { fg: '#C2560A', bg: '#FFFFFF', border: 'rgba(245, 124, 0, 0.45)' },
} as const;
export const tiles = {
  ...BRAND_TILE,
  green: BRAND_TILE.blue,
  red: BRAND_TILE.orange,
  teal: BRAND_TILE.navy,
} as const;
export type TileTone = keyof typeof tiles;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, x3: 32, x4: 40 } as const;

// Same rules as the website (styles.css, v13): cards are nearly square (2),
// inputs 4, buttons and chips are pills; circles only for avatars and dots.
// `item` is for things you browse and tap one of (reward cards, home-type
// stories, the promo): rounded and lifted, so a row of them scrolls like cards.
export const radius = { xs: 2, sm: 4, md: 4, card: 2, item: 14, round: 999 } as const;

// One typeface, as on eutility.com.sg: Montserrat for everything. Headings
// and labels 600, body 400, bold (700) only for headings and big numbers.
export const fonts = {
  head: 'Montserrat_700Bold',
  headSemi: 'Montserrat_600SemiBold',
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semibold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
} as const;

// No shadows (Version 2): depth comes from borders and colour. Kept as empty
// styles so existing `...shadow.card` spreads stay valid.
export const shadow = { card: {}, lift: {} } as const;

/** Soft lift for browsable items and icon tiles only (never page sections). */
export const elevate = {
  item: { boxShadow: '0 6px 18px rgba(16, 38, 70, 0.12)' },
  /** A tile's shadow in its own colour, so it glows rather than greys. */
  tile: (hex: string) => ({ boxShadow: `0 4px 12px ${hex}55` }),
} as const;

/** Minimum touch target (Apple HIG / Material). */
export const TOUCH = 48;
