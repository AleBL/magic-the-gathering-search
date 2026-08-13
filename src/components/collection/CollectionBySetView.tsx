import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaChevronDown, FaLayerGroup } from 'react-icons/fa';
import { CollectionEntry } from '../../types/Collection';
import { Card } from '../../types/Card';

interface CollectionBySetViewProps {
  entries: CollectionEntry[];
  onSelectCard: (card: Card) => void;
}

/**
 * Collapsible sections, one per edition — the way a physical collection is actually filed.
 *
 * Counts have **no denominator**: "142 owned", never "142 / 281". The set's real size is not
 * stored and would need a Scryfall call per edition, which would make an otherwise fully
 * offline tab depend on the network. A missing denominator is honest; a guessed one is not.
 */
export function CollectionBySetView({ entries, onSelectCard }: CollectionBySetViewProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const bySet = new Map<string, { name: string; items: CollectionEntry[] }>();
    for (const entry of entries) {
      const code = entry.set || '—';
      const existing = bySet.get(code);
      if (existing) existing.items.push(entry);
      else bySet.set(code, { name: entry.card.set_name || code.toUpperCase(), items: [entry] });
    }

    return [...bySet.entries()]
      .map(([code, group]) => ({
        code,
        name: group.name,
        // Copies owned, not rows: two rows of one card each is two cards.
        owned: group.items.reduce((sum, item) => sum + Math.max(0, item.quantity), 0),
        // Within a set, collector number is the filing order; it is a string, so compare numerically.
        items: [...group.items].sort(
          (a, b) =>
            Number(a.card.collector_number ?? 0) - Number(b.card.collector_number ?? 0) || a.name.localeCompare(b.name)
        )
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entries]);

  const toggle = (code: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => {
        const isOpen = !collapsed.has(group.code);
        return (
          <section key={group.code} className="rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(group.code)}
              aria-expanded={isOpen}
              className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-slate-800/60 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <FaLayerGroup className="text-primary text-xs shrink-0" />
              <span className="font-bold text-sm text-gray-800 dark:text-gray-100 truncate">{group.name}</span>
              <span className="text-[10px] uppercase text-gray-400 dark:text-gray-500 shrink-0">{group.code}</span>
              <span className="ml-auto text-xs font-semibold text-gray-500 dark:text-gray-400 tabular-nums shrink-0">
                {t('collection.ownedCount', { count: group.owned })}
              </span>
              <FaChevronDown
                className={`text-[10px] text-gray-400 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isOpen ? (
              <ul className="divide-y divide-gray-100 dark:divide-slate-800">
                {group.items.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => onSelectCard(entry.card)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <span className="w-10 shrink-0 text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
                        {entry.card.collector_number ? `#${entry.card.collector_number}` : ''}
                      </span>
                      <span className="flex-1 min-w-0 truncate text-sm text-gray-800 dark:text-gray-100">
                        {entry.card.printed_name || entry.name}
                      </span>
                      <span className="shrink-0 text-xs font-bold tabular-nums text-gray-700 dark:text-gray-200">
                        {entry.quantity}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
