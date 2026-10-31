import { useEffect, useRef, useState } from 'react';

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** True once the element has come into view (or straight away where that can't be watched). */
function useSeen(ref, margin = '0px 0px -10% 0px') {
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined' || reduced());
  useEffect(() => {
    if (seen || !ref.current) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [seen, ref, margin]);
  return seen;
}

/** Fades its children up the first time they scroll into view. */
export function Reveal({ as: Tag = 'div', delay = 0, className = '', children, ...rest }) {
  const ref = useRef(null);
  const seen = useSeen(ref);
  return (
    <Tag ref={ref} className={`reveal ${seen ? 'in' : ''} ${className}`} style={delay ? { '--delay': `${delay}ms` } : undefined} {...rest}>
      {children}
    </Tag>
  );
}

/**
 * A number that counts to its value when it first comes into view, and
 * glides to each new value after that. Screen readers get the final value.
 */
export function CountUp({ value, format = String, duration = 700, className = '' }) {
  const ref = useRef(null);
  const seen = useSeen(ref, '0px');
  const [shown, setShown] = useState(reduced() ? value : 0);
  const from = useRef(reduced() ? value : 0);
  useEffect(() => {
    if (!seen || !Number.isFinite(value)) return undefined;
    if (reduced()) {
      setShown(value);
      return undefined;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t) => {
      const k = Math.min((t - start) / duration, 1);
      const eased = 1 - (1 - k) ** 3;
      const v = a + (value - a) * eased;
      setShown(v);
      from.current = v;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, value, duration]);
  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      <span aria-hidden>{Number.isFinite(value) ? format(Math.round(shown)) : '—'}</span>
      <span className="sr-only">{Number.isFinite(value) ? format(value) : ''}</span>
    </span>
  );
}
