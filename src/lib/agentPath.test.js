import { describe, expect, it } from 'vitest';
import { AGENT_STEPS, agentDeadlines, agentProgress } from './agentPath.js';

describe('agentDeadlines', () => {
  it('sets each deadline from the date that starts it', () => {
    const d = agentDeadlines({ started: '2026-01-31', preDone: '2026-11-01', registered: '2027-02-15' }, {}, '2026-11-16');
    expect(d.map((x) => [x.id, x.date])).toEqual([
      ['post', '2029-02-15'],
      ['register', '2027-11-01'],
      ['pre', '2028-01-31'],
    ]);
    // Finished steps go last; the rest by date.
    expect(d.find((x) => x.id === 'pre').done).toBe(true);
    expect(d.find((x) => x.id === 'register').done).toBe(true);
  });

  it('counts the days left and keeps month ends real', () => {
    const [pre] = agentDeadlines({ started: '2024-02-29' }, {}, '2026-02-01');
    expect(pre.date).toBe('2026-02-28');
    expect(pre.days).toBe(27);
  });

  it('ignores dates that are not dates', () => {
    expect(agentDeadlines({ started: 'soon' })).toEqual([]);
  });
});

describe('agentProgress', () => {
  it('counts ticks and finds the next step', () => {
    const total = AGENT_STEPS.flatMap((s) => s.items).length;
    expect(agentProgress({})).toMatchObject({ done: 0, total, next: { id: 'check' } });
    expect(agentProgress({ age: true, school: true, money: true, provider: true }).next.id).toBe('enrol');
    const all = Object.fromEntries(AGENT_STEPS.flatMap((s) => s.items.map(([k]) => [k, true])));
    expect(agentProgress(all)).toMatchObject({ done: total, next: null });
  });
});
