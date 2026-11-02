// From a floor plan to a shopping list: the rooms (read from a blueprint and
// checked by the person, or typed in) become quantities of each material,
// using the estimating rules builders use, each shown with its rule. No
// prices: stores don't publish them in a form we can check, so each item
// links to a search at the big Canadian stores instead.

const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);
const up = (v) => Math.ceil(v - 1e-9);

export const PROJECTS = [
  { key: 'new', label: 'New build or addition', words: 'framing, sheathing, insulation, drywall, paint, floors and trim' },
  { key: 'basement', label: 'Finish a basement', words: 'framing against the foundation, insulation, drywall, paint, floors and trim' },
  { key: 'reno', label: 'Renovate rooms', words: 'drywall, paint, floors and trim, with the walls already standing' },
];

export const FLOORS = [
  { key: 'vinyl', label: 'Vinyl plank', waste: 0.1, search: 'luxury vinyl plank flooring', underlay: true },
  { key: 'laminate', label: 'Laminate', waste: 0.1, search: 'laminate flooring', underlay: true },
  { key: 'hardwood', label: 'Hardwood', waste: 0.1, search: 'hardwood flooring', underlay: true },
  { key: 'tile', label: 'Tile', waste: 0.15, search: 'porcelain floor tile', underlay: false },
  { key: 'carpet', label: 'Carpet', waste: 0.1, search: 'carpet', underlay: true },
  { key: 'none', label: 'Keep the floor', waste: 0, search: '', underlay: false },
];

// Estimating rules, each shown beside its line.
export const RULES = {
  studSpacing: 16, // inches on centre
  sheet: 32, // a 4 × 8 sheet, square feet
  drywallWaste: 0.12,
  sheathingWaste: 0.1,
  doorArea: 21, // 3 × 7 ft
  windowArea: 15,
  doorWidth: 3,
  mudPerSqft: 1 / 450, // a 3.5-gallon box of joint compound per about 450 sq ft of drywall, three coats
  tapePerSqft: 1 / 1200, // a 500-ft roll per about 1,200 sq ft
  screwsPerSqft: 1 / 300, // a 1 lb box (about 300 screws) per about 300 sq ft
  paintCoverage: 350, // sq ft a gallon covers, one coat
  polyRoll: 1000, // 10 × 100 ft
  wrapRoll: 900, // 9 × 100 ft
  trimWaste: 0.1,
};

/** A room kept to what the takeoff needs, in feet. */
export function cleanRoom(r, i = 0) {
  return {
    name: String(r?.name ?? `Room ${i + 1}`).slice(0, 40) || `Room ${i + 1}`,
    length: num(r?.length),
    width: num(r?.width),
    height: num(r?.height) || 8,
    doors: Math.round(num(r?.doors)),
    windows: Math.round(num(r?.windows)),
    floor: FLOORS.some((f) => f.key === r?.floor) ? r.floor : 'vinyl',
  };
}

/** Square feet of floor, wall and ceiling across the rooms, and the wall running length. */
export function areas(rooms) {
  const list = rooms.map(cleanRoom).filter((r) => r.length > 0 && r.width > 0);
  let floor = 0;
  let walls = 0;
  let perimeter = 0;
  let doors = 0;
  let windows = 0;
  for (const r of list) {
    const p = 2 * (r.length + r.width);
    floor += r.length * r.width;
    perimeter += p;
    walls += Math.max(p * r.height - r.doors * RULES.doorArea - r.windows * RULES.windowArea, 0);
    doors += r.doors;
    windows += r.windows;
  }
  const height = list.length ? list.reduce((s, r) => s + r.height, 0) / list.length : 8;
  return { rooms: list, floor, ceiling: floor, walls, perimeter, doors, windows, height };
}

/** The usual outside wall length for that much floor: the perimeter of a square of it. */
export const guessExterior = (floor) => Math.round(4 * Math.sqrt(num(floor)));

const studLength = (h) => (h <= 8.1 ? '8 ft (92-5/8 in precut)' : h <= 9.1 ? '9 ft (104-5/8 in precut)' : '10 ft');

/**
 * The materials list. `exterior` is the length of outside (or foundation)
 * wall in feet; new interior walls are taken as half the rooms' perimeters
 * (each wall between two rooms counted once). Returns groups of items:
 * { key, name, qty, unit, rule, search }.
 */
