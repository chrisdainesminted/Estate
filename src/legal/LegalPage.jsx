import Logo from '../components/Logo.jsx';
import SiteFooter from '../components/SiteFooter.jsx';

/**
 * Terms of use (/terms/) and privacy (/privacy/), in plain words. What they
 * say about storage, retention and other services matches the code: the
 * calculators keep everything in the browser; the server keeps landlord
 * workspaces, applications, listings and reports; Stripe, Resend and
 * Cloudflare handle cards, email and hosting.
 */

export const UPDATED = '2026-10-31';
// Shown wherever the pages say how to reach us; until it's set they point to the contact form.
export const CONTACT_EMAIL = '';

const contact = CONTACT_EMAIL ? (
  <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400">
    {CONTACT_EMAIL}
  </a>
) : (
  <a href="/contact/" className="font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400">
    our contact form
  </a>
);

const TERMS = {
  title: 'Terms of use',
  intro: 'These terms cover using Bedrock: the calculators, the home listings, and the tools for landlords. Using the site means you agree to them.',
  sections: [
    [
      'What Bedrock is, and isn’t',
      <>
        <p>
          Bedrock is software. It estimates what you could buy, what a home would cost you, and how a rental would perform, and it lets owners list homes and manage
          tenancies. It isn’t a real estate brokerage, a mortgage lender or broker, a lawyer or an accountant, and nothing on it is financial, legal or tax advice.
        </p>
        <p>
          Every number is an estimate built on assumptions you can see and change. Rules, rates and program amounts change; we check them but can’t promise they’re
          current or right for you. Before you buy, borrow, sign a lease or file taxes, confirm the numbers with a mortgage broker, lawyer or accountant.
        </p>
      </>,
    ],
    [
      'Listings',
      <>
        <p>
          Homes listed for rent or for sale are posted by their owners, who are responsible for what they say. We don’t inspect homes, check ownership or vet the
          people involved. See a place in person, and check who you’re dealing with, before you pay anything. Use the Report button on any listing that looks wrong;
          we hide listings that several people report and review them.
        </p>
        <p>
          The morning listings in the calculators are homes for sale found on public listing sites. Each links to its original page, which is the one to trust;
          Bedrock fills in gaps, such as rent, with local averages.
        </p>
      </>,
    ],
    [
      'If you list a home or use the landlord tools',
      <>
        <p>
          List only homes you own or are allowed to rent or sell, describe them honestly, and follow the law where the home is, including human rights rules on who
          you rent to and your province’s rules on deposits, leases and notices. Don’t list homes you don’t have, use another person’s photos, or ask applicants for
          more than the law allows.
        </p>
        <p>
          Your workspace opens with a private link. Anyone with that link can see and change it, so keep it safe. If you lose it, we can’t get it back for you: we keep
          only a scrambled form of its key.
        </p>
        <p>Listings stay up for 60 days unless you renew them, and we may remove a listing or close a workspace that breaks these terms.</p>
      </>,
    ],
    [
      'Fees',
      <>
        <p>
          Searching, applying, booking viewings, the calculators and listing a home are free. The rent tracker is free for your first tenanted unit. Each further
          tenanted unit costs 2% of the rent you track for it, at most $30 a month, in Canadian dollars; vacant units are free. Bedrock is software you use: you collect
          rent and run your tenancies yourself.
        </p>
        <p>
          If you track more than one tenanted unit you add a card, and we charge it once a month, through Stripe, for the tenanted units you’re tracking at the time. The Billing tab shows the price
          before you’re charged and every charge after. Remove your card any time and charges stop; you keep your free unit. Taxes will be added if we’re required to
          collect them. If you think a charge is wrong, tell us within 60 days and we’ll fix it.
        </p>
      </>,
    ],
    [
      'Using the site fairly',
      <p>
        Don’t use Bedrock to break the law, mislead or harass anyone, send spam, collect other people’s information, or get around its limits. Don’t try to break into
        it or overload it. We limit how often some things can be done, like applying or reporting, to keep it working for everyone.
      </p>,
    ],
    [
      'Responsibility',
      <>
        <p>
          We work to keep Bedrock accurate and running, but it’s provided as it is, without promises that it’s error-free or always available. As far as the law
          allows, we aren’t responsible for decisions you make with its estimates, for what other people post or do, or for indirect losses. If we are found
          responsible, our total responsibility is limited to what you paid us in the 12 months before. Nothing here takes away rights you have under consumer
          protection law.
        </p>
      </>,
    ],
    [
      'Changes, and the law that applies',
      <p>
        We may update these terms; the date at the top says when they last changed, and continuing to use Bedrock after a change means you accept it. We’ll give
        landlords with a card on file notice of any change to fees before it applies. These terms are governed by the laws of Ontario and of Canada. Questions: {contact}.
      </p>,
    ],
  ],
};

