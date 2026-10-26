// Turns the Vite build into a page for Claude's artifact host: the host
// supplies <html>/<head>/<body>, so the page ships as a fragment (title,
// styles, theme script, root, module script) beside its assets.
// Usage: npm run build:artifact  ->  dist-artifact/index.html + assets/

import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';

const html = readFileSync('dist/index.html', 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];

const keep = (re) => (head.match(re) || []).join('\n');
const fragment = [
  '<title>Bedrock</title>',
  '<meta name="claude:viewport-fit-sides" content="cover">',
  keep(/<link rel="preconnect"[^>]*>/g),
  keep(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>/g),
  keep(/<link rel="stylesheet"[^>]*assets\/[^>]*>/g),
  keep(/<script>[\s\S]*?<\/script>/g),
  body.trim(),
  keep(/<script type="module"[^>]*><\/script>/g),
]
  .filter(Boolean)
  .join('\n');

rmSync('dist-artifact', { recursive: true, force: true });
mkdirSync('dist-artifact', { recursive: true });
writeFileSync('dist-artifact/index.html', `${fragment}\n`);
cpSync('dist/assets', 'dist-artifact/assets', { recursive: true });

const files = readdirSync('dist-artifact/assets');
console.log(`dist-artifact/index.html + ${files.length} assets`);