export function takeoff({ project = 'new', rooms = [], exterior } = {}) {
  const a = areas(rooms);
  const ext = num(exterior) || guessExterior(a.floor);
  const h = a.height;
  const openings = a.doors + a.windows;
  const groups = [];
  const item = (key, name, qty, unit, rule, search) => ({ key, name, qty: up(qty), unit, rule, search: search ?? name });

  if (project !== 'reno' && a.floor > 0) {
    // Inside walls: each room's walls, halved so a wall two rooms share counts once, less the outside walls.
    const interior = Math.max(a.perimeter / 2 - ext / 2, 0);
    const wallLF = ext + interior;
    const studs = (wallLF * 12) / RULES.studSpacing + 2 * openings + 2 * a.rooms.length;
    const plates = project === 'basement' ? 2 : 3;
    const framing = [
      item('studs', `2×${project === 'new' ? '6' : '4'} studs, ${studLength(h)}`, studs, 'pieces', `One every 16 in along ${Math.round(wallLF)} ft of wall, plus 2 at each door and window and at corners`, `2x${project === 'new' ? '6' : '4'} stud ${h <= 8.1 ? '92-5/8' : h <= 9.1 ? '104-5/8' : '10 ft'}`),
      item('plates', `2×${project === 'new' ? '6' : '4'} plates, 16 ft`, (wallLF * (plates - (project === 'basement' ? 1 : 0))) / 16, 'pieces', project === 'basement' ? 'A top plate along every wall' : 'A bottom plate and a double top plate along every wall', `2x${project === 'new' ? '6' : '4'} 16 ft lumber`),
    ];
    if (project === 'basement') framing.push(item('ptplate', '2×4 pressure-treated bottom plate, 8 ft', wallLF / 8, 'pieces', 'Wood touching concrete must be pressure-treated', '2x4 pressure treated 8 ft'));
    groups.push({ key: 'framing', title: 'Framing', items: framing });

    const extArea = Math.max(ext * h - (project === 'new' ? a.windows * RULES.windowArea + RULES.doorArea : 0), 0);
    const envelope = [];
    if (project === 'new') {
      envelope.push(item('osb', 'OSB wall sheathing, 7/16 in, 4×8', (extArea / RULES.sheet) * (1 + RULES.sheathingWaste), 'sheets', `${Math.round(extArea)} sq ft of outside wall plus 10%`, 'OSB 7/16 4x8'));
      envelope.push(item('wrap', 'House wrap, 9 × 100 ft roll', extArea / RULES.wrapRoll, 'rolls', 'Over all the sheathing', 'house wrap 9 ft x 100 ft'));
    }
    envelope.push(item('insulation', `Wall insulation batts for 2×${project === 'new' ? '6' : '4'} walls`, extArea, 'sq ft to cover', 'Outside walls only. Divide by the coverage printed on the bag; your building department sets the R-value', `insulation batts 2x${project === 'new' ? '6' : '4'}`));
    envelope.push(item('poly', '6 mil vapour barrier, 10 × 100 ft roll', (extArea * 1.1) / RULES.polyRoll, 'rolls', 'Over the insulation, with overlaps', '6 mil vapour barrier poly'));
    groups.push({ key: 'envelope', title: 'Outside walls', items: envelope });
  }

  if (a.floor > 0) {
    const board = a.walls + a.ceiling;
    groups.push({
      key: 'drywall',
      title: 'Drywall',
      items: [
        item('dw-walls', 'Drywall, 1/2 in, 4×8', (a.walls / RULES.sheet) * (1 + RULES.drywallWaste), 'sheets', `${Math.round(a.walls)} sq ft of wall, less doors and windows, plus 12%`, 'drywall 1/2 4x8'),
        item('dw-ceiling', 'Ceiling drywall, 1/2 in, 4×8', (a.ceiling / RULES.sheet) * (1 + RULES.drywallWaste), 'sheets', `${Math.round(a.ceiling)} sq ft of ceiling plus 12%. Many cities ask for 5/8 in fire-rated between units`, 'ceiling drywall 1/2 4x8'),
        item('mud', 'Joint compound, 3.5 gal box', board * RULES.mudPerSqft, 'boxes', 'About one box per 450 sq ft of drywall, three coats', 'joint compound all purpose'),
        item('tape', 'Drywall tape, 500 ft roll', board * RULES.tapePerSqft, 'rolls', 'About one roll per 1,200 sq ft', 'drywall tape paper 500 ft'),
        item('screws', 'Drywall screws, 1-1/4 in, 1 lb', board * RULES.screwsPerSqft, 'boxes', 'About one pound per 300 sq ft', 'drywall screws 1-1/4'),
      ],
    });
    groups.push({
      key: 'paint',
      title: 'Paint',
      items: [
        item('primer', 'Drywall primer', board / RULES.paintCoverage, 'gallons', `One coat over ${Math.round(board)} sq ft at 350 sq ft a gallon`, 'drywall primer'),
        item('paint', 'Interior paint', (board * 2) / RULES.paintCoverage, 'gallons', 'Two coats', 'interior paint eggshell'),
      ],
    });
  }

  const floors = [];
  for (const f of FLOORS.filter((x) => x.key !== 'none')) {
    const sqft = a.rooms.filter((r) => r.floor === f.key).reduce((s, r) => s + r.length * r.width, 0);
    if (!sqft) continue;
    floors.push(item(`floor-${f.key}`, f.label, sqft * (1 + f.waste), 'sq ft', `${Math.round(sqft)} sq ft plus ${Math.round(f.waste * 100)}% for cuts`, f.search));
    if (f.underlay) floors.push(item(`under-${f.key}`, f.key === 'carpet' ? 'Carpet underpad' : `Underlayment for ${f.label.toLowerCase()}`, sqft, 'sq ft', 'Under the whole floor', f.key === 'carpet' ? 'carpet underpad' : 'flooring underlayment'));
  }
  if (floors.length) groups.push({ key: 'floors', title: 'Floors', items: floors });

  if (a.floor > 0) {
    const trim = [item('baseboard', 'Baseboard', Math.max(a.perimeter - a.doors * RULES.doorWidth, 0) * (1 + RULES.trimWaste), 'linear ft', 'Around each room, less the doorways, plus 10%', 'MDF baseboard')];
    if (a.doors) {
      trim.push(item('doors', 'Interior prehung doors', a.doors, 'doors', 'One for each door on the plan', 'interior prehung door'));
      trim.push(item('casing', 'Door casing', a.doors * 34, 'linear ft', 'About 17 ft a side, both sides of each door', 'door casing MDF'));
    }
    if (project === 'new' && a.windows) trim.push(item('windows', 'Windows', a.windows, 'windows', 'Sizes from the plan: order early, they take weeks', 'vinyl window'));
    groups.push({ key: 'trim', title: 'Doors and trim', items: trim });
  }

  return { ...a, exterior: ext, project, groups, count: groups.reduce((s, g) => s + g.items.length, 0) };
}

