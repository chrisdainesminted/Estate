// After `vite build`: write the city pages (src/seo/cityPages.js) into
// dist/, from the morning listings in public/data/, and add them to the
// built sitemap. Runs on every build, so each deploy of a day's listings
// refreshes them.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { LISTING_CITIES } from '../src/lib/market.js';
import { buildCityPages, feedFile, sitemapLines } from '../src/seo/cityPages.js';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
if (!existsSync(dist)) {
  console.error('Run `vite build` first: there is no dist/ to add the city pages to.');
  process.exit(1);
}

const feeds = {};
for (const key of LISTING_CITIES) {
  const f = join(root, 'public', 'data', feedFile(key));
  if (!existsSync(f)) continue;
  try {
    feeds[key] = JSON.parse(readFileSync(f, 'utf8'));
  } catch (e) {
    console.warn(`Skipped ${feedFile(key)}: ${e.message}`);
  }
}

const pages = buildCityPages(feeds);
for (const p of pages) {
  const out = join(dist, p.path, 'index.html');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, p.html);
}

const sitemap = join(dist, 'sitemap.xml');
const lines = sitemapLines(pages);
if (existsSync(sitemap) && lines.length) {
  const xml = readFileSync(sitemap, 'utf8');
  writeFileSync(sitemap, xml.replace('</urlset>', `${lines.join('\n')}\n</urlset>`));
}
console.log(`City pages: ${pages.length} written${lines.length ? `, ${lines.length} in the sitemap` : ', kept out of the sitemap'}.`);
