// Photography used across the site. Each entry: the file, its alt text, and
// who took it. These are stock photos, free for commercial use under the
// Unsplash License (no credit required; given here anyway). To use Eutility's
// own photos, replace the files in assets/img/people/ keeping the same names,
// then run `python tools/optimize_images.py` to remake the WebP copies.

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
  hawker: { src: DIR + 'hawker-centre.jpg', alt: 'People walking through a busy hawker centre', credit: 'Scribbling Geek', page: 'https://unsplash.com/photos/RRC9KMMMneY' },
  mrtPlatform: { src: DIR + 'mrt-platform.jpg', alt: 'Commuters waiting on an MRT platform at sunset', credit: 'Singapore Stock Photos', page: 'https://unsplash.com/photos/hPc9MDk9kaA' },
  mrtPark: { src: DIR + 'mrt-park.jpg', alt: 'An MRT train crossing a bridge over a green park', credit: 'Manh Hung Ngo', page: 'https://unsplash.com/photos/XmJI8vMRXNk' },
  hdbBlocks: { src: DIR + 'hdb-blocks.jpg', alt: 'HDB blocks in red, white and brown against the sky', credit: 'nic chi', page: 'https://unsplash.com/photos/-O_iAF6E3xI' },
  estate: { src: DIR + 'estate-view.jpg', alt: 'A housing estate with trees in front', credit: 'Danist Soh', page: 'https://unsplash.com/photos/JDijlM_OENI' },
  familyMeal: { src: DIR + 'family-meal.jpg', alt: 'A father, mother and child eating together at the table', credit: 'National Cancer Institute', page: 'https://unsplash.com/photos/2hOoIAEQfFs' },
  shopkeeper: { src: DIR + 'shopkeeper.jpg', alt: 'A shopkeeper smiling in her neighbourhood shop', credit: 'Chua Zi Hui', page: 'https://unsplash.com/photos/v62iYUFdz1Q' },
  parkBench: { src: DIR + 'park-bench.jpg', alt: 'A couple resting on a park bench beside their bicycles', credit: 'Nguyen Thu Hoai', page: 'https://unsplash.com/photos/RcjeWcr_KZ4' },
  corridor: { src: DIR + 'hdb-corridor.jpg', alt: 'Neighbours walking along an HDB corridor', credit: 'Within Studios by The Majurity Trust', page: 'https://unsplash.com/photos/ezzi9yJKESw' },
};

/**
 * <img> markup for a photo. The browser picks the WebP copy that fits `sizes`
 * (720, 960 or 1200px wide), made by tools/optimize_images.py; the JPG
 * is the fallback. If the file isn't there yet, layout.js swaps it for a
 * tinted panel, so a missing photo never shows a broken image.
 */
export function photo(key, { cls = '', eager = false, sizes = '100vw' } = {}) {
  const p = PHOTOS[key];
  if (!p) return '';
  const base = p.src.replace(/\.jpg$/, '');
  return `<img class="photo ${cls}" src="${p.src}" srcset="${base}-720.webp 720w, ${base}-960.webp 960w, ${base}-1200.webp 1200w" sizes="${sizes}" alt="${p.alt}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" width="1200" height="800" data-photo>`;
}