const PRIVACY = {
  title: 'Privacy',
  intro: 'What Bedrock keeps about you, where, and for how long. The short version: the calculators keep your numbers in your own browser, and we keep only what’s needed for listings, applications and the landlord tools.',
  sections: [
    [
      'The calculators: nothing leaves your device',
      <p>
        Your income, savings, debts, rent and the deals you save are stored in your own browser, not on our server. Clearing your browser’s data for this site deletes
        them. If you share a deal by link, its numbers travel in that link; anyone you send it to can see them.
      </p>,
    ],
    [
      'When you apply for a home, report a repair or pay rent',
      <>
        <p>
          We keep what you send, such as your name, email, phone, move-in date, message and, if you choose to add them, your income, employer and a landlord reference, and pass it to that landlord only. When you tell your landlord you’ve sent rent, they see the amount and date, and your receipts stay on your tenant page. We don’t sell it or use it to advertise
          to you. Applications that are declined or withdrawn are deleted after 180 days; the landlord can delete yours sooner. Your browser keeps a private link to your
          application so you can check on it.
        </p>
      </>,
    ],
    [
      'When you list a home or use the landlord tools',
      <>
        <p>
          We keep your workspace: your listings and photos, viewing times, applications, tenants and units, rent you record, repair requests, expenses, and your
          settings. Listing details and photos are public while the listing is up. If you verify your email for a listing, we keep the address and use it to confirm the
          listing and to reach you about it.
        </p>
        <p>
          If you add a card, Stripe holds it; we see only its brand, last four digits and expiry, and a record of each charge. Your workspace stays until you delete
          what’s in it; ask us and we’ll delete all of it, except charge records we must keep for tax law.
        </p>
      </>,
    ],
    [
      'When you contact us or ask for a mortgage broker',
      <p>
        We keep what you send through the contact form (your name, email and message) to answer you. If you ask to talk to a mortgage broker, we keep your name, email,
        phone, city, timing and anything you chose to share (like your income), and pass them to one licensed broker so they can contact you; the broker may pay us a referral
        fee. Both are deleted after a year.
      </p>,
    ],
    [
      'Records that keep the site safe',
      <p>
        To stop abuse, we count requests by IP address for an hour at a time, then discard the count. When someone reports a listing, we keep the report with the IP
        address it came from, so three different people are needed to hide a listing; reports are deleted with the listing.
      </p>,
    ],
    [
      'Other companies that handle data for us',
      <ul className="list-disc space-y-1.5 pl-5">
        <li>Cloudflare hosts the site and stores the server data (in data centres that may be outside Canada).</li>
        <li>Stripe stores cards and takes landlords’ payments.</li>
        <li>Resend sends verification emails.</li>
        <li>Google Fonts serves the site’s typeface, which means your browser asks Google for it.</li>
        <li>OpenStreetMap draws the listings map: your browser loads its map images, and listing addresses (never yours) are looked up on its Nominatim service.</li>
      </ul>,
    ],
    [
      'Cookies and tracking',
      <p>
        Bedrock uses no advertising or analytics trackers. It uses your browser’s storage for the things above (your numbers, your theme, your private links), not to
        follow you around the web.
      </p>,
    ],
    [
      'Your rights',
      <p>
        You can ask to see the information we hold about you, have it corrected, or have it deleted, under Canada’s privacy law (PIPEDA) and your province’s. Write to{' '}
        {contact}, and we’ll answer within 30 days. If you’re not satisfied, you can complain to the Office of the Privacy Commissioner of Canada.
      </p>,
    ],
  ],
};

export default function LegalPage({ page }) {
  const doc = page === 'privacy' ? PRIVACY : TERMS;
  const other = page === 'privacy' ? ['Terms of use', '/terms/'] : ['Privacy', '/privacy/'];
  return (
    <div className="min-h-dvh bg-(--page) text-zinc-900 antialiased dark:text-zinc-100">
      <header className="border-b border-hairline">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <a href="/" aria-label="Bedrock home">
            <Logo />
          </a>
          <a href={other[1]} className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-well hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
            {other[0]}
          </a>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl dark:text-white">{doc.title}</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Last updated {new Date(`${UPDATED}T12:00:00`).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
        <p className="mt-6 text-lg leading-relaxed text-zinc-700 dark:text-zinc-300">{doc.intro}</p>
        <nav aria-label="On this page" className="mt-8 rounded-md border border-hairline p-4 text-sm">
          <ol className="grid gap-1.5 sm:grid-cols-2">
            {doc.sections.map(([heading], i) => (
              <li key={heading}>
                <a href={`#s${i + 1}`} className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white">
                  {i + 1}. {heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        {doc.sections.map(([heading, body], i) => (
          <section key={heading} id={`s${i + 1}`} className="mt-10 scroll-mt-6">
            <h2 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-white">
              {i + 1}. {heading}
            </h2>
            <div className="mt-3 space-y-3 leading-relaxed text-zinc-700 dark:text-zinc-300">{body}</div>
          </section>
        ))}
      </main>
      <SiteFooter width="max-w-3xl" />
    </div>
  );
}
