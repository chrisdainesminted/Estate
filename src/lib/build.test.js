import { describe, expect, it } from 'vitest';
import { areas, cleanReading, guessExterior, listText, storeLinks, takeoff } from './build.js';

const rooms = [
  { name: 'Living', length: 16, width: 12, height: 8, doors: 1, windows: 2, floor: 'vinyl' },
  { name: 'Bedroom', length: 12, width: 10, height: 8, doors: 1, windows: 1, floor: 'carpet' },
];

describe('areas', () => {
  it('adds floor, wall and perimeter, less the openings', () => {
    const a = areas(rooms);
    expect(a.floor).toBe(192 + 120);
    expect(a.perimeter).toBe(56 + 44);
    expect(a.walls).toBe(56 * 8 - 21 - 30 + 44 * 8 - 21 - 15);
  });
});

describe('takeoff', () => {
  it('lists drywall, paint, floors and trim for a renovation, without framing', () => {
    const t = takeoff({ project: 'reno', rooms });
    const keys = t.groups.map((g) => g.key);
    expect(keys).toEqual(['drywall', 'paint', 'floors', 'trim']);
    const sheets = t.groups[0].items.find((i) => i.key === 'dw-walls').qty;
    expect(sheets).toBe(Math.ceil((areas(rooms).walls / 32) * 1.12));
    const vinyl = t.groups.find((g) => g.key === 'floors').items.find((i) => i.key === 'floor-vinyl');
    expect(vinyl.qty).toBe(Math.ceil(192 * 1.1));
  });
  it('frames, sheathes and insulates a new build', () => {
    const t = takeoff({ project: 'new', rooms, exterior: 72 });
    expect(t.groups.map((g) => g.key)).toEqual(['framing', 'envelope', 'drywall', 'paint', 'floors', 'trim']);
    const studs = t.groups[0].items[0];
    expect(studs.name).toMatch(/2×6/);
    expect(studs.qty).toBeGreaterThan(72 * 0.75);
  });
  it('uses pressure-treated plates against a basement floor', () => {
    const t = takeoff({ project: 'basement', rooms });
    expect(t.groups[0].items.some((i) => i.key === 'ptplate')).toBe(true);
    expect(t.exterior).toBe(guessExterior(312));
  });
  it('writes a plain list for a lumber yard', () => {
    expect(listText(takeoff({ project: 'reno', rooms }))).toMatch(/Drywall, 1\/2 in, 4×8: \d+ sheets/);
  });
});

describe('reading a plan', () => {
  it('keeps sane rooms and drops nonsense', () => {
    const r = cleanReading({ rooms: [{ name: 'Kitchen', length: 12, width: 11, height: 9, doors: 1, windows: 1 }, { name: 'Bad', length: 900, width: 2 }], exteriorFeet: 140, notes: 'ok' });
    expect(r.rooms.map((x) => x.name)).toEqual(['Kitchen']);
    expect(r.exterior).toBe(140);
  });
  it('links each item to the stores', () => {
    expect(storeLinks('drywall 1/2 4x8').map((s) => s.name)).toEqual(['Home Depot', 'RONA', 'Home Hardware', 'Canadian Tire']);
  });
});
