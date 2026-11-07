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

  it('lists the year’s work on your properties, repairs and improvements', async () => {
    const args = { year: 2026, payments: [], expenses: [], units: [], settings: {} };
    const plain = await buildTaxPdf(args);
    const withWork = await buildTaxPdf({
      ...args,
      work: [
        { id: 'a', property: '318 Dease St', what: 'New windows', cost: 14500, when: '2026-05', kind: 'improvement' },
        { id: 'b', property: '318 Dease St', what: 'Patch roof', cost: 900, when: '', kind: 'repair' },
      ],
    });
    expect(withWork.size).toBeGreaterThan(plain.size);
    const text = new TextDecoder('latin1').decode(new Uint8Array(await withWork.arrayBuffer()));
    expect(text).toContain('Work done on your properties');
    expect(text).toContain('New windows');
    expect(text).toContain('Improvements');
  });
});
