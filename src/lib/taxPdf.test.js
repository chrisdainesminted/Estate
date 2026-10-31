import { describe, expect, it } from 'vitest';
import { buildTaxPdf } from './taxPdf.js';

describe('tax pack', () => {
  it('builds a PDF for the year', async () => {
    const blob = await buildTaxPdf({
      year: 2026,
      payments: [{ unitId: 'u1', month: '2026-03', amount: 1700, paidOn: '2026-03-01' }],
      expenses: [{ date: '2026-04-02', amount: 250, category: 'repairs', vendor: 'Plumber' }],
      units: [{ id: 'u1', label: 'Upper', address: '1 Main St' }],
      settings: { name: 'Sam' },
    });
    expect(blob.size).toBeGreaterThan(1500);
    const head = new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()).slice(0, 5));
    expect(head).toBe('%PDF-');
  });
});
