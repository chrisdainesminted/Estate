import { describe, expect, it } from 'vitest';
import { guessCategory, guessColumns, parseCsv, statementExpenses, toAmount, toDate } from './bankCsv.js';

describe('reading a bank statement', () => {
  it('reads quoted fields, commas and line breaks', () => {
    expect(parseCsv('a,"b, c","say ""hi"""\r\n1,2,3\n\n')).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['1', '2', '3'],
    ]);
  });

  it('reads the date and money formats banks use', () => {
    expect(toDate('2026-03-04')).toBe('2026-03-04');
    expect(toDate('3/4/2026')).toBe('2026-03-04');
    expect(toDate('3/4/2026', true)).toBe('2026-04-03');
    expect(toDate('04 Mar 2026')).toBe('2026-03-04');
    expect(toDate('Mar 4, 2026')).toBe('2026-03-04');
    expect(toDate('Grocery')).toBe('');
    expect(toAmount('$1,234.56')).toBe(1234.56);
    expect(toAmount('(12.00)')).toBe(-12);
    expect(toAmount('-12.5')).toBe(-12.5);
    expect(toAmount('')).toBeNull();
  });

  it('reads an RBC-style statement with named columns, keeping money out only', () => {
    const rows = parseCsv(
      [
        'Account Type,Account Number,Transaction Date,Cheque Number,Description 1,Description 2,CAD$,USD$',
        'Chequing,1234,3/1/2026,,CITY OF THUNDER BAY,TAX,-1650.00,',
        'Chequing,1234,3/2/2026,,E-TRANSFER RENT,,1500.00,',
        'Chequing,1234,3/9/2026,,HOME DEPOT #7104,,-84.12,',
      ].join('\n'),
    );
    const cols = guessColumns(rows);
    expect(cols.header).toBe(true);
    expect(cols.names[cols.date]).toBe('Transaction Date');
    expect(cols.names[cols.amount]).toBe('CAD$');
    const ex = statementExpenses(rows, cols, { existing: [{ date: '2026-03-09', amount: 84.12 }] });
    expect(ex.map((e) => [e.date, e.amount, e.category, e.duplicate])).toEqual([
      ['2026-03-01', 1650, 'propertyTax', false],
      ['2026-03-09', 84.12, 'repairs', true],
    ]);
  });

  it('reads a TD-style statement with no header and separate money out and in', () => {
    const rows = parseCsv(['03/05/2026,ENBRIDGE GAS,212.40,,4000.00', '03/06/2026,DEPOSIT,,1500.00,5500.00'].join('\n'));
    const cols = guessColumns(rows);
    expect(cols.header).toBe(false);
    // No names to go on: the first money column is taken as the amount, so pick the debit column instead.
    const ex = statementExpenses(rows, { ...cols, amount: null, debit: 2 });
    expect(ex).toEqual([{ key: '0', date: '2026-03-05', amount: 212.4, description: 'ENBRIDGE GAS', category: 'utilities', duplicate: false }]);
  });

  it('handles credit cards that show purchases as positive', () => {
    const rows = parseCsv('Date,Description,Amount\n2026-02-02,INTACT INSURANCE,145.00\n2026-02-10,PAYMENT THANK YOU,-500.00');
    const ex = statementExpenses(rows, guessColumns(rows), { spendingPositive: true });
    expect(ex.map((e) => [e.amount, e.category])).toEqual([[145, 'insurance']]);
  });

  it('suggests a T776 line from the description', () => {
    expect(guessCategory('TBHYDRO ELECTRIC')).toBe('utilities');
    expect(guessCategory('LAW OFFICE OF J SMITH')).toBe('professional');
    expect(guessCategory('Something else')).toBe('other');
  });
});
