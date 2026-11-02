import { useEffect, useMemo, useState } from 'react';
import { Eye } from 'lucide-react';
import { Card, CardHeader, ViewHeader } from '../../components/ui.jsx';
import { call, receiptBlob } from '../../lib/landlordApi.js';
import Expenses from './Expenses.jsx';

/** A co-owner's view-only link: #books=<workspace>.<view key>. */
export function parseBooks(hash) {
  const m = /books=([A-Za-z0-9_-]{8,40})\.([A-Za-z0-9_-]{16,80})/.exec(hash || '');
  return m ? { id: m[1], key: m[2] } : null;
}

/**
 * The books a co-owner sees from their view-only link: rent received,
 * expenses and receipts, capital cost allowance and each owner's share,
 * with the tax pack and spreadsheet to download. Nothing can be changed,
 * and tenants' contact details aren't included.
 */
export default function BooksView({ books }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    call(`/w/${books.id}/books`, { key: books.key })
      .then(setData)
      .catch((e) => setError(e.status === 401 ? 'This view-only link has been turned off or replaced. Ask the owner who shared it for a new one.' : e.message));
  }, [books]);
  const api = useMemo(() => ({ receiptBlob: (receiptId) => receiptBlob(books.id, books.key, receiptId) }), [books]);

  return (
    <div className="space-y-6">
      <ViewHeader title="Rental books" subtitle={data?.settings?.name ? `Shared by ${data.settings.name} for tax time. View only.` : 'Shared for tax time. View only.'} />
      {error ? (
        <Card>
          <CardHeader title="This link doesn’t open the books" />
          <p className="p-5 text-sm text-zinc-700 dark:text-zinc-300">{error}</p>
        </Card>
      ) : !data ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
      ) : (
        <>
          <p className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <Eye className="size-4" aria-hidden /> You can see the books, open receipts and download your tax pack. Only the owner who shared this link can make changes.
          </p>
          <Expenses data={data} api={api} readOnly />
        </>
      )}
    </div>
  );
}
