import { describe, expect, it } from 'vitest';
import { lookupAssessment, parseAddress, queryUrl } from './assessment.js';

const reply = (body, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(body) });

describe('parseAddress', () => {
  it('takes the house number and the first word of the street', () => {
    expect(parseAddress('15 Deermeade Place SE, Calgary, AB')).toEqual({ num: '15', word: 'DEERMEADE' });
    expect(parseAddress('11211 23B Avenue NW')).toEqual({ num: '11211', word: '23B' });
  });
  it('needs a house number and a street', () => {
    expect(parseAddress('Deermeade Place')).toBeNull();
    expect(parseAddress('15')).toBeNull();
  });
  it('drops anything that could change the query', () => {
    expect(parseAddress("15 O'Brien' OR 1=1 --")).toEqual({ num: '15', word: 'OBRIEN' });
    expect(queryUrl('calgary', "x='a'")).not.toContain('OR 1=1');
  });
});

describe('queryUrl', () => {
  it('builds a city open-data query', () => {
    const u = new URL(queryUrl('calgary', "starts_with(address, '15 DEERMEADE')"));
    expect(u.hostname).toBe('data.calgary.ca');
    expect(u.searchParams.get('$where')).toBe("starts_with(address, '15 DEERMEADE')");
  });
});

describe('lookupAssessment', () => {
  it('returns the match, its valuation date, and the neighbourhood spread', async () => {
    const calls = [];
    const fake = (url) => {
      calls.push(url);
      if (calls.length === 1) return reply([{ address: '15 DEERMEADE PL SE', assessed_value: '729000.0', roll_year: '2026', year_of_construction: '1981.0', land_size_sf: '6567.0', comm_name: 'DEER RUN' }]);
      return reply([500000, 600000, 700000, 729000, 800000, 900000].map((v) => ({ assessed_value: String(v) })));
    };
    const r = await lookupAssessment('calgary', '15 Deermeade Place SE', { fetch: fake });
    expect(r.matches[0]).toMatchObject({ address: '15 Deermeade Pl SE', value: 729000, valuedAt: '2025-07-01', yearBuilt: 1981, neighbourhood: 'DEER RUN' });
    expect(r.hood).toMatchObject({ name: 'Deer Run', count: 6, median: 714500 });
    expect(decodeURIComponent(calls[1]).replace(/\+/g, ' ')).toContain("comm_name='DEER RUN'");
  });
  it('dates an Edmonton assessment July 1 of last year', async () => {
    const fake = (url) => reply(url.includes('house_number') ? [{ house_number: '11211', street_name: '23B AVENUE NW', assessed_value: '507500', neighbourhood: 'BLUE QUILL' }] : []);
    const r = await lookupAssessment('edmonton', '11211 23B Ave NW', { fetch: fake, today: new Date('2026-11-14') });
    expect(r.matches[0]).toMatchObject({ value: 507500, valuedAt: '2025-07-01' });
    expect(r.hood).toBeNull();
  });
  it('says so for a city without open assessments, or an address it can’t read', async () => {
    expect((await lookupAssessment('toronto', '1 Main St')).status).toBe(400);
    expect((await lookupAssessment('calgary', 'somewhere')).status).toBe(400);
  });
  it('says so when the city doesn’t answer', async () => {
    expect((await lookupAssessment('winnipeg', '1636 McCreary Road', { fetch: () => reply(null, false) })).status).toBe(502);
  });
});
