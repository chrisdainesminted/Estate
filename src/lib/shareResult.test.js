import { describe, expect, it } from 'vitest';
import { buyShareText } from './shareResult.js';

describe('buyShareText', () => {
  it('rounds the number so it says nothing exact about someone’s money', () => {
    expect(buyShareText(393217, { withSuite: true, place: 'Thunder Bay' })).toContain('$395,000 with a rental suite in Thunder Bay');
  });
});
