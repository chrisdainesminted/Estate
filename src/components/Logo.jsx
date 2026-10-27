// Bedrock mark: stacked layers that widen toward a solid base, the layer
// everything else is built on. Same geometry as public/favicon.svg.
const LAYERS = [
  { x: 11, y: 7.5, w: 10, opacity: 0.5 },
  { x: 8, y: 13.75, w: 16, opacity: 0.75 },
  { x: 5, y: 20, w: 22, opacity: 1 },
];

export function LogoMark({ className = 'size-9' }) {
  return (
    <svg viewBox="0 0 32 32" className={`${className} drop-shadow-[0_6px_14px_rgb(5_150_105/0.45)]`} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-emerald-700 dark:fill-emerald-600" />
      <g fill="#ffffff">
        {LAYERS.map((l) => (
          <rect key={l.y} x={l.x} y={l.y} width={l.w} height={4.5} rx={1.25} opacity={l.opacity} />
        ))}
      </g>
    </svg>
  );
}

export default function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      <div>
        <div className="bg-gradient-to-r from-zinc-950 to-emerald-800 bg-clip-text text-[17px] leading-tight font-semibold tracking-tight text-transparent dark:from-white dark:to-emerald-300">Bedrock</div>
        <p className="text-[11px] leading-tight text-zinc-500 lg:max-xl:hidden dark:text-zinc-400">Cash flow you can build on</p>
      </div>
    </div>
  );
}
