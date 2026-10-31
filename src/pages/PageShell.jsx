import Logo from '../components/Logo.jsx';
import SiteFooter from '../components/SiteFooter.jsx';
import AccountLink from '../components/AccountLink.jsx';

const NAV = [
  ['Find a home', '/homes/'],
  ['How we calculate', '/methods/'],
  ['About', '/about/'],
  ['Contact', '/contact/'],
];

/** The frame around the website's plain pages: logo and links on top, the site footer below. */
export default function PageShell({ width = 'max-w-3xl', children }) {
  const here = typeof window !== 'undefined' ? window.location.pathname : '';
  return (
    <div className="min-h-dvh bg-(--page) text-zinc-900 antialiased dark:text-zinc-100">
      <header className="border-b border-hairline">
        <div className={`mx-auto flex h-14 ${width} items-center justify-between gap-3 px-4 sm:px-6`}>
          <a href="/" aria-label="Bedrock home" className="shrink-0">
            <Logo />
          </a>
          <nav aria-label="Site" className="flex items-center gap-1 overflow-x-auto text-sm">
            {NAV.map(([label, href]) => (
              <a
                key={href}
                href={href}
                aria-current={here.startsWith(href) ? 'page' : undefined}
                className={`whitespace-nowrap rounded-md px-2.5 py-2 font-medium hover:bg-well ${here.startsWith(href) ? 'text-zinc-950 dark:text-white' : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'} ${href === '/homes/' ? 'max-sm:hidden' : ''}`}
              >
                {label}
              </a>
            ))}
            {!here.startsWith('/account') && <AccountLink />}
          </nav>
        </div>
      </header>
      <main id="main" className={`mx-auto ${width} px-4 py-10 sm:px-6 sm:py-16`}>
        {children}
      </main>
      <SiteFooter width={width === 'max-w-3xl' ? 'max-w-3xl' : 'max-w-6xl'} />
    </div>
  );
}

export const h1 = 'text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl dark:text-white';
export const h2 = 'mt-12 text-xl font-semibold tracking-tight text-zinc-950 dark:text-white';
export const prose = 'mt-3 space-y-3 leading-relaxed text-zinc-700 dark:text-zinc-300';
export const lede = 'mt-4 text-lg leading-relaxed text-zinc-700 dark:text-zinc-300';
export const a = 'font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400';
