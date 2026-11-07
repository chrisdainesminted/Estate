import { describe, expect, it } from 'vitest';
import { judgeWork, kindOf, valueAdded } from './workValue.js';

describe('judgeWork', () => {
  it('knows upkeep adds no value but still counts for tax', () => {
    for (const what of ['Tree removal', 'Stump grinding', 'Plumbing', 'Fixed a leak', 'Pest control', 'Painted the units', 'Furnace service']) {
      expect(judgeWork(what), what).toMatchObject({ pct: 0, kind: 'repair', sure: true });
    }
  });
  it('uses the cost studies for projects, never more than the cost', () => {
    expect(judgeWork('New windows')).toMatchObject({ key: 'windows', pct: 67.1, kind: 'improvement', source: 'cvv' });
    expect(judgeWork('Bathroom remodel')).toMatchObject({ pct: 73.7 });
    expect(judgeWork('Kitchen countertops and cabinets')).toMatchObject({ key: 'kitchen-minor', pct: 96.1 });
    expect(judgeWork('Gutted the kitchen')).toMatchObject({ key: 'kitchen-major', pct: 49.5 });
    expect(judgeWork('New roof')).toMatchObject({ key: 'roof', pct: 56.9 });
    expect(judgeWork('Garage door')).toMatchObject({ key: 'garage-door', pct: 100 });
    expect(judgeWork('Refinished hardwood floors')).toMatchObject({ key: 'floor-refinish', pct: 100, source: 'nar' });
  });
  it('treats fixing a part of the house as a repair', () => {
    expect(judgeWork('Roof repair')).toMatchObject({ pct: 0, kind: 'repair' });
    expect(judgeWork('Window repair')).toMatchObject({ pct: 0, kind: 'repair' });
  });
  it('guesses, and says so, for what no study covers', () => {
    expect(judgeWork('Finished the basement')).toMatchObject({ pct: 50, kind: 'improvement', sure: false });
  });
});

describe('valueAdded and kindOf', () => {
  it('use the person’s own figures first', () => {
    expect(valueAdded({ what: 'New windows', cost: 23500 })).toBe(15768);
    expect(valueAdded({ what: 'Tree removal', cost: 3500 })).toBe(0);
    expect(valueAdded({ what: 'Tree removal', cost: 3500, addsValue: 1000 })).toBe(1000);
    expect(kindOf({ what: 'Tree removal' })).toBe('repair');
    expect(kindOf({ what: 'Tree removal', kind: 'improvement' })).toBe('improvement');
  });
});
