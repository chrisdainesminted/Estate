import ComparisonMatrix, { CompareSelector } from '../components/ComparisonMatrix.jsx';
import { MAX_COMPARE } from '../lib/presets.js';

/** The Compare tab, loaded on demand with its charts. */
export default function CompareView({ items, compare, slotOf, compared, sliders, activeId, adjusted, dark, lib, onOpen }) {
  return (
    <>
      <div className="rise px-1 pt-2">
        <p className="eyebrow">Compare</p>
        <h2 className="mt-1.5 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl dark:text-white">Which door pays you?</h2>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Up to {MAX_COMPARE} deals underwritten side by side: what the lender approves, what actually lands in your account, and what each one is worth
          when you sell.
        </p>
      </div>
      <CompareSelector items={items} compare={compare} slotOf={slotOf} onToggle={lib.toggleCompare} dark={dark} />
      {compared.length > 0 && sliders}
      <ComparisonMatrix
        items={compared}
        activeId={activeId}
        adjusted={adjusted}
        dark={dark}
        canAdd={compare.length < MAX_COMPARE}
        onAdd={lib.addDeal}
        onDuplicate={lib.duplicateDeal}
        onRemove={lib.toggleCompare}
        onEdit={onOpen}
      />
    </>
  );
}
