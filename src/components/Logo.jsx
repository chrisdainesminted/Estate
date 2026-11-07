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

// The name as people read it (a rebranded copy of the site swaps it; see scripts/rebrand.mjs).
const NAME = 'Squarely';
// A longer name steps down on phones so it stays on one line beside the header's buttons.
// Under 380px wide it may take two short lines instead.
const SIZE = NAME.length > 12 ? 'text-[15px] leading-[1.05] max-[379px]:whitespace-normal min-[380px]:text-[16px] min-[380px]:whitespace-nowrap min-[430px]:text-[18px] sm:text-[22px]' : 'text-[22px] whitespace-nowrap';

export default function Logo() {
  return (
    <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
      <LogoMark className="size-7 shrink-0 sm:size-8" />
      <span className={`${SIZE} font-bold tracking-[-0.035em] text-zinc-950 dark:text-white`}>{NAME}</span>
    </div>
  );
}
