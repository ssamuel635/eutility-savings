// Photography used across the site. Each entry: the file, its alt text, and
// who took it. These are stock photos, free for commercial use under the
// Unsplash License (no credit required; given here anyway). To use Eutility's
// own photos, replace the files in assets/img/people/ keeping the same names.

const DIR = 'assets/img/people/';

export const PHOTOS = {
  kites: { src: DIR + 'kites-marina-barrage.jpg', alt: 'A family flying kites at Marina Barrage, with the city skyline behind them', credit: 'John T', page: 'https://unsplash.com/photos/OedmBcmHS9Q' },
  hdb: { src: DIR + 'hdb-estate.jpg', alt: 'HDB blocks under a cloudy sky', credit: 'Shermin Ng', page: 'https://unsplash.com/photos/1PH2uwpYt1w' },
  sofa: { src: DIR + 'father-daughter-sofa.jpg', alt: 'A father and his daughter relaxing on the sofa at home', credit: 'OPPO Find X5 Pro', page: 'https://unsplash.com/photos/mCxk_ba7CJ8' },
  livingRoom: { src: DIR + 'family-living-room.jpg', alt: 'A family playing a board game together in their living room', credit: 'National Cancer Institute', page: 'https://unsplash.com/photos/xDSD3Vmzh70' },
  motherChild: { src: DIR + 'mother-child-sofa.jpg', alt: 'A mother and her daughter laughing together on the sofa', credit: 'Vivek Kumar', page: 'https://unsplash.com/photos/a-_1PPjnbUg' },
  dinner: { src: DIR + 'family-dinner.jpg', alt: 'A family having dinner together at home', credit: 'National Cancer Institute', page: 'https://unsplash.com/photos/BQPi8F_UON0' },
  neighbours: { src: DIR + 'neighbours-outdoors.jpg', alt: 'Two friends chatting outdoors in the neighbourhood', credit: 'Yusron El Jihan', page: 'https://unsplash.com/photos/9rzI0FuCS_s' },
  voidDeck: { src: DIR + 'void-deck-chess.jpg', alt: 'Neighbours playing a game of chess outside', credit: 'Singapore Stock Photos', page: 'https://unsplash.com/photos/ZJpIE96cQxw' },
};

/**
 * <img> markup for a photo. If the file isn't there yet, layout.js swaps it
 * for a tinted panel, so a missing photo never shows a broken image.
 */
export function photo(key, { cls = '', eager = false, sizes = '100vw' } = {}) {
  const p = PHOTOS[key];
  if (!p) return '';
  return `<img class="photo ${cls}" src="${p.src}" alt="${p.alt}" sizes="${sizes}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" width="1200" height="800" data-photo>`;
}
