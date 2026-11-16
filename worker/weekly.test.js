import { describe, expect, it } from 'vitest';
import { weekBefore, weeklyDay, weeklyEmail } from './weekly.js';

const match = (id, over = {}) => ({ listing: { id, address: `${id} Main St`, price: 400000, url: `https://example.com/${id}` }, costToLive: null, perDoor: null, canBuy: false, ...over });

describe('the free weekly email', () => {
  it('goes out on Mondays, covering the week before', () => {
    expect(weeklyDay('2026-11-16')).toBe(true);
    expect(weeklyDay('2026-11-17')).toBe(false);
    expect(weekBefore('2026-11-16')).toBe('2026-11-09');
  });
  it('picks the three best: homes you could buy, then the cheapest to live in', () => {
    const mail = weeklyEmail(
      [match('a', { costToLive: 2400 }), match('b', { canBuy: true, costToLive: 2900 }), match('c', { costToLive: 2100 }), match('d'), match('c', { costToLive: 2100 })],
      'https://site.example',
    );
    expect(mail.subject).toContain('3 homes that fit you this week');
    const order = ['b', 'c', 'a'].map((id) => mail.text.indexOf(`${id} Main St`));
    expect(order).toEqual([...order].sort((x, y) => x - y));
    expect(mail.text).toContain('best of 4 new or cheaper homes');
    expect(mail.text).toContain('Try it free for 7 days');
  });
  it('sends nothing without matches', () => {
    expect(weeklyEmail([], 'https://site.example')).toBeNull();
  });
});
