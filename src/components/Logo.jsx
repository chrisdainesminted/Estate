// Bedrock mark: stacked layers that widen toward a solid base, the layer
// everything else is built on. Same geometry as public/favicon.svg.
const LAYERS = [
  { x: 11, y: 7.5, w: 10, opacity: 0.5 },
  { x: 8, y: 13.75, w: 16, opacity: 0.75 },
  { x: 5, y: 20, w: 22, opacity: 1 },
];

export function LogoMark({ className = 'size-9' }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="6" className="fill-emerald-700 dark:fill-emerald-600" />
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
    <div className="flex items-center gap-2">
      <LogoMark className="size-7" />
      <span className="text-[17px] font-semibold tracking-tight text-zinc-950 dark:text-white">Bedrock</span>
    </div>
  );
}
