// Shared file helpers for the daily-run scripts.
import { readFileSync } from 'node:fs';

/** Parse a JSON file; null when the path is missing or "-". */
export function readJson(path) {
  if (!path || path === '-') return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw new Error(`${path}: ${e.message}`);
  }
}

/** A saved document may come bare or wrapped ({ data: {...} }); find the object holding `key`. */
export function unwrap(json, key) {
  if (!json || typeof json !== 'object') return null;
  if (key in json) return json;
  for (const k of ['data', 'document', 'doc', 'fields']) if (json[k] && typeof json[k] === 'object' && key in json[k]) return json[k];
  return null;
}

export function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const name = argv[i].slice(2);
      const next = argv[i + 1];
      flags[name] = next !== undefined && !next.startsWith('--') ? (i++, next) : true;
    } else positional.push(argv[i]);
  }
  return { flags, positional };
}
