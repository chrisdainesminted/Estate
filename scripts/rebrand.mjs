// Turn this checkout into a copy of the site under another name, before it's
// built and deployed as its own Cloudflare Worker. The code stays one code
// base: the second site's build runs this first, on its own fresh checkout,
// so every change to the site reaches both.
//
//   node scripts/rebrand.mjs --name "Real Estate Business" --slug real-estate-business \
//     --host real-estate-business.signia83.workers.dev
//
// - Every "Squarely" a person reads (pages, emails, PDFs, page titles) becomes
//   the new name. Code names that contain it (AskSquarely) and lowercase keys
//   (squarely-auth, the database's squarely_* functions) are left alone.
// - The site's own address becomes the new host (links, sitemap, canonical URLs).
// - Files in brands/<slug>/public/ (icons, the social preview image, photos)
//   replace the site's, and files in brands/<slug>/src/ replace the same
//   files in src/ (a brand's own logo or homepage).
// - brands/<slug>/brand.json, if there is one, can give the brand its own
//   look: "name" (wins over --name), "css" (a file whose @import lines go at
//   the top of src/index.css and the rest at the end, so its colours and
//   fonts win), "colors" (exact colour strings swapped everywhere, e.g. the
//   logo green in PDFs), "lightByDefault" and "themeColor".
// - wrangler.jsonc takes the new Worker name, so its data is its own.
//
// It changes files in place: run it on a build checkout, not your working copy
// (it refuses to run with uncommitted changes unless given --force).

import { cpSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, relative } from 'node:path';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .join(' ')
    .split(/\s*--/)
    .filter(Boolean)
    .map((p) => {
      const m = /^([a-z-]+)(?:[ =](.*))?$/.exec(p.trim());
      return m ? [m[1], (m[2] ?? 'true').replace(/^"(.*)"$/, '$1').trim()] : [p, 'true'];
    }),
);
const SLUG = args.slug ?? String(args.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const HOST = args.host;
const OLD_HOST = 'bedrock.signia83.workers.dev';
const root = new URL('..', import.meta.url).pathname;
const brandDir = join(root, 'brands', SLUG);
const brand = existsSync(join(brandDir, 'brand.json')) ? JSON.parse(readFileSync(join(brandDir, 'brand.json'), 'utf8')) : {};
const NAME = brand.name || args.name;
if (!NAME || !HOST) {
  console.error('Usage: node scripts/rebrand.mjs --name "New Name" --host new-host.example.com [--slug new-name]');
  process.exit(1);
}

if (!args.force) {
  try {
    if (execSync('git status --porcelain', { cwd: root }).toString().trim()) {
      console.error('This changes files in place. Run it on a clean build checkout, or pass --force.');
      process.exit(1);
    }
  } catch {
    // Not a git checkout (a build machine's copy): go ahead.
  }
}

// "Squarely" as a word people read: not inside a longer name, a path or a key.
const WORD = /(?<![A-Za-z0-9_$\-/])Squarely(?![A-Za-z0-9_$])/g;
const TEXT = /\.(jsx?|mjs|cjs|css|html|xml|txt|webmanifest|json|svg|md)$/;
const SKIP = new Set(['node_modules', 'dist', 'dist-artifact', '.git', '.wrangler', 'data', 'brands']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (TEXT.test(name) && !/\.test\.jsx?$/.test(name)) out.push(p);
  }
  return out;
}

// The brand's own files first (its logo, its homepage), so the rewriting below covers them too.
const brandSrc = join(brandDir, 'src');
if (existsSync(brandSrc)) cpSync(brandSrc, join(root, 'src'), { recursive: true });
const assets = join(brandDir, 'public');
if (existsSync(assets)) cpSync(assets, join(root, 'public'), { recursive: true });

// The site's source, its server, its pages, and the files it serves.
const pages = readdirSync(root).filter((d) => existsSync(join(root, d, 'index.html')) && !SKIP.has(d)).map((d) => join(root, d, 'index.html'));
const files = [...walk(join(root, 'src')), ...walk(join(root, 'worker')), ...walk(join(root, 'public')), join(root, 'index.html'), ...pages];

let changed = 0;
let names = 0;
for (const f of files) {
  if (!existsSync(f)) continue;
  const before = readFileSync(f, 'utf8');
  let after = before
    .replace(WORD, () => (names++, NAME))
    // Calendar invites' product ID ("-//Squarely//Viewing//EN").
    .replace(/\/\/Squarely\/\//g, () => (names++, `//${NAME}//`))
    .split(OLD_HOST)
    .join(HOST);
  for (const [from, to] of Object.entries(brand.colors ?? {})) after = after.split(from).join(to);
  if (brand.lightByDefault && f.endsWith('.html')) {
    // Light unless the person picked dark (the main site is dark unless they picked light).
    after = after.replace("classList.toggle('dark', saved !== 'light')", "classList.toggle('dark', saved === 'dark')");
  }
  if (brand.themeColor && /\.(html|webmanifest)$/.test(f)) {
    after = after.replace(/(<meta name="theme-color" content=")#[0-9a-fA-F]{6}"/g, `$1${brand.themeColor}"`).replace(/("(?:background|theme)_color":\s*")#[0-9a-fA-F]{6}"/g, `$1${brand.themeColor}"`);
  }
  if (after !== before) {
    writeFileSync(f, after);
    changed++;
  }
}

// The new Worker: its own name, so its own Durable Objects (accounts, workspaces, directory).
const wranglerPath = join(root, 'wrangler.jsonc');
const wrangler = readFileSync(wranglerPath, 'utf8');
writeFileSync(wranglerPath, wrangler.replace(/"name":\s*"[^"]*"/, `"name": "${SLUG}"`));

// The brand's look: its fonts at the top of the stylesheet, its colours at the end.
if (brand.css) {
  const css = readFileSync(join(brandDir, brand.css), 'utf8');
  const imports = css.match(/^@import [^;]+;$/gm) ?? [];
  const rest = css.replace(/^@import [^;]+;\n?/gm, '');
  const indexCss = join(root, 'src', 'index.css');
  const base = readFileSync(indexCss, 'utf8');
  const at = base.indexOf('\n', base.lastIndexOf('@import ')) + 1;
  writeFileSync(indexCss, `${base.slice(0, at)}${imports.join('\n')}\n${base.slice(at)}\n/* ---------- ${NAME} ---------- */\n${rest}`);
}

console.log(`Rebranded to "${NAME}" (${SLUG}) at ${HOST}: ${names} names in ${changed} files${existsSync(assets) ? `, files from ${relative(root, brandDir)}` : ', no brand files found'}${brand.css ? ', with its own look' : ''}.`);
