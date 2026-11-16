import { MARK, markSvg } from '../lib/brand.js';

/** The mark alone: a rounded square in the brand brown. */
export function LogoMark({ className = 'size-7' }) {
  return <svg viewBox="0 0 48 48" className={className} aria-hidden dangerouslySetInnerHTML={{ __html: markSvg(MARK.color) }} />;
}

/** The wordmark: NorthKey, with Key in the lighter brown. */
/** `compact`: on the narrowest phones the name shows on its own, a little smaller, so it fits beside the header buttons. */
export default function Logo({ compact = false }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
      <LogoMark className={`size-7 shrink-0 sm:size-8 ${compact ? 'max-[440px]:hidden' : ''}`} />
      <span className={`${compact ? 'max-[440px]:text-[19px] max-[380px]:text-[17px]' : ''} font-display whitespace-nowrap text-[21px] font-semibold tracking-[-0.03em] text-zinc-900 sm:text-[23px] dark:text-white`}>
        North<span className="text-emerald-600 dark:text-emerald-300">Key</span>
      </span>
    </div>
  );
}
