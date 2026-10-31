import ComparisonMatrix, { CompareSelector } from '../components/ComparisonMatrix.jsx';
import { MAX_COMPARE } from '../lib/presets.js';
import { SectionGroup } from '../components/Section.jsx';
import { ViewHeader } from '../components/ui.jsx';

/** The Compare tab, loaded on demand with its charts. */
export default function CompareView({ items, compare, slotOf, compared, sliders, activeId, adjusted, dark, lib, onOpen }) {
  return (
    <>
      <ViewHeader title="Compare">
        Up to {MAX_COMPARE} deals side by side.
      </ViewHeader>
      <CompareSelector items={items} compare={compare} slotOf={slotOf} onToggle={lib.toggleCompare} dark={dark} />
      {compared.length > 0 && <SectionGroup>{sliders}</SectionGroup>}
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
