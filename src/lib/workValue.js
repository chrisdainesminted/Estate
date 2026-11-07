// How a job done on a home is likely seen: does it add to what the home is
// worth, and is it a repair (an expense the year it's done) or an
// improvement (capital, claimed over years as capital cost allowance)?
//
// Value: the share of a project's cost it adds to resale value, from the
// published cost-recovery studies. Canada has no public equivalent, so
// these are the US national averages; the person can set their own. We
// never assume work adds more than it cost.
// - Zonda, Cost vs. Value Report 2024 (national averages, midrange projects)
// - National Association of Realtors, Remodeling Impact Report 2022 (floors)
// Upkeep and repairs that keep the home as it was (tree removal, a plumbing
// fix, pest control) add nothing a buyer pays for, but still count for tax.

export const VALUE_SOURCES = {
  cvv: 'Cost vs. Value 2024 (US averages)',
  nar: 'NAR Remodeling Impact 2022',
  upkeep: 'Upkeep: keeps the home as it was',
  guess: 'No study covers it: a rough guess, set your own',
};

// Most specific first. `pct` is the share of cost recovered (capped at 100 when used).
const RULES = [
  // Upkeep and repairs: no value added, an expense for tax.
  { key: 'tree', label: 'Tree or yard work', re: /\b(tree|stump|branch|hedge|lawn|landscap|yard clean|leaves|sod|mow)/, pct: 0, kind: 'repair', source: 'upkeep' },
  { key: 'pest', label: 'Pest control', re: /\b(pest|extermin|rodent|mice|mouse|rats?|bed ?bugs?|termite|wasp|ant treatment)/, pct: 0, kind: 'repair', source: 'upkeep' },
  { key: 'clean', label: 'Cleaning', re: /\b(clean|carpet shampoo|junk removal|dumpster|disposal|snow)/, pct: 0, kind: 'repair', source: 'upkeep' },
  { key: 'plumbing', label: 'Plumbing repair', re: /\b(plumb|leak|clog|drain|toilet repair|faucet|sewer|backflow|sump pump repair|pipe)/, pct: 0, kind: 'repair', source: 'upkeep' },
  { key: 'electrical', label: 'Electrical repair', re: /\b(electric(al)? repair|outlet|breaker|light fixture|wiring repair)/, pct: 0, kind: 'repair', source: 'upkeep' },
  { key: 'paint', label: 'Painting', re: /\b(paint|touch[- ]?up|drywall patch|caulk)/, pct: 0, kind: 'repair', source: 'upkeep' },
  { key: 'service', label: 'Servicing', re: /\b(service|servic|tune[- ]?up|inspection|chimney sweep|duct clean|gutter clean)/, pct: 0, kind: 'repair', source: 'upkeep' },
  // Projects the studies measure.
  { key: 'garage-door', label: 'Garage door', re: /\bgarage doors?\b/, pct: 193.9, kind: 'improvement', source: 'cvv' },
  { key: 'entry-door', label: 'Entry door', re: /\b(entry|front|exterior|steel) doors?\b|\bdoors?\b/, pct: 188.1, kind: 'improvement', source: 'cvv' },
  { key: 'kitchen-minor', label: 'Kitchen refresh', re: /\bkitchen\b.*\b(minor|refresh|counter|cabinet|backsplash|reface|update)|\b(counter ?tops?|cabinets?|backsplash)\b/, pct: 96.1, kind: 'improvement', source: 'cvv' },
  { key: 'kitchen-major', label: 'Kitchen remodel', re: /\bkitchen/, pct: 49.5, kind: 'improvement', source: 'cvv' },
  { key: 'bath', label: 'Bathroom remodel', re: /\b(bath|bathroom|shower|tub|vanity|ensuite)/, pct: 73.7, kind: 'improvement', source: 'cvv' },
  { key: 'siding', label: 'Siding', re: /\bsiding/, pct: 80.2, kind: 'improvement', source: 'cvv' },
  { key: 'windows', label: 'Windows', re: /\bwindows?\b/, pct: 67.1, kind: 'improvement', source: 'cvv' },
  { key: 'roof', label: 'New roof', re: /\b(roof|shingle)/, pct: 56.9, kind: 'improvement', source: 'cvv' },
  { key: 'deck-composite', label: 'Composite deck', re: /\b(composite|trex)\b.*\bdeck|\bdeck\b.*\bcomposite/, pct: 64.8, kind: 'improvement', source: 'cvv' },
  { key: 'deck', label: 'Deck', re: /\bdeck/, pct: 82.9, kind: 'improvement', source: 'cvv' },
  { key: 'hvac', label: 'Heating and cooling', re: /\b(heat pump|furnace|hvac|air condition|a\/c|boiler)/, pct: 103.5, kind: 'improvement', source: 'cvv' },
  { key: 'floor-refinish', label: 'Refinished floors', re: /\b(refinish\w*|sand(ed|ing)?)\b.*\bfloor|\bfloor.*\brefinish/, pct: 147, kind: 'improvement', source: 'nar' },
  { key: 'floors', label: 'New flooring', re: /\b(floor|hardwood|laminate|vinyl plank|lvp|tile)/, pct: 118, kind: 'improvement', source: 'nar' },
];

// Words that make anything a repair: fixing what's there adds nothing a buyer pays for.
const REPAIR = /\b(repair|fix|patch|leak|broken|replace(d)? (a |the )?(part|seal)|maintenance)\b/;
// Words that say something new was built or put in.
const BUILD = /\b(new|install|replace|upgrade|renovat|remodel|addition|build|built|finish(ed)? basement|suite|add(ed)? (a |an )?)/;

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * What a job most likely is, from its description: { key, label, pct (share
 * of cost added to value, 0–100), kind ('repair' | 'improvement'), source,
 * sure }. `sure` is false for a rough guess.
 */
export function judgeWork(what) {
  const t = ` ${String(what ?? '').toLowerCase()} `;
  if (!t.trim()) return { key: 'none', label: '', pct: 0, kind: 'improvement', source: 'guess', sure: false };
  const rule = RULES.find((r) => r.re.test(t));
  if (rule) {
    // "Roof repair" is a repair, not a new roof.
    if (rule.kind === 'improvement' && REPAIR.test(t)) return { key: `${rule.key}-repair`, label: `${rule.label} repair`, pct: 0, kind: 'repair', source: 'upkeep', sure: true };
    return { key: rule.key, label: rule.label, pct: Math.min(rule.pct, 100), kind: rule.kind, source: rule.source, sure: true };
  }
  if (REPAIR.test(t)) return { key: 'repair', label: 'Repair', pct: 0, kind: 'repair', source: 'upkeep', sure: true };
  if (BUILD.test(t)) return { key: 'project', label: 'Project', pct: 50, kind: 'improvement', source: 'guess', sure: false };
  return { key: 'unknown', label: 'Not sure', pct: 50, kind: 'improvement', source: 'guess', sure: false };
}

/** What a job adds to the home's value: the person's own figure, or its cost times what the studies recover. */
export function valueAdded(item) {
  if (item?.addsValue != null && Number.isFinite(Number(item.addsValue))) return Math.max(Number(item.addsValue), 0);
  return Math.round((num(item?.cost) * judgeWork(item?.what).pct) / 100);
}

/** Repair or improvement: the person's pick, or what the description suggests. */
export const kindOf = (item) => (item?.kind === 'repair' || item?.kind === 'improvement' ? item.kind : judgeWork(item?.what).kind);
