// City pages for search: "Duplexes for sale in Thunder Bay, worked out".
// Built as plain HTML after the site is (scripts/city-pages.mjs), from the
// same morning listings the app shows, so a search engine reads every
// figure without running the app, and each page is as fresh as the last
// run. Every number comes from the listings engine (src/lib/market.js):
// 20% down at a bank's rate, the city's asking rents where a listing gives
// none, and only a real tax bill, never a guessed one. A listing without
// one shows no cash flow or grade.
//
//   /homes-for-sale/                         every city
//   /homes-for-sale/thunder-bay/             one city, every kind
//   /homes-for-sale/thunder-bay/duplexes/    one city, one kind

import { cityByKey, PROVINCES } from '../lib/canada.js';
import { dealGrade } from '../lib/grade.js';
import { DEFAULT_MARKET, LISTING_CITIES, MARKET_SOURCES, dedupeListings, feedDoc, localMarket, scoreListing, siteName, unitsOf } from '../lib/market.js';
import { SITE_URL, shareLink } from '../lib/share.js';
import { markSvg } from '../lib/brand.js';
import { PAGE_THEME } from './theme.js';

export const ROOT = 'homes-for-sale';
export const SITE_NAME = 'Squarely';
export const ORIGIN = new URL(SITE_URL).origin;

/** The kinds of home a page can be about, by unit count. */
export const KINDS = [
  { slug: 'houses', units: (n) => n === 1, plural: 'Houses', one: 'house' },
  { slug: 'duplexes', units: (n) => n === 2, plural: 'Duplexes', one: 'duplex' },
  { slug: 'triplexes', units: (n) => n === 3, plural: 'Triplexes', one: 'triplex' },
  { slug: 'fourplexes', units: (n) => n === 4, plural: 'Fourplexes', one: 'fourplex' },
  { slug: 'apartment-buildings', units: (n) => n >= 5, plural: 'Apartment buildings', one: 'apartment building' },
];

