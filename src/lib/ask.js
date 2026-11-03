// "Ask Squarely": questions answered from the person's own numbers. The app
// gathers what it knows (their plan, the deal or home they have open) as
// plain facts; Claude answers with those, and says when it doesn't know.

import { money, percent } from './format.js';

export const ASK_SYSTEM = `You are Squarely's assistant, inside a Canadian real estate app for people buying a first home, selling a home, and investing in rentals.
Answer the person's question using the facts about them and their deal given below. Use Canadian rules and terms (CMHC insurance, the stress test, FHSA, RRSP Home Buyers' Plan, land transfer tax, GST/HST).
Be plain, short and specific: a few sentences or a short list, with their own numbers. Say what to do next when it helps.
Never invent a number that isn't in the facts. If something isn't known (for example a listing's tax bill), say so and say how to find it.
You give general information, not financial, legal or tax advice: for a decision, point them to a mortgage broker, a lawyer or an accountant.
If the question has nothing to do with homes, money for a home, or this app, say briefly that you can only help with those.`;

const lines = (obj) =>
  Object.entries(obj)
    .filter(([, v]) => v != null && v !== '' && !(typeof v === 'number' && !Number.isFinite(v)))
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

/**
 * What the app knows, as plain facts for Claude: where they are in the app,
 * their buying plan, the deal they have open, and their sale numbers.
 */
export function askContext({ mode, view, profile, plan, deal, analysis, sell }) {
  const parts = [`Where they are in the app: ${mode} mode, the ${view} tab.`];
  if (profile?.entered && plan) {
    const g = plan.goal;
    parts.push(
      `Their buying plan:\n${lines({
        City: plan.local?.city?.name,
        'Household income': money(profile.income) + '/yr',
        Saved: money(profile.savings),
        'Family gift': profile.gift ? money(profile.gift) : null,
        'Saves each month': money(profile.monthlySave),
        'Monthly debt payments': money(profile.debts),
        'Rent they pay now': money(profile.rentNow) + '/mo',
        'First-time buyer': profile.firstTime ? 'yes' : 'no',
        'Most they could buy alone': money(plan.solo?.price),
        'Most with a rental unit': money(plan.duplex?.price),
        'Cash to close at that price': money(plan.cashToClose),
        'Home they want': `${money(g.price)}, ${g.units} unit${g.units === 1 ? '' : 's'}`,
        'Short of cash for it': money(g.short),
        'Ready by': g.readyBy ?? (g.short > 0 ? 'not on current savings' : 'now'),
        'Income qualifies for it': g.qualifies ? 'yes' : `no (needs about ${money(g.incomeNeeded)})`,
      })}`,
    );
  }
  if (deal && analysis) {
    parts.push(
      `The deal they have open ("${deal.name}"):\n${lines({
        Price: money(deal.price),
        Units: deal.units,
        'Rent per unit': money(deal.rentPerUnit) + '/mo',
        'Property tax': deal.taxesAnnual ? money(deal.taxesAnnual) + '/yr' : 'not known',
        'Down payment': `${deal.downPct}%`,
        'Interest rate': `${deal.rate}%`,
        'Cash flow': money(analysis.netCashFlow, { signed: true }) + '/mo',
        DSCR: Number.isFinite(analysis.dscr) ? analysis.dscr.toFixed(2) : null,
        'Cash-on-cash return': percent(analysis.coc, 1),
        'Cash invested': money(analysis.cashInvested),
        'Rehab budget': deal.rehabCost ? money(deal.rehabCost) : null,
        'Value after repairs': deal.arv ? money(deal.arv) : null,
      })}`,
    );
  }
  if (sell && (mode === 'sell' || view?.startsWith('sell'))) {
    parts.push(
      `Their sale:\n${lines({
        'Home type': `${sell.units} unit${sell.units === 1 ? '' : 's'}, ${sell.beds} bedrooms`,
        'Listing price they set': sell.price != null ? money(sell.price) : 'using the estimate',
        'Mortgage left': money(sell.mortgage),
        'Selling privately': sell.privateSale ? 'yes' : 'no',
        Commission: sell.privateSale ? null : `${sell.commissionPct}%`,
      })}`,
    );
  }
  return parts.join('\n\n');
}

/** One prompt for the Claude page's sample(): the instructions, the facts, the conversation so far and the question. */
export function askPrompt(context, history, question) {
  const talk = history.map((m) => `${m.role === 'user' ? 'Them' : 'You'}: ${m.text}`).join('\n\n');
  return `${ASK_SYSTEM}\n\nFacts about them:\n${context}\n\n${talk ? `The conversation so far:\n${talk}\n\n` : ''}Their question: ${question}`;
}

export const ASK_STARTERS = {
  buy: ['How can I buy sooner?', 'What should I do next?', 'Is a duplex a good idea for me?'],
  sell: ['How much will I walk away with?', 'Should I sell privately?', 'What repairs are worth doing before I list?'],
  invest: ['Is this deal any good?', 'What would make this deal work?', 'How does the BRRRR refinance work in Canada?'],
};
