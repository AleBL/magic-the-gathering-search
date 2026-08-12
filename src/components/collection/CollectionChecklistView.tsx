import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import { CollectionEntry } from '../../types/Collection';
import { Card } from '../../types/Card';
import { toggleWishlist } from '../../services/collectionService';

interface CollectionChecklistViewProps {
  entries: CollectionEntry[];
  onSelectCard: (card: Card) => void;
}

/**
 * The densest view: one thin row per card, for working through a box and ticking things off, or
 * checking a want list against what is already here.
 *
 * The checkbox toggles **wishlist**, not ownership. Ownership is a count, so a checkbox meaning
 * "one copy" would quietly destroy the number whenever it was unticked.
 */
export function CollectionChecklistView({ entries, onSelectCard }: CollectionChecklistViewProps) {
  const { t } = useTranslation();
  const [pending, setPending] = useState<string | null>(null);

  const sorted = useMemo(() => [...entries].sort((a, b) => a.name.localeCompare(b.name)), [entries]);

  const handleToggle = async (entry: CollectionEntry) => {
    setPending(entry.id);
    try {
      await toggleWishlist(entry.card);
    } finally {
      setPending(null);
    }
  };

  return (
    <ul className="rounded-xl border border-gray-200 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-800 overflow-hidden">
      {sorted.map((entry) => (
        <li
          key={entry.id}
          className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <button
            type="button"
            onClick={() => handleToggle(entry)}
            disabled={pending === entry.id}
            aria-pressed={entry.wishlist}
            title={t('collection.wishlist')}
            aria-label={`${t('collection.wishlist')} — ${entry.card.printed_name || entry.name}`}
            className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-md transition-colors disabled:opacity-50 ${
              entry.wishlist
                ? 'text-rose-500 dark:text-rose-400'
                : 'text-gray-300 dark:text-slate-600 hover:text-rose-400'
            }`}
          >
            {entry.wishlist ? <FaHeart className="text-xs" /> : <FaRegHeart className="text-xs" />}
          </button>

          <button
            type="button"
            onClick={() => onSelectCard(entry.card)}
            className="flex-1 min-w-0 text-left text-sm font-medium text-gray-800 dark:text-gray-100 truncate hover:text-primary dark:hover:text-blue-400"
          >
            {entry.card.printed_name || entry.name}
          </button>

          <span className="shrink-0 text-[10px] uppercase text-gray-400 dark:text-gray-500 tabular-nums hidden sm:inline">
            {entry.set}
          </span>
          <span
            className={`shrink-0 w-8 text-right text-xs font-bold tabular-nums ${
              entry.quantity > 0 ? 'text-gray-800 dark:text-gray-100' : 'text-gray-300 dark:text-slate-600'
            }`}
          >
            {entry.quantity}
          </span>
        </li>
      ))}
    </ul>
  );
}