/** Fewer listings than this and a kind gets no page of its own: too thin to be worth a search. */
export const MIN_LISTINGS = 3;
/** The most listings one page shows in full; the rest are a link to the app away. */
export const PAGE_MAX = 60;

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const cad = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
const money = (v) => (Number.isFinite(v) ? (v < 0 ? `−${cad.format(-v)}` : cad.format(v)) : '—');
const signed = (v) => (Number.isFinite(v) ? (v > 0 ? `+${money(v)}` : money(v)) : '—');
const median = (xs) => {
  const s = xs.filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const longDate = (iso) => {
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' });
};
const provinceName = (code) => PROVINCES.find((p) => p.code === code)?.name ?? code;
const path = (...parts) => `/${[ROOT, ...parts].join('/')}/`;

/** One listing, worked out: the engine's numbers, and the grade only when the tax bill is real. */
export function workOut(listing, market) {
  const s = scoreListing(listing, market);
  const units = unitsOf(listing);
  return {
    listing,
    units,
    price: s.a.price,
    rent: s.a.grossRent,
    rentSource: s.rentSource,
    taxes: s.needsTax ? null : s.a.taxes * 12,
    cashFlow: s.needsTax ? null : s.a.netCashFlow,
    perDoor: s.needsTax ? null : s.perDoor,
    cashNeeded: s.a.cashNeeded,
    grade: s.needsTax ? null : dealGrade(s.a),
    link: shareLink(s.deal),
    source: siteName(listing.url),
    url: listing.url,
  };
}

/** Best first: listings with a real tax bill by cash flow per door, then the rest by price. */
const byBest = (x, y) => (x.perDoor == null) - (y.perDoor == null) || (x.perDoor == null ? x.price - y.price : y.perDoor - x.perDoor);

/** A city's active listings, each worked out, best first. */
export function cityListings(feed, cityKey) {
  const market = localMarket(DEFAULT_MARKET, cityKey);
  const active = dedupeListings((feed?.listings ?? []).filter((l) => l.status === 'active' && Number(l.price) > 0 && l.address));
  return active.map((l) => workOut(l, market)).sort(byBest);
}

/** The few figures a page leads with. */
export function summary(rows) {
  const known = rows.filter((r) => r.cashFlow != null);
  return {
    count: rows.length,
    medianPrice: median(rows.map((r) => r.price)),
    withTax: known.length,
    positive: known.filter((r) => r.cashFlow > 0).length,
    best: known[0] ?? null,
  };
}

function css() {
  const v = PAGE_THEME.vars;
  return `:root{color-scheme:${PAGE_THEME.colorScheme};--page:${v.page};--panel:${v.panel};--line:${v.line};--ink:${v.ink};--soft:${v.soft};--accent:${v.accent};--accent-ink:${v.accentInk};--good:${v.good};--bad:${v.bad};--r:${v.radius}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:var(--page);color:var(--ink);font:16px/1.55 ${v.font};-webkit-font-smoothing:antialiased}
a{color:inherit}.wrap{max-width:1040px;margin:0 auto;padding:0 16px}
header{border-bottom:1px solid var(--line)}header .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px;height:56px}
.brand{display:flex;align-items:center;gap:8px;font-weight:700;text-decoration:none;letter-spacing:-.01em}.brand svg{width:22px;height:22px}
nav a{font-size:14px;color:var(--soft);text-decoration:none;margin-left:16px}nav a:hover{color:var(--ink)}
main{padding:32px 0 56px}.crumbs{font-size:13px;color:var(--soft)}.crumbs a{text-decoration:none}.crumbs a:hover{text-decoration:underline}
h1{font-size:clamp(28px,5vw,40px);line-height:1.15;letter-spacing:-.02em;margin:12px 0 10px}h2{font-size:20px;letter-spacing:-.01em;margin:40px 0 12px}
.lede{font-size:18px;color:var(--soft);max-width:720px;margin:0}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:24px 0}
.stat{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:14px}.stat b{display:block;font-size:22px;letter-spacing:-.01em}.stat span{font-size:13px;color:var(--soft)}
.btn{display:inline-block;background:var(--accent);color:var(--accent-ink);font-weight:600;text-decoration:none;border-radius:var(--r);padding:11px 18px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 0;padding:0;list-style:none}.chips a{display:block;border:1px solid var(--line);border-radius:999px;padding:6px 12px;font-size:14px;text-decoration:none;background:var(--panel)}.chips a:hover{border-color:var(--accent)}
.list{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.row{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:14px 16px;display:grid;grid-template-columns:1fr auto;gap:6px 16px;align-items:start}
.row h3{margin:0;font-size:16px;line-height:1.3}.row .meta{font-size:13px;color:var(--soft)}
.row .nums{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:4px 18px;font-size:14px}.row .nums span{color:var(--soft)}.row .nums b{color:var(--ink);font-weight:600}
.row .acts{grid-column:1/-1;display:flex;gap:16px;font-size:14px}.row .acts a{color:var(--accent);font-weight:600;text-decoration:none}.row .acts a:hover{text-decoration:underline}
.grade{min-width:44px;text-align:center;border:1px solid var(--line);border-radius:8px;padding:4px 8px;font-weight:700;font-size:15px}.grade small{display:block;font-weight:500;font-size:11px;color:var(--soft)}
.pos{color:var(--good)!important}.neg{color:var(--bad)!important}
.note{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:16px 18px;font-size:14px;color:var(--soft)}.note p{margin:0 0 8px}.note p:last-child{margin:0}.note a{color:var(--accent)}
.cities{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;list-style:none;margin:0;padding:0}.cities a{display:block;background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:14px 16px;text-decoration:none}.cities a:hover{border-color:var(--accent)}.cities b{display:block}.cities span{font-size:13px;color:var(--soft)}
footer{border-top:1px solid var(--line);padding:24px 0 40px;font-size:13px;color:var(--soft)}footer a{color:var(--soft)}
@media (max-width:560px){nav a.wide{display:none}.row{grid-template-columns:1fr}.grade{justify-self:start}}`;
}

function layout({ title, description, canonical, crumbs, body, updated }) {
  const url = `${ORIGIN}${canonical}`;
  const crumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map(([name, href], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${ORIGIN}${href}` })),
  };
  return `<!doctype html>
<html lang="en-CA">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
${PAGE_THEME.index ? '' : '<meta name="robots" content="noindex, follow" />\n'}<link rel="canonical" href="${esc(url)}" />
<meta name="theme-color" content="${esc(PAGE_THEME.themeColor)}" />
<link rel="icon" href="/favicon.ico?v=3" sizes="48x48" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg?v=3" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=3" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${esc(SITE_NAME)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(url)}" />
<meta property="og:image" content="${esc(ORIGIN)}/og.png" />
<meta name="twitter:card" content="summary_large_image" />
<script type="application/ld+json">${JSON.stringify(crumbLd).replace(/</g, '\\u003c')}</script>
<style>${css()}</style>
</head>
<body>
<header><div class="wrap"><a class="brand" href="/"><svg viewBox="0 0 48 48" aria-hidden="true">${markSvg()}</svg>${esc(SITE_NAME)}</a><nav aria-label="Site"><a href="${path()}">Homes by city</a><a class="wide" href="/lenders/">Find a lender</a><a href="/app/">Open the app</a></nav></div></header>
<main><div class="wrap">
<p class="crumbs">${crumbs.map(([name, href], i) => (i === crumbs.length - 1 ? esc(name) : `<a href="${esc(href)}">${esc(name)}</a>`)).join(' / ')}</p>
${body}
</div></main>
<footer><div class="wrap"><p>${updated ? `Listings checked ${esc(longDate(updated))}. ` : ''}Estimates, not financial, legal or tax advice. ${esc(SITE_NAME)} isn’t a real estate brokerage: each listing belongs to the site it links to, where its agent confirms the details.</p><p><a href="/">Home</a> · <a href="/methods/">How we calculate</a> · <a href="/terms/">Terms</a> · <a href="/privacy/">Privacy</a></p></div></footer>
</body>
</html>
`;
}

function assumptions(cityKey) {
  const m = localMarket(DEFAULT_MARKET, cityKey);
  const city = cityByKey(cityKey);
  return `<div class="note">
<p><b>How each one is worked out.</b> ${m.lens === 'own' ? `20% down with a 5-year fixed mortgage at ${m.rate}%` : `${m.dscrDownPct}% down at ${m.dscrRate}%`}, paid off over ${m.amortYears} years, with land transfer tax and ${m.closingPct}% in closing costs in the cash you need. Rent is what the listing states; where it doesn’t, ${esc(city.name)}’s average asking rent for that many bedrooms (${esc(MARKET_SOURCES.rents.source)}, ${m.rentsSource === 'asking' ? esc(longDate(`${m.rentsAs}-15`).replace(/ \d+,/, '')) : 'scaled from Thunder Bay’s'}). After the mortgage, property tax and insurance, it keeps ${m.vacancyPct}% for empty months, ${m.maintPct}% for repairs, ${m.capexPct}% for big replacements and ${m.mgmtPct}% for management.</p>
<p>Cash flow and a grade only show where the listing gives its real property tax bill: we never guess one. Open any listing in the app to change a figure and see it update. <a href="/methods/">How we calculate</a></p>
</div>`;
}

function listingRow(r) {
  const l = r.listing;
  const beds = (Array.isArray(l.beds) ? l.beds.filter((b) => Number.isFinite(Number(b)) && b !== null) : []).map(Number);
  // Per unit, with a ? for each unit the listing doesn't give a bedroom count for (up to 4 units).
  const perUnit = r.units <= 4 ? [...beds, ...Array(Math.max(r.units - beds.length, 0)).fill('?')] : beds;
  const bedText = beds.length ? (r.units === 1 ? `${beds[0]} bed` : `${perUnit.join(' + ')} bed`) : '';
  const meta = [r.units === 1 ? 'House' : `${r.units} units`, bedText, l.yearBuilt ? `built ${l.yearBuilt}` : ''].filter(Boolean).join(' · ');
  const rentNote = r.rentSource === 'stated' ? 'as listed' : r.rentSource === 'mixed' ? 'partly estimated' : 'estimated';
  const cf = r.cashFlow == null ? '<b>Needs the tax bill</b>' : `<b class="${r.cashFlow >= 0 ? 'pos' : 'neg'}">${signed(Math.round(r.cashFlow))}</b>/mo`;
  const grade = r.grade ? `<div class="grade" title="${esc(`${r.grade.label}: ${r.grade.score} out of 100`)}">${esc(r.grade.rank)}<small>${esc(r.grade.label)}</small></div>` : '<div></div>';
  const safeUrl = /^https?:\/\//i.test(String(r.url ?? '')) ? r.url : null;
  return `<li class="row"><div><h3>${esc(l.address)}</h3><div class="meta">${esc(meta)}</div></div>${grade}
<div class="nums"><span>Price <b>${money(r.price)}</b></span><span>Rent <b>${money(Math.round(r.rent))}</b>/mo ${esc(rentNote)}</span><span>Tax <b>${r.taxes == null ? 'not listed' : `${money(Math.round(r.taxes))}/yr`}</b></span><span>Cash flow ${cf}</span><span>Cash to buy <b>${money(Math.round(r.cashNeeded))}</b></span></div>
<div class="acts"><a href="${esc(r.link)}" rel="nofollow">Work it out</a>${safeUrl ? `<a href="${esc(safeUrl)}" rel="nofollow noopener" target="_blank">See it on ${esc(r.source ?? 'the listing site')}</a>` : ''}</div></li>`;
}

function stats(s, label) {
  return `<div class="stats">
<div class="stat"><b>${s.count}</b><span>${esc(label)} for sale now</span></div>
<div class="stat"><b>${money(s.medianPrice)}</b><span>Middle asking price</span></div>
<div class="stat"><b>${s.withTax}</b><span>With a real tax bill, worked out in full</span></div>
<div class="stat"><b>${s.positive}</b><span>Of those, cash flow positive</span></div>
</div>`;
}

function kindsOf(rows) {
  return KINDS.map((k) => ({ ...k, rows: rows.filter((r) => k.units(r.units)) })).filter((k) => k.rows.length >= MIN_LISTINGS);
}

function cityPage(cityKey, feed, rows) {
  const city = cityByKey(cityKey);
  const s = summary(rows);
  const kinds = kindsOf(rows);
  const updated = feed.lastRun?.date ?? null;
  const shown = rows.slice(0, PAGE_MAX);
  const title = `Homes for sale in ${city.name}, worked out as rentals | ${SITE_NAME}`;
  const best = s.best ? ` The best right now: ${s.best.listing.address}, ${signed(Math.round(s.best.cashFlow))} a month.` : '';
  const description = `${s.count} homes for sale in ${city.name}, ${provinceName(city.province)}, each with its rent, tax, cash flow and the cash you’d need, from today’s listings.${best}`.slice(0, 300);
  const body = `<h1>Homes for sale in ${esc(city.name)}, worked out</h1>
<p class="lede">Every home on the market we found in ${esc(city.name)} this week, with what it would rent for, what it costs to carry, and whether it pays for itself as a rental.</p>
${stats(s, 'Homes')}
${kinds.length ? `<ul class="chips">${kinds.map((k) => `<li><a href="${path(cityKey, k.slug)}">${esc(k.plural)} (${k.rows.length})</a></li>`).join('')}</ul>` : ''}
<h2>${shown.length < rows.length ? `The best ${shown.length} of ${rows.length}` : `All ${rows.length}`}, best first</h2>
<ul class="list">${shown.map(listingRow).join('\n')}</ul>
${shown.length < rows.length ? `<p><a class="btn" href="/app/?view=listings&amp;city=${esc(cityKey)}">See all ${rows.length} in the app</a></p>` : `<p><a class="btn" href="/app/?view=listings&amp;city=${esc(cityKey)}">Sort and filter them in the app</a></p>`}
<h2>The numbers behind it</h2>
${assumptions(cityKey)}`;
  return {
    path: path(cityKey),
    html: layout({ title, description, canonical: path(cityKey), crumbs: [['Homes for sale', path()], [city.name, path(cityKey)]], body, updated }),
    updated,
  };
}

function kindPage(cityKey, feed, kind, all) {
  const city = cityByKey(cityKey);
  const rows = kind.rows;
  const s = summary(rows);
  const updated = feed.lastRun?.date ?? null;
  const shown = rows.slice(0, PAGE_MAX);
  const title = `${kind.plural} for sale in ${city.name}, worked out | ${SITE_NAME}`;
  const best = s.best ? ` Best now: ${s.best.listing.address}, ${signed(Math.round(s.best.cashFlow))}/mo.` : '';
  const description = `${s.count} ${kind.plural.toLowerCase()} for sale in ${city.name}, ${provinceName(city.province)}, each worked out as a rental: rent, property tax, monthly cash flow and the cash you’d need.${best}`.slice(0, 300);
  const others = kindsOf(all).filter((k) => k.slug !== kind.slug);
  const body = `<h1>${esc(kind.plural)} for sale in ${esc(city.name)}, worked out</h1>
<p class="lede">${s.count} ${esc(kind.plural.toLowerCase())} on the market in ${esc(city.name)}, ${esc(provinceName(city.province))}. Each one with its rent, its real tax bill where the listing gives one, and whether it pays for itself.</p>
${stats(s, kind.plural)}
<h2>${shown.length < rows.length ? `The best ${shown.length} of ${rows.length}` : `All ${rows.length}`}, best first</h2>
<ul class="list">${shown.map(listingRow).join('\n')}</ul>
<p><a class="btn" href="/app/?view=listings&amp;city=${esc(cityKey)}">Sort and filter them in the app</a></p>
<h2>The numbers behind it</h2>
${assumptions(cityKey)}
${others.length ? `<h2>More in ${esc(city.name)}</h2><ul class="chips"><li><a href="${path(cityKey)}">Every home (${all.length})</a></li>${others.map((k) => `<li><a href="${path(cityKey, k.slug)}">${esc(k.plural)} (${k.rows.length})</a></li>`).join('')}</ul>` : ''}`;
  return {
    path: path(cityKey, kind.slug),
    html: layout({ title, description, canonical: path(cityKey, kind.slug), crumbs: [['Homes for sale', path()], [city.name, path(cityKey)], [kind.plural, path(cityKey, kind.slug)]], body, updated }),
    updated,
  };
}

function indexPage(cities) {
  const total = cities.reduce((t, c) => t + c.rows.length, 0);
  const updated = cities.map((c) => c.updated).filter(Boolean).sort().at(-1);
  const title = `Homes for sale across Canada, worked out as rentals | ${SITE_NAME}`;
  const description = `${total} homes for sale in ${cities.length} Canadian cities, each with its rent, property tax, monthly cash flow and the cash you’d need. Updated every morning.`;
  const body = `<h1>Homes for sale across Canada, worked out</h1>
<p class="lede">${total} homes for sale in ${cities.length} cities, checked every morning. Pick a city to see what each one would rent for and whether it pays for itself.</p>
<h2>Cities</h2>
<ul class="cities">${cities
    .map((c) => {
      const city = cityByKey(c.key);
      const s = summary(c.rows);
      return `<li><a href="${path(c.key)}"><b>${esc(city.name)}, ${esc(city.province)}</b><span>${s.count} for sale · middle price ${money(s.medianPrice)}${s.positive ? ` · ${s.positive} cash flow positive` : ''}</span></a></li>`;
    })
    .join('')}</ul>
<h2>The numbers behind it</h2>
<div class="note"><p>Each home is worked out with 20% down at a bank’s 5-year fixed rate, its stated rent or the city’s average asking rent for its bedrooms, and its real property tax bill. Where a listing doesn’t give that bill, we show no cash flow rather than guess one. <a href="/methods/">How we calculate</a></p></div>`;
  return { path: path(), html: layout({ title, description, canonical: path(), crumbs: [['Homes for sale', path()]], body, updated }), updated };
}

/**
 * Every page, as [{ path, html, updated }], from each city's feed
 * ({ 'thunder-bay': feed, ... }). Cities with no listings get no page.
 */
export function buildCityPages(feeds) {
  const cities = LISTING_CITIES.filter((key) => feeds[key])
    .map((key) => ({ key, feed: feeds[key], rows: cityListings(feeds[key], key), updated: feeds[key].lastRun?.date ?? null }))
    .filter((c) => c.rows.length > 0)
    .sort((a, b) => cityByKey(a.key).name.localeCompare(cityByKey(b.key).name));
  if (!cities.length) return [];
  const pages = [indexPage(cities)];
  for (const c of cities) {
    pages.push(cityPage(c.key, c.feed, c.rows));
    for (const k of kindsOf(c.rows)) pages.push(kindPage(c.key, c.feed, k, c.rows));
  }
  return pages;
}

/** Sitemap lines for the pages, when this site lets search engines list them. */
export function sitemapLines(pages) {
  if (!PAGE_THEME.index) return [];
  return pages.map((p) => `  <url><loc>${ORIGIN}${p.path}</loc>${p.updated ? `<lastmod>${String(p.updated).slice(0, 10)}</lastmod>` : ''}<changefreq>daily</changefreq><priority>${p.path === path() ? '0.8' : '0.7'}</priority></url>`);
}

/** Which feed file holds a city's listings: thunder-bay → thunderbay.json. */
export const feedFile = (cityKey) => `${feedDoc(cityKey)}.json`;
