import Logo from './Logo.jsx';

/** The website's footer: every public page links to everything else from here. */
const COLUMNS = [
  [
    'Buy',
    [
      ['See what you can buy', '/app/?view=home'],
      ['Homes for sale', '/homes/#kind=sale'],
      ['Morning listings', '/app/?view=listings'],
      ['Rental calculator', '/app/?view=analyze'],
    ],
  ],
  [
    'Rent',
    [
      ['Homes for rent', '/homes/'],
      ['List a home, free', '/app/?view=landlord'],
      ['Landlord tools', '/app/?view=landlord'],
    ],
  ],
  [
    'Bedrock',
    [
      ['How it works', '/#how'],
      ['Questions', '/#faq'],
      ['Terms of use', '/terms/'],
      ['Privacy', '/privacy/'],
    ],
  ],
];

export default function SiteFooter({ width = 'max-w-6xl' }) {
  return (
    <footer className="border-t border-hairline">
      <div className={`mx-auto w-full ${width} px-4 py-12 text-sm sm:px-6`}>
        <div className="grid gap-10 sm:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-xs">
            <a href="/" aria-label="Bedrock home" className="inline-block rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--accent)">
              <Logo />
            </a>
            <p className="mt-3 leading-relaxed text-zinc-500 dark:text-zinc-400">
              First homes, rentals and the numbers behind them, anywhere in Canada. Free for renters and buyers.
            </p>
          </div>
          {COLUMNS.map(([title, links]) => (
            <nav key={title} aria-label={title}>
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-950 dark:text-white">{title}</h2>
              <ul className="mt-3 space-y-2">
                {links.map(([label, href]) => (
                  <li key={label}>
                    <a href={href} className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p className="mt-10 border-t border-hairline pt-6 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Estimates, not financial, legal or tax advice. Bedrock isn’t a real estate brokerage or a lender; a mortgage broker or lawyer confirms the real numbers. © {new Date().getFullYear()} Bedrock
        </p>
      </div>
    </footer>
  );
}
