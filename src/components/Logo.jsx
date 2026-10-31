import { MARK, bracketPath } from '../lib/brand.js';

/** The mark alone, in the accent green. */
export function LogoMark({ className = 'size-7' }) {
  const { stroke, brackets, square: q } = MARK;
  return (
    <svg
      viewBox="0 0 48 48"
      className={`${className} fill-emerald-700 stroke-emerald-700 dark:fill-emerald-400 dark:stroke-emerald-400 print:fill-emerald-700 print:stroke-emerald-700`}
      aria-hidden
    >
      {brackets.map((pts) => (
        <path key={pts[0].join()} d={bracketPath(pts)} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <rect x={q.x} y={q.y} width={q.size} height={q.size} rx={q.r} stroke="none" />
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
