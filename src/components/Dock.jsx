import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from './ui.jsx';

const tabClass = (current) =>
  `flex min-h-12 items-center justify-center px-1 text-[13px] transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500 ${
    current ? 'font-semibold text-(--accent) shadow-[inset_0_2px_0_var(--accent)]' : 'font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
  }`;

/**
 * Phones and tablets: the tabs along the bottom, with More holding the views
 * past the basic three, and on a deal its result and Edit button above them.
 * Publishes its height as --dock so toasts and the page end clear it.
 */
export default function Dock({ views, view, onView, result, onEdit }) {
  const root = useRef(null);
  const more = useRef(null);
  const [open, setOpen] = useState(false);
  const basic = views.filter((v) => v.basic);
  const extra = views.filter((v) => !v.basic);
  const inMore = extra.some((v) => v.value === view);

  useLayoutEffect(() => {
    const el = root.current;
    const set = () => document.documentElement.style.setProperty('--dock', `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty('--dock');
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    more.current?.querySelector('[role="menuitem"]')?.focus();
    const onDown = (e) => !more.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="fixed inset-x-0 bottom-0 z-40 bg-(--panel) lg:hidden print:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {result && (
        <section aria-label="This deal at a glance" className="gutter flex items-center justify-between gap-3 border-t border-hairline py-2.5">
          <div className="min-w-0">
            <p className={`tabular text-lg leading-tight font-semibold ${result.valueClass}`}>
              {result.value}
              <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">/mo</span>
            </p>
            <p className="tabular truncate text-xs text-zinc-500 dark:text-zinc-400">{result.sub}</p>
          </div>
          <Button variant="primary" className="shrink-0" onClick={onEdit}>
            <Pencil className="size-4" aria-hidden /> Edit deal
          </Button>
        </section>
      )}
      <nav aria-label="Views" className="grid grid-cols-4 border-t border-hairline">
        {basic.map((v) => (
          <button key={v.value} type="button" aria-current={v.value === view ? 'page' : undefined} onClick={() => onView(v.value)} className={tabClass(v.value === view)}>
            {v.label}
          </button>
        ))}
        <div ref={more} className="relative grid">
          <button type="button" aria-haspopup="menu" aria-expanded={open} aria-current={inMore ? 'page' : undefined} onClick={() => setOpen((o) => !o)} className={tabClass(inMore)}>
            More
          </button>
          {open && (
            <div role="menu" aria-label="More views" className="popover pop absolute right-2 bottom-full mb-2 w-72 rounded-md p-1">
              {extra.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    onView(v.value);
                  }}
                  className="block w-full rounded-[3px] px-3 py-2.5 text-left transition hover:bg-well focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500"
                >
                  <span className={`block text-sm font-semibold ${v.value === view ? 'text-(--accent)' : 'text-zinc-900 dark:text-white'}`}>{v.label}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-zinc-500 dark:text-zinc-400">{v.about}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}
