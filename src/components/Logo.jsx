import { STRATA, STRATA_HEIGHT } from '../lib/brand.js';

/** The mark alone, in the accent green. */
export function LogoMark({ className = 'size-7' }) {
  return (
    <svg viewBox="0 0 48 48" className={`${className} fill-emerald-700 dark:fill-emerald-400 print:fill-emerald-700`} aria-hidden>
      {STRATA.map((s) => (
        <rect key={s.y} x={s.x} y={s.y} width={s.w} height={STRATA_HEIGHT} />
      ))}
    </svg>
  );
}

export default function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark className="size-6" />
      <span className="text-[19px] font-bold tracking-[-0.035em] text-zinc-950 dark:text-white">Bedrock</span>
    </div>
  );
}
