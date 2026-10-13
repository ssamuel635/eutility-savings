// Design tokens — the same palette and type as the website
// (../assets/css/styles.css), so the app and site read as one brand.

export const colors = {
  blue: '#007BB8',        // Star Command Blue — buttons, links, active tab, hero (white on it: 4.6:1)
  deep: '#00689C',        // pressed / selected: a deeper Star Command, never navy
  ink: '#111827',         // headlines: near-black for contrast
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
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, x3: 32, x4: 40 } as const;

// Same rules as the website (styles.css, v13): cards are nearly square (2),
// inputs 4, buttons and chips are pills; circles only for avatars and dots.
export const radius = { xs: 2, sm: 4, md: 4, card: 2, round: 999 } as const;

export const fonts = {
  serif: 'Newsreader_600SemiBold',
  serifMedium: 'Newsreader_500Medium',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

// No shadows (Version 2): depth comes from borders and colour. Kept as empty
// styles so existing `...shadow.card` spreads stay valid.
export const shadow = { card: {}, lift: {} } as const;

/** Minimum touch target (Apple HIG / Material). */
export const TOUCH = 48;
