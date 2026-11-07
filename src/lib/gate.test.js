import { describe, expect, it } from 'vitest';
import { safeNext, signInRedirect } from './gate.js';

const at = (pathname, search = '', hash = '') => ({ pathname, search, hash });

describe('the account gate', () => {
  it('sends a signed-out visit to make an account, coming back after', () => {
    expect(signInRedirect(at('/app/', '?view=listings', '#deal=abc'), null)).toBe(`/account/?next=${encodeURIComponent('/app/?view=listings#deal=abc')}`);
  });
  it('opens the app when signed in, on the Claude page, or for a co-owner’s books link', () => {
    expect(signInRedirect(at('/app/'), { id: 'a', key: 'b' })).toBeNull();
    expect(signInRedirect(at('/'), null)).toBeNull();
    expect(signInRedirect(at('/app/', '?view=landlord', '#books=ws.key'), null)).toBeNull();
  });
  it('only ever returns into the app', () => {
    expect(safeNext('profile')).toBe('/app/?view=profile');
    expect(safeNext('/app/?view=listings#deal=x')).toBe('/app/?view=listings#deal=x');
    expect(safeNext('https://evil.example')).toBeNull();
    expect(safeNext('//evil.example/app')).toBeNull();
    expect(safeNext('/application')).toBeNull();
    expect(safeNext('')).toBeNull();
  });
});
