// Renders the brand images in public/ from the mark (src/lib/brand.js):
// the app icons and the link preview. Needs Playwright with Chromium.
// Usage: node scripts/brand-icons.cjs
const { chromium } = require('playwright');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', 'public');
const MARK = [
  { x: 0, y: 0, w: 30, h: 8 },
  { x: 0, y: 8, w: 8, h: 22 },
  { x: 18, y: 40, w: 30, h: 8 },
  { x: 40, y: 18, w: 8, h: 22 },
  { x: 16, y: 16, w: 16, h: 16 },
];
const ONYX = '#0b0b0c';
const GREEN = '#34d399';
const FONT = '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">';
const mark = (size, fill = GREEN) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 48 48">${MARK.map((s) => `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="${fill}"/>`).join('')}</svg>`;

// A full-bleed square: the phone rounds the corners itself, and the mark sits
// inside the maskable safe zone (the middle 80%).
const icon = (size) => `<body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${ONYX}">${mark(Math.round(size * 0.5))}</body>`;

const ledgerLine = (label, value, opts = {}) =>
  `<div style="display:flex;align-items:baseline;gap:10px;padding:5px 0;${opts.total ? 'margin-top:8px;padding-top:12px;border-top:4px double #4a4a52;font-weight:600;color:#fff' : 'color:#c4c4cc'}">
    <span>${label}</span><span style="flex:1;${opts.total ? '' : 'border-bottom:2px dotted #4a4a52;margin-bottom:6px'}"></span>
    <span style="font-variant-numeric:tabular-nums;${opts.total ? `color:${GREEN};font-size:34px` : 'color:#fafafa'}">${value}</span></div>`;

const og = `<body style="margin:0;width:1200px;height:630px;background:${ONYX};font-family:Inter,sans-serif;display:flex;box-sizing:border-box;padding:72px 80px;gap:72px">
  <div style="flex:1 1 0;display:flex;flex-direction:column;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:18px">${mark(52)}<span style="font-size:46px;font-weight:700;letter-spacing:-0.035em;color:#fafafa">Squarely</span></div>
    <div>
      <div style="font-size:54px;line-height:1.08;font-weight:700;letter-spacing:-0.035em;color:#fafafa">A lender can approve a deal that <span style="color:${GREEN}">still loses you money.</span></div>
      <div style="margin-top:26px;font-size:22px;color:#a1a1aa">Rent, buy or manage · Real numbers · Anywhere in Canada</div>
    </div>
  </div>
  <div style="width:400px;align-self:center;border:1px solid #232326;background:#0f0f11;padding:28px 30px;font-size:21px">
    <div style="font-weight:600;color:#fff;padding-bottom:10px;margin-bottom:6px;border-bottom:1px solid #232326">Each month</div>
    ${ledgerLine('Rent, 3 units', '$5,550')}${ledgerLine('Mortgage', '−$2,364')}${ledgerLine('Tax & insurance', '−$506')}${ledgerLine('Utilities & running', '−$1,538')}${ledgerLine('Left for you', '+$1,142', { total: true })}
  </div>
</body>`;

(async () => {
  const b = await chromium.launch();
  const shoot = async (html, w, h, file) => {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.setContent(`<!doctype html><html><head>${FONT}</head>${html}</html>`, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(PUBLIC, file) });
    await p.close();
    console.log(file);
  };
  await shoot(icon(180), 180, 180, 'apple-touch-icon.png');
  await shoot(icon(192), 192, 192, 'icon-192.png');
  await shoot(icon(512), 512, 512, 'icon-512.png');
  await shoot(og, 1200, 630, 'og.png');
  await b.close();
})();
