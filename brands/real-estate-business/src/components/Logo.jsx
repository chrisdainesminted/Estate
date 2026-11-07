import { MARK, markSvg } from '../lib/brand.js';

/** The mark alone: a rounded square in the brand brown. */
export function LogoMark({ className = 'size-7' }) {
  return <svg viewBox="0 0 48 48" className={className} aria-hidden dangerouslySetInnerHTML={{ __html: markSvg(MARK.color) }} />;
}

/** The wordmark, as Homeward writes it: lowercase, with a dot in the lighter brown. */
export default function Logo() {
  return (
    <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
      <LogoMark className="size-7 shrink-0 sm:size-8" />
      <span className="font-display whitespace-nowrap text-[21px] font-semibold tracking-[-0.03em] text-zinc-900 sm:text-[23px] dark:text-white">
        homeward<span className="ml-1 text-emerald-500 dark:text-emerald-300">.</span>
      </span>
    </div>
  );
}