/** Where to shop for an item: a search at each big Canadian building store. */
export function storeLinks(search) {
  const q = encodeURIComponent(search);
  const google = (site) => `https://www.google.com/search?q=${encodeURIComponent(`site:${site} ${search}`)}`;
  return [
    { key: 'homedepot', name: 'Home Depot', url: `https://www.homedepot.ca/search?q=${q}` },
    { key: 'rona', name: 'RONA', url: google('rona.ca') },
    { key: 'homehardware', name: 'Home Hardware', url: google('homehardware.ca') },
    { key: 'canadiantire', name: 'Canadian Tire', url: google('canadiantire.ca') },
  ];
}

/** The list as plain text, for an email to a lumber yard or a copy into notes. */
export function listText(t, title = 'Materials list') {
  const lines = [title, `${Math.round(t.floor).toLocaleString('en-CA')} sq ft over ${t.rooms.length} room${t.rooms.length === 1 ? '' : 's'}`, ''];
  for (const g of t.groups) {
    lines.push(g.title.toUpperCase());
    for (const i of g.items) lines.push(`- ${i.name}: ${i.qty.toLocaleString('en-CA')} ${i.unit}`);
    lines.push('');
  }
  lines.push('Quantities from Squarely using common estimating rules. Check them with your builder before ordering.');
  return lines.join('\n');
}

/** What Claude is asked to read from a plan: rooms with their sizes in feet, and the outside wall length. */
export const BLUEPRINT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['rooms', 'exteriorFeet', 'notes'],
  properties: {
    rooms: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'length', 'width', 'height', 'doors', 'windows'],
        properties: {
          name: { type: 'string' },
          length: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' },
          doors: { type: 'integer' },
          windows: { type: 'integer' },
        },
      },
    },
    exteriorFeet: { type: 'number' },
    notes: { type: 'string' },
  },
};

export const BLUEPRINT_PROMPT = `This is a floor plan or blueprint for a home in Canada. Read every room on it.
For each room give its name, its length and width in feet (convert metres or feet-and-inches to decimal feet), its ceiling height in feet (8 if the plan doesn't say), and how many doors and windows open from it.
Also give the total length of the outside walls in feet (0 if you can't tell).
Only report what the plan shows. If a size isn't written on the plan, estimate it from the scale if there is one and say so in notes; otherwise leave the room out and say so in notes.`;

/** Rooms Claude read, kept to sane sizes, with anything odd left out. */
export function cleanReading(r) {
  const rooms = (Array.isArray(r?.rooms) ? r.rooms : [])
    .slice(0, 60)
    .map(cleanRoom)
    .filter((x) => x.length > 0 && x.length < 200 && x.width > 0 && x.width < 200 && x.height < 30);
  return { rooms, exterior: num(r?.exteriorFeet) < 5000 ? Math.round(num(r?.exteriorFeet)) : 0, notes: String(r?.notes ?? '').slice(0, 600) };
}

/** The build plan kept with the person's numbers: the project, the rooms and the outside wall length. */
export const DEFAULT_BUILD = { project: 'reno', rooms: [], exterior: null, notes: '' };
export function normalizeBuild(b) {
  return {
    project: PROJECTS.some((p) => p.key === b?.project) ? b.project : DEFAULT_BUILD.project,
    rooms: (Array.isArray(b?.rooms) ? b.rooms : []).slice(0, 60).map(cleanRoom),
    exterior: num(b?.exterior) || null,
    notes: String(b?.notes ?? '').slice(0, 600),
  };
}
