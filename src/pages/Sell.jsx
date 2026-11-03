import { ArrowRight, Calculator, Camera, CheckCircle2, MessageSquare, Scale, Tag } from 'lucide-react';
import PageShell, { a, h1, h2, lede, prose } from './PageShell.jsx';

const STEPS = [
  [Tag, 'Find out what it’s worth', 'Squarely compares your home with similar ones for sale near you and shows the range they’re asking.', '/app/?view=sell', 'What’s my home worth?'],
  [Calculator, 'See what you’d walk away with', 'The price less the mortgage, its penalty, legal fees and moving. Selling yourself, there’s no commission line.', '/app/?view=sell', 'Work it out'],
  [Camera, 'List it free', 'Photos, the price and the details buyers ask about: bedrooms, taxes, heating, parking. It shows on Squarely’s Find a home page.', '/app/?view=selllist', 'List my home'],
  [MessageSquare, 'Talk to buyers directly', 'Messages come straight to you. No agent in the middle, and no one else’s schedule for showings.', '/app/?view=selllist', 'Start'],
];

const FAQ = [
  ['Is it really free?', 'Yes. Listing a home for sale on Squarely costs nothing, and Squarely takes no commission when it sells. Squarely Plus ($12 a month) adds a pricing report you can download and share, but you don’t need it to sell.'],
  ['Do I need a real estate agent?', 'No. Anywhere in Canada you can sell your own home. You will need a real estate lawyer (a notary in Québec) to handle the paperwork and the money on closing day, usually $1,000 to $2,000.'],
  ['How much do I save?', 'Agent commission in Canada is commonly around 4% to 5% of the price, plus GST or HST on it. On a $400,000 home that’s $18,000 to $23,000. Squarely’s “What it’s worth” tab works out your number for your price and province.'],
  ['Will my home be on MLS® and REALTOR.ca?', 'No. Only a licensed agent can put a home on MLS®. Your Squarely listing is seen by people searching on Squarely. If you also want MLS® reach, a flat-fee listing service can put it there for a set fee while you still sell it yourself.'],
  ['What about offers and conditions?', 'Buyers usually make offers conditional on financing and an inspection. Have your lawyer look over any offer before you sign it. Squarely’s Sell-ready checklist walks through each step.'],
];

/** The public page inviting people to sell their home free on Squarely. */
export default function Sell() {
  return (
    <PageShell>
      <p className="text-xs font-semibold tracking-[0.14em] text-emerald-700 uppercase dark:text-emerald-400">Free · No commission · Anywhere in Canada</p>
      <h1 className={`${h1} mt-3`}>Sell your home free on Squarely</h1>
      <p className={lede}>Know what it’s worth, see what you’d walk away with, list it with photos, and talk to buyers yourself. No listing fee, and no commission to Squarely when it sells.</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <a href="/app/?view=selllist" className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 font-semibold text-zinc-950 hover:bg-emerald-400">
          List my home free <ArrowRight className="size-4" aria-hidden />
        </a>
        <a href="/app/?view=sell" className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 font-semibold text-zinc-900 ring-1 ring-(--line-strong) ring-inset hover:bg-well dark:text-white">
          What’s my home worth?
        </a>
      </div>

      <h2 className={h2}>How it works</h2>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2">
        {STEPS.map(([Icon, title, body, href, cta], i) => (
          <li key={title} className="flex flex-col rounded-lg border border-hairline bg-(--panel) p-5">
            <span className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              <Icon className="size-4" aria-hidden /> Step {i + 1}
            </span>
            <span className="mt-2 font-semibold text-zinc-950 dark:text-white">{title}</span>
            <span className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{body}</span>
            <a href={href} className={`${a} mt-3 inline-flex items-center gap-1 text-sm`}>
              {cta} <ArrowRight className="size-3.5" aria-hidden />
            </a>
          </li>
        ))}
      </ol>

      <h2 className={h2}>What you’ll still need</h2>
      <ul className={prose}>
        {[
          'A real estate lawyer, or a notary in Québec, for the paperwork and closing day.',
          'Your mortgage payout statement, so you know the balance and the penalty for paying it off early.',
          'Good photos in daylight. They matter more than anything else on a listing.',
          'Your last property tax bill and a year of utility bills: buyers will ask.',
        ].map((x) => (
          <li key={x} className="flex gap-2">
            <CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-600" aria-hidden /> {x}
          </li>
        ))}
      </ul>

      <h2 className={h2}>Questions</h2>
      <dl className="mt-4 divide-y divide-hairline rounded-lg border border-hairline">
        {FAQ.map(([q, ans]) => (
          <div key={q} className="p-5">
            <dt className="font-semibold text-zinc-950 dark:text-white">{q}</dt>
            <dd className="mt-1.5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{ans}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-10 rounded-lg border border-hairline bg-(--panel) p-6 text-center">
        <Scale className="mx-auto size-6 text-emerald-600" aria-hidden />
        <p className="mt-2 text-lg font-semibold text-zinc-950 dark:text-white">Start with your number</p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">See what your home is likely worth and what you’d walk away with, in a couple of minutes.</p>
        <a href="/app/?view=sell" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 font-semibold text-zinc-950 hover:bg-emerald-400">
          What’s my home worth? <ArrowRight className="size-4" aria-hidden />
        </a>
      </div>
      <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-400">
        Estimates, not legal or financial advice. Commission rates vary and are negotiable; your lawyer confirms the closing costs.
      </p>
    </PageShell>
  );
}
