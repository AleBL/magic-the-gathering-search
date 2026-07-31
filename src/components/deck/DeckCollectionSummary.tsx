import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { FaBoxOpen, FaCheckCircle, FaChevronDown } from 'react-icons/fa';
import { db } from '../../db/database';
import { Card } from '../../types/Card';
import { CollectionEntry } from '../../types/Collection';
import { computeDeckCollectionGap, formatCurrency } from '../../utils/collectionMath';
import { useCollectionSettings } from '../../store/useCollectionSettings';

interface DeckCollectionSummaryProps {
  cards: Card[];
}

/**
 * Stable fallback for the first render, before useLiveQuery resolves. A fresh `[]`
 * here would be a new reference every render and would invalidate the memo below.
 */
const NO_ENTRIES: CollectionEntry[] = [];

/** Compares the deck against the owned collection: how many cards are still to buy and the estimated cost. */
export function DeckCollectionSummary({ cards }: DeckCollectionSummaryProps) {
  const { t } = useTranslation();
  const currency = useCollectionSettings((state) => state.currency);
  const entries = useLiveQuery(() => db.collection.toArray(), []) ?? NO_ENTRIES;
  const [expanded, setExpanded] = useState(false);

  const gap = useMemo(() => computeDeckCollectionGap(cards, entries, currency), [cards, entries, currency]);

  if (gap.totalNeeded === 0) return null;

  const complete = gap.missingCopies === 0;
  const missingRows = gap.rows.filter((row) => row.missing > 0);

  return (
    <div
      className={`rounded-xl border p-3 ${
        complete
          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50'
          : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50'
      }`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        {complete ? (
          <FaCheckCircle className="text-emerald-500 shrink-0" />
        ) : (
          <FaBoxOpen className="text-amber-500 shrink-0" />
        )}
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {complete
            ? t('collection.deckComplete')
            : t('collection.deckMissing', {
                count: gap.missingCopies,
                value: formatCurrency(gap.missingValue, currency)
              })}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {t('collection.deckOwnedOf', { owned: gap.totalOwned, total: gap.totalNeeded })}
        </span>
        {!complete && missingRows.length > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
            className="ml-auto flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-300 hover:underline"
          >
            {t('collection.deckShoppingList')}
            <FaChevronDown className={`text-[10px] transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        ) : null}
      </div>

      {expanded && !complete ? (
        <ul className="mt-2 pt-2 border-t border-amber-200/70 dark:border-amber-800/40 flex flex-col gap-1">
          {missingRows.map((row) => (
            <li key={row.name} className="flex items-center justify-between text-xs text-gray-700 dark:text-gray-200">
              <span className="truncate">
                <span className="font-bold tabular-nums">{row.missing}×</span> {row.name}
              </span>
              <span className="tabular-nums text-gray-500 dark:text-gray-400 shrink-0 ml-2">
                {row.unitPrice !== null ? formatCurrency(row.missingValue, currency) : '—'}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
