import { describe, expect, it } from 'vitest';
import { DEFAULT_DEAL, PRESET_DEALS, makeDeal } from './presets.js';
import { SITE_URL, hasDetails, readShared, sameDeal, shareLink } from './share.js';

const hashOf = (link) => link.slice(link.indexOf('#'));
const linkFor = (d) => `${SITE_URL}#deal=${btoa(JSON.stringify({ v: 1, s: 'abc', d })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;

describe('shareLink and readShared', () => {
  const deal = makeDeal({ ...PRESET_DEALS[2], address: '12 Elm St, Thunder Bay', notes: 'Roof done in 2022 — café nearby', listingUrl: 'https://www.rew.ca/properties/12-elm' });

  it('round-trips a deal through the link, sending only what differs from a new deal', () => {
    const link = shareLink(deal);
    expect(link.startsWith(`${SITE_URL}#deal=`)).toBe(true);
    const { fields, sharedId } = readShared(hashOf(link));
    expect(sharedId).toBe(deal.id);
    const copy = makeDeal(fields);
    for (const k of Object.keys(DEFAULT_DEAL)) expect(copy[k]).toEqual(deal[k]);
    expect(sameDeal(deal, fields)).toBe(true);
    expect(Object.keys(fields).length).toBeLessThan(Object.keys(DEFAULT_DEAL).length);
  });

  it('can leave out the address, listing link and notes', () => {
    expect(hasDetails(deal)).toBe(true);
    const { fields } = readShared(hashOf(shareLink(deal, { withDetails: false })));
    expect(fields.address).toBeUndefined();
    expect(fields.notes).toBeUndefined();
    expect(fields.listingUrl).toBeUndefined();
    expect(fields.price).toBe(deal.price);
  });

  it('keeps the original share id when a shared copy is passed on', () => {
    const copy = makeDeal({ ...readShared(hashOf(shareLink(deal))).fields, sharedId: deal.id });
    expect(readShared(hashOf(shareLink(copy))).sharedId).toBe(deal.id);
  });

  it('checks every field from a link', () => {
    const { fields, sharedId } = readShared(
      hashOf(
        linkFor({
          name: 'x'.repeat(500),
          price: -5,
          rate: 'seven',
          rentPerUnit: 1e20,
          appreciationPct: -2,
          country: 'mars',
          unitType: 'duplex',
          units: 40,
          prepay: 'forever',
          refiEnabled: 'yes',
          listingUrl: 'javascript:alert(1)',
          evil: '<script>',
        }),
      ),
    );
    expect(sharedId).toBe('abc');
    expect(fields.name).toHaveLength(120);
    expect(fields.price).toBe(0);
    expect(fields.rentPerUnit).toBe(1e9);
    expect(fields.appreciationPct).toBe(-2);
    expect(fields.units).toBe(2);
    for (const k of ['rate', 'country', 'prepay', 'refiEnabled', 'listingUrl', 'evil', 'hacked']) expect(fields).not.toHaveProperty(k);
  });

  it('never lets a link reach the object prototype', () => {
    const raw = '{"v":1,"s":"abc","d":{"__proto__":{"price":1},"constructor":{"x":1},"price":250000}}';
    const { fields } = readShared(`#deal=${btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`);
    expect(fields.price).toBe(250000);
    expect(Object.getPrototypeOf(fields)).toBe(Object.prototype);
    expect(Object.hasOwn(fields, 'constructor')).toBe(false);
    expect({}.price).toBeUndefined();
  });

  it('keeps a 5+ unit building between 5 and 500 units', () => {
    expect(readShared(hashOf(linkFor({ unitType: 'multiplex', units: 2 }))).fields.units).toBe(5);
    expect(readShared(hashOf(linkFor({ unitType: 'multiplex', units: 9000 }))).fields.units).toBe(500);
  });

  it('ignores anything that is not a deal link', () => {
    expect(readShared('')).toBeNull();
    expect(readShared('#section')).toBeNull();
    expect(readShared('#deal=%%%')).toBeNull();
    expect(readShared('#deal=bm90IGpzb24')).toBeNull();
    expect(readShared(`#deal=${btoa(JSON.stringify({ v: 2, d: {} }))}`)).toBeNull();
    expect(readShared(`#deal=${btoa(JSON.stringify({ v: 1, d: [] }))}`)).toBeNull();
  });
});
