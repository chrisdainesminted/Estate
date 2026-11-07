// Renders Homeward's icons and link preview into brands/real-estate-business/public/,
// which scripts/rebrand.mjs copies over public/. Needs Playwright with Chromium.
// Usage: node brands/real-estate-business/icons.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'public');
const BROWN = '#7A5A3C';
const LIGHT = '#A3855F';
const CREAM = '#FAF6EF';
const INK = '#3A2E22';
const FONT = '<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@500;600;700&family=Manrope:wght@400;500;600&display=swap" rel="stylesheet">';
// The same mark as src/lib/brand.js here: a brown rounded square.
const markSvg = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 48 48"><rect x="2" y="2" width="44" height="44" rx="12" fill="${BROWN}"/></svg>`;

// App icons: full-bleed brown (the phone rounds the corners) with the wordmark's lighter dot.
const icon = (size) =>
  `<body style="margin:0;width:${size}px;height:${size}px;background:${BROWN};display:grid;place-items:center"><div style="width:${Math.round(size * 0.14)}px;height:${Math.round(size * 0.14)}px;border-radius:50%;background:${LIGHT}"></div></body>`;
const favicon = (size) => `<body style="margin:0;width:${size}px;height:${size}px;background:transparent">${markSvg(size)}</body>`;

const keys = `data:image/webp;base64,${fs.readFileSync(path.join(OUT, 'landing/hw/keys.webp')).toString('base64')}`;
const og = () => `<body style="margin:0;width:1200px;height:630px;background:${CREAM};font-family:Manrope,sans-serif;display:flex;box-sizing:border-box;padding:64px 64px 64px 80px;gap:56px">
  <div style="flex:1 1 0;display:flex;flex-direction:column;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:16px">${markSvg(52)}<span style="font-family:'DM Sans';font-size:44px;font-weight:600;letter-spacing:-0.03em;color:${INK}">homeward<span style="color:${LIGHT}"> .</span></span></div>
    <div>
      <div style="font-family:'DM Sans';font-size:68px;line-height:1.02;font-weight:600;letter-spacing:-0.045em;color:${INK}">Real estate shouldn’t be <span style="color:${BROWN}">scary.</span></div>
      <div style="margin-top:24px;font-size:23px;color:#7d6a56">Buying, selling, investing and renting · Anywhere in Canada</div>
    </div>
  </div>
  <div style="width:400px;border-radius:28px;background:url(${keys}) center/cover"></div>
</body>`;

function icoFrom(png, size) {
  const head = Buffer.alloc(22);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(1, 4);
  head.writeUInt8(size, 6);
  head.writeUInt8(size, 7);
  head.writeUInt16LE(1, 10);
  head.writeUInt16LE(32, 12);
  head.writeUInt32LE(png.length, 14);
  head.writeUInt32LE(22, 18);
  return Buffer.concat([head, png]);
}

(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const b = await chromium.launch(proxy ? { proxy } : {});
  const shoot = async (html, w, h, file) => {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.setContent(`<!doctype html><html><head>${FONT}</head>${html}</html>`, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    const png = await p.screenshot({ omitBackground: file.startsWith('favicon') });
    await p.close();
    fs.writeFileSync(path.join(OUT, file), file.endsWith('.ico') ? icoFrom(png, w) : png);
    console.log(file);
  };
  await shoot(icon(180), 180, 180, 'apple-touch-icon.png');
  await shoot(icon(192), 192, 192, 'icon-192.png');
  await shoot(icon(512), 512, 512, 'icon-512.png');
  await shoot(favicon(32), 32, 32, 'favicon-32.png');
  await shoot(favicon(48), 48, 48, 'favicon.ico');
  await shoot(og(), 1200, 630, 'og.png');
  fs.writeFileSync(path.join(OUT, 'favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect x="2" y="2" width="44" height="44" rx="12" fill="${BROWN}"/></svg>\n`);
  await b.close();
})();
