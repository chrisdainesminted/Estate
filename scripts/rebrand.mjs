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
// - Files in brands/<slug>/public/ (the social preview image, homepage
//   screenshots with the new name) replace the site's.
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
const NAME = args.name;
const SLUG = args.slug ?? String(NAME || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const HOST = args.host;
const OLD_HOST = 'bedrock.signia83.workers.dev';
if (!NAME || !HOST) {
  console.error('Usage: node scripts/rebrand.mjs --name "New Name" --host new-host.example.com [--slug new-name]');
  process.exit(1);
}

const root = new URL('..', import.meta.url).pathname;
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

// The site's source, its server, its pages, and the files it serves.
const pages = readdirSync(root).filter((d) => existsSync(join(root, d, 'index.html')) && !SKIP.has(d)).map((d) => join(root, d, 'index.html'));
const files = [...walk(join(root, 'src')), ...walk(join(root, 'worker')), ...walk(join(root, 'public')), join(root, 'index.html'), ...pages];

let changed = 0;
let names = 0;
for (const f of files) {
  if (!existsSync(f)) continue;
  const before = readFileSync(f, 'utf8');
  const after = before
    .replace(WORD, () => (names++, NAME))
    // Calendar invites' product ID ("-//Squarely//Viewing//EN").
    .replace(/\/\/Squarely\/\//g, () => (names++, `//${NAME}//`))
    .split(OLD_HOST)
    .join(HOST);
  if (after !== before) {
    writeFileSync(f, after);
    changed++;
  }
}

// The new Worker: its own name, so its own Durable Objects (accounts, workspaces, directory).
const wranglerPath = join(root, 'wrangler.jsonc');
const wrangler = readFileSync(wranglerPath, 'utf8');
writeFileSync(wranglerPath, wrangler.replace(/"name":\s*"[^"]*"/, `"name": "${SLUG}"`));

// Images that carry the name: the social preview and the homepage's screenshots.
const assets = join(root, 'brands', SLUG, 'public');
if (existsSync(assets)) cpSync(assets, join(root, 'public'), { recursive: true });

console.log(`Rebranded to "${NAME}" (${SLUG}) at ${HOST}: ${names} names in ${changed} files${existsSync(assets) ? `, images from ${relative(root, assets)}` : ', no brand images found'}.`);
