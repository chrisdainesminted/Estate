// Keystone mark: an arch whose center stone is solid — the piece that holds
// the rest up. Same geometry as public/favicon.svg.
const STONES = [
  'M4.5 24A11.5 11.5 0 0 1 6.82 17.08L10.81 20.09A6.5 6.5 0 0 0 9.5 24Z',
  'M7.19 16.61A11.5 11.5 0 0 1 13.02 12.89L14.32 17.72A6.5 6.5 0 0 0 11.02 19.82Z',
  'M18.98 12.89A11.5 11.5 0 0 1 24.81 16.61L20.98 19.82A6.5 6.5 0 0 0 17.68 17.72Z',
  'M25.18 17.08A11.5 11.5 0 0 1 27.5 24L22.5 24A6.5 6.5 0 0 0 21.19 20.09Z',
];
const KEY = 'M13.03 11.14L18.97 11.14L16.79 17.55L15.21 17.55Z';

export function LogoMark({ className = 'size-9' }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-emerald-700 dark:fill-emerald-600" />
      <g fill="#ffffff" transform="translate(0 -1.5)">
        {STONES.map((d) => (
          <path key={d} d={d} opacity={0.55} />
        ))}
        <path d={KEY} />
      </g>
    </svg>
  );
}

export default function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      <div>
        <div className="text-[17px] leading-tight font-semibold tracking-tight text-zinc-950 dark:text-white">Keystone</div>
        <p className="text-[11px] leading-tight text-zinc-500 dark:text-zinc-400">Underwriting for investors past five doors</p>
      </div>
    </div>
  );
}
