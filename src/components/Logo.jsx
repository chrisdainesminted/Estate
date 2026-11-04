import { MARK } from '../lib/brand.js';

/** The mark alone: two overlapping rounded squares in the brand green, the back one lighter. */
export function LogoMark({ className = 'size-7' }) {
  const { stroke, squares, backOpacity, color } = MARK;
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      {squares.map((q, i) => (
        <rect key={i} x={q.x} y={q.y} width={q.size} height={q.size} rx={q.r} fill="none" stroke={color} strokeWidth={stroke} strokeOpacity={i === 0 ? backOpacity : 1} />
      ))}
    </svg>
  );
}

export default function Logo() {
  return (
    <div className="flex items-center gap-3">
      <LogoMark className="size-8" />
      <span className="text-[22px] font-bold tracking-[-0.035em] text-zinc-950 dark:text-white">Squarely</span>
    </div>
  );
}
