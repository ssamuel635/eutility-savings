// Market news topics: each headline gets a photo for its topic, matched from
// words in the headline (no AI). Staff can pick a different topic on the
// Review page; the choice is saved as `topic` on the headline in news.js.
//
// The photos are stock photos from Unsplash (free for commercial use under the
// Unsplash License), never the news outlet's own pictures, which belong to the
// publisher. To change one, replace the JPG in assets/img/news/ keeping the
// name, then run `python tools/optimize_images.py` for the WebP copies.
//
// Scoring: each matching word adds its weight; the highest score wins, ties go
// to the earlier topic. No match: the last topic, which is the general one.

const DIR = 'assets/img/news/';

export const NEWS_TOPICS = [
  {
    key: 'gas', label: 'Gas and fuel',
    words: [[/\blng\b/i, 2], [/\bgas\b/i, 1], [/\b(fuels?|oil|pipelines?)\b/i, 1]],
    photo: { name: 'gas', alt: 'A ship carrying large LNG tanks', credit: 'Julia Taubitz', page: 'https://unsplash.com/photos/Ou2pf_Nvba4' },
  },
  {
    key: 'tariff', label: 'Tariffs and bills',
    words: [[/\btariffs?\b/i, 2], [/\b(electricity|power|utility) (bills?|prices?|costs?)\b/i, 1], [/\bbills?\b/i, 1]],
    photo: { name: 'tariff', alt: 'Rows of electricity meters', credit: 'Jon Moore', page: 'https://unsplash.com/photos/0MKzwPmehRE' },
  },
  {
    key: 'grid', label: 'Grid and infrastructure',
    words: [[/\b(power )?grid\b/i, 2], [/\binfrastructure\b/i, 2], [/\b(power plants?|substations?|transmission|cables?|interconnect\w*|imports?)\b/i, 1], [/\bdemand\b/i, 1]],
    photo: { name: 'grid', alt: 'An electricity pylon against a blue sky', credit: 'Yuan Yang', page: 'https://unsplash.com/photos/I153-FXdV4I' },
  },
  {
    key: 'solar', label: 'Solar',
    words: [[/\bsolar\b/i, 2], [/\bpanels?\b/i, 1], [/\bphotovoltaic\b/i, 2]],
    photo: { name: 'solar', alt: 'Solar panels on a city rooftop', credit: 'Jeroen van de Water', page: 'https://unsplash.com/photos/aQOzmgcT6sI' },
  },
  {
    key: 'climate', label: 'Clean energy and climate',
    words: [[/\b(carbon|emissions?|climate|net[- ]zero|decarboni\w+)\b/i, 2], [/\b(geothermal|hydrogen|nuclear|ammonia|renewables?|low[- ]carbon|green energy)\b/i, 2]],
    photo: { name: 'climate', alt: 'The Supertrees at Gardens by the Bay, Singapore', credit: 'Duy Nguyen', page: 'https://unsplash.com/photos/9WwWGeHEbmQ' },
  },
  {
    key: 'retailer', label: 'Retailers and the market',
    words: [[/\bretailers?\b/i, 2], [/\b(open electricity market|oem)\b/i, 2], [/\bprice plans?\b/i, 1]],
    photo: { name: 'retailer', alt: 'HDB estates under an evening sky', credit: 'Jiachen Lin', page: 'https://unsplash.com/photos/AIk_5-M9Uho' },
  },
  {
    key: 'policy', label: 'Energy in Singapore',
    words: [],
    photo: { name: 'policy', alt: 'The Singapore skyline at dusk', credit: 'Peter Nguyen', page: 'https://unsplash.com/photos/CQhgno3yhv8' },
  },
];

const BY_KEY = Object.fromEntries(NEWS_TOPICS.map((t) => [t.key, t]));

/** The topic for a headline: the one staff chose, else the best keyword match, else the general one. */
export function topicOf(item) {
  if (item?.topic && BY_KEY[item.topic]) return BY_KEY[item.topic];
  let best = NEWS_TOPICS.at(-1), top = 0;
  for (const t of NEWS_TOPICS) {
    const score = t.words.reduce((n, [re, w]) => n + (re.test(item?.title || '') ? w : 0), 0);
    if (score > top) { best = t; top = score; }
  }
  return best;
}

/** The photo's file paths: a JPG fallback and two WebP widths. */
export function topicPhoto(topic) {
  const base = DIR + topic.photo.name;
  return { jpg: `${base}.jpg`, webp: `${base}-400.webp 400w, ${base}-800.webp 800w`, alt: topic.photo.alt };
}
