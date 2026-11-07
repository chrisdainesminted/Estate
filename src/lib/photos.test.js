import { describe, expect, it } from 'vitest';
import { photoPlace, photoUrl } from './photos.js';

describe('house photos', () => {
  const tb = { name: 'Thunder Bay', province: 'ON' };
  it('looks up the address in its city', () => {
    expect(photoPlace('230 Brodie Street N', tb)).toBe('230 Brodie Street N, Thunder Bay, ON');
    expect(photoPlace('5 Main St, Thunder Bay', tb)).toBe('5 Main St, Thunder Bay, ON');
    expect(photoPlace('', tb)).toBe('');
  });
  it('builds Street View and satellite links only with a key', () => {
    expect(photoUrl({ where: 'x', key: '' })).toBeNull();
    const sv = photoUrl({ where: '230 Brodie Street N, Thunder Bay, ON', key: 'k' });
    expect(sv).toMatch(/^https:\/\/maps\.googleapis\.com\/maps\/api\/streetview\?/);
    expect(sv).toContain('return_error_code=true');
    expect(photoUrl({ kind: 'satellite', where: 'x', key: 'k', width: 900 })).toContain('maptype=satellite');
    expect(photoUrl({ kind: 'satellite', where: 'x', key: 'k', width: 900 })).toContain('size=640x400');
  });
});
