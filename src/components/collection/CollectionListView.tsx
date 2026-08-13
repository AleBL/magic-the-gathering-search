import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';
import { CollectionEntry, Currency } from '../../types/Collection';
import { Card } from '../../types/Card';
import { formatCurrency } from '../../utils/collectionMath';

interface CollectionListViewProps {
  entries: CollectionEntry[];
  currency: Currency;
  onSelectCard: (card: Card) => void;
}

type SortKey = 'name' | 'set' | 'rarity' | 'quantity' | 'price';

/** Rarity has a meaningful order that alphabetical sorting would scramble. */
const RARITY_RANK: Record<string, number> = { common: 0, uncommon: 1, rare: 2, mythic: 3 };

/** Rarity is stored as the Scryfall slug; the UI must not show the slug. */
const RARITY_KEYS: Record<string, string> = {
  common: 'search.common',
  uncommon: 'search.uncommon',
  rare: 'search.rare',
  mythic: 'search.mythic'
};

const unitPrice = (entry: CollectionEntry, currency: Currency): number => {
  const raw = currency === 'eur' ? entry.card.prices?.eur : entry.card.prices?.usd;
  return raw ? parseFloat(raw) : 0;
};

/**
 * One row per printing, with the columns a collection is actually queried by. A grid shows
 * about eight cards per screen; this shows forty, and it can answer "what is my most valuable
 * card" or "where are my duplicates" — questions the card grid cannot.
 */
export function CollectionListView({ entries, currency, onSelectCard }: CollectionListViewProps) {
  const { t } = useTranslation();
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'name', asc: true });

  const sorted = useMemo(() => {
    const direction = sort.asc ? 1 : -1;
    return [...entries].sort((a, b) => {
      switch (sort.key) {
        case 'set':
          return direction * (a.set || '').localeCompare(b.set || '');
        case 'rarity':
          return direction * ((RARITY_RANK[a.rarity] ?? -1) - (RARITY_RANK[b.rarity] ?? -1));
        case 'quantity':
          return direction * (a.quantity - b.quantity);
        case 'price':
          return direction * (unitPrice(a, currency) - unitPrice(b, currency));
        default:
          return direction * a.name.localeCompare(b.name);
      }
    });
  }, [entries, sort, currency]);

  const toggle = (key: SortKey) => setSort((current) => ({ key, asc: current.key === key ? !current.asc : true }));

  const header = (key: SortKey, label: ReactNode, className = '') => (
    // `aria-sort` belongs on the header cell, not on the control inside it.
    <th
      scope="col"
      aria-sort={sort.key === key ? (sort.asc ? 'ascending' : 'descending') : 'none'}
      className={`px-3 py-2 ${className}`}
    >
      <button
        type="button"
        onClick={() => toggle(key)}
        className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-blue-400 transition-colors"
      >
        {label}
        {sort.key !== key ? (
          <FaSort className="text-[8px] opacity-40" />
        ) : sort.asc ? (
          <FaSortUp className="text-[8px]" />
        ) : (
          <FaSortDown className="text-[8px]" />
        )}
      </button>
    </th>
  );

  return (
    // Wide on purpose: the table scrolls inside itself rather than pushing the page sideways.
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700">
      <table className="w-full min-w-[320px] text-sm">
        <thead className="bg-gray-50 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-700">
          <tr>
            {header('name', t('collection.cardName'), 'text-left')}
            {header('set', t('collection.set'), 'text-left hidden sm:table-cell')}
            {header('rarity', t('search.rarity'), 'text-left hidden md:table-cell')}
            {/* One column, label spelled out only where it fits — two <th> would leave the
                body cells misaligned against the header. */}
            {header(
              'quantity',
              <>
                <span className="hidden md:inline">{t('collection.quantity')}</span>
                <span className="md:hidden">{t('collection.quantityShort')}</span>
              </>,
              'text-right'
            )}
            {header('price', t('collection.value'), 'text-right hidden sm:table-cell')}
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry) => (
            <tr
              key={entry.id}
              onClick={() => onSelectCard(entry.card)}
              className="border-b border-gray-100 dark:border-slate-800 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
            >
              <td className="px-3 py-2">
                <button
                  type="button"
                  className="text-left font-semibold text-gray-800 dark:text-gray-100 hover:text-primary dark:hover:text-blue-400"
                >
                  {entry.card.printed_name || entry.name}
                </button>
              </td>
              {/* Set name in full where there is room; the code is the fallback and the
                  narrow-screen form, since "DOM" is recognisable but not readable. */}
              <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs hidden sm:table-cell max-w-[180px]">
                <span className="hidden lg:inline truncate">{entry.card.set_name || entry.set?.toUpperCase()}</span>
                <span className="lg:hidden uppercase">{entry.set}</span>
              </td>
              <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs hidden md:table-cell">
                {RARITY_KEYS[entry.rarity] ? t(RARITY_KEYS[entry.rarity]) : entry.rarity}
              </td>
              <td className="px-3 py-2 text-right font-bold tabular-nums text-gray-800 dark:text-gray-100">
                {entry.quantity}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                {formatCurrency(unitPrice(entry, currency) * entry.quantity, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
